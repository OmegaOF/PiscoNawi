import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { errorMessage, ReporteGenerado, reportesGeneradosApi, Agrupar } from '../../lib/reportsApi';
import { fmtInt, parseUtc, timeAgo } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyRole, ROLE_ADMIN, ROLE_DEV } from '../../lib/rbac';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import ReportTypeCards from './reportesGenerados/ReportTypeCards';
import ParamsPanel, { Params } from './reportesGenerados/ParamsPanel';
import HistoryList from './reportesGenerados/HistoryList';
import PdfPreviewModal, { descargarUrl, nombreArchivo } from './reportesGenerados/PdfPreviewModal';
import { REPORT_TYPES, TipoReporte, typeMeta } from './reportesGenerados/reportTypes';
import { presetRange } from '../../hooks/useReportFilters';

const ReportesGenerados: React.FC = () => {
  const [search] = useSearchParams();
  const { roles } = useAuth();
  const toast = useToast();
  const canDelete = hasAnyRole(roles, [ROLE_ADMIN, ROLE_DEV]);

  const tipoInicial = (search.get('tipo') as TipoReporte) || 'reporte_general';
  const [tipo, setTipo] = useState<TipoReporte>(typeMeta(tipoInicial) ? tipoInicial : 'reporte_general');
  const defaults = presetRange('30d');
  const [params, setParams] = useState<Params>({
    desde: search.get('desde') ?? defaults.desde ?? '',
    hasta: search.get('hasta') ?? defaults.hasta ?? '',
    agrupar: ((search.get('agrupar') as Agrupar) || 'dia') as Agrupar,
  });

  const [items, setItems] = useState<ReporteGenerado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<ReporteGenerado | null>(null);
  const [aEliminar, setAEliminar] = useState<ReporteGenerado | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await reportesGeneradosApi.list());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'No se pudo cargar el historial de reportes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const meta = typeMeta(tipo)!;

  const generar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (params.desde && params.hasta && params.desde > params.hasta) {
      toast.error('La fecha "desde" debe ser anterior a la fecha "hasta".');
      return;
    }
    setExporting(true);
    try {
      const res = await reportesGeneradosApi.exportar({
        tipo_reporte: tipo,
        desde: params.desde || undefined,
        hasta: params.hasta || undefined,
        agrupar: meta.usaAgrupar ? params.agrupar : 'dia',
      });
      toast.success(`${meta.titulo} generado · ${fmtInt(res.total_registros_exportados)} registros exportados`);
      setHighlight(res.reporte_generado.id);
      setItems((xs) => [res.reporte_generado, ...xs.filter((x) => x.id !== res.reporte_generado.id)]);
      setPreview(res.reporte_generado);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo generar el PDF'));
    } finally {
      setExporting(false);
    }
  };

  const descargar = async (r: ReporteGenerado) => {
    try {
      const blob = await reportesGeneradosApi.descargarBlob(r.id);
      const url = URL.createObjectURL(blob);
      descargarUrl(url, nombreArchivo(r));
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo descargar el PDF'));
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    const r = aEliminar;
    setAEliminar(null);
    try {
      await reportesGeneradosApi.eliminar(r.id);
      setItems((xs) => xs.filter((x) => x.id !== r.id));
      toast.success(`Reporte #${r.id} eliminado`);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo eliminar el reporte'));
    }
  };

  const stats = useMemo(() => {
    const ultimo = items[0] ? parseUtc(items[0].fecha_generado) : null;
    const counts = new Map<string, number>();
    items.forEach((r) => r.tipo_reporte && counts.set(r.tipo_reporte, (counts.get(r.tipo_reporte) || 0) + 1));
    let top: string | null = null;
    counts.forEach((v, k) => {
      if (!top || v > (counts.get(top) || 0)) top = k;
    });
    const faltantes = items.filter((r) => r.existe_archivo === false).length;
    return { total: items.length, ultimo, top, faltantes };
  }, [items]);

  const topLabel = stats.top
    ? typeMeta(stats.top)?.titulo || items.find((r) => r.tipo_reporte === stats.top)?.tipo_reporte_label || stats.top
    : '—';
  const statCards = [
    { label: 'Reportes generados', value: fmtInt(stats.total), icon: DocumentDuplicateIcon },
    { label: 'Último reporte', value: stats.ultimo ? timeAgo(stats.ultimo) : '—', icon: ClockIcon },
    { label: 'Tipo más usado', value: topLabel, icon: ChartBarIcon },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Pisco Ñawi IA</p>
          <h1 className="text-3xl font-extrabold text-vino sm:text-4xl">Reportes PDF</h1>
          <p className="mt-1 text-sm text-text-muted">Genera documentos listos para imprimir o compartir y consulta el historial.</p>
        </div>
        <Link
          to="/reportes"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-rojo-tinto ring-1 ring-rojo-tinto/30 hover:bg-rojo-tinto/5"
        >
          <SparklesIcon className="h-4 w-4" /> Ver panel interactivo
        </Link>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3 rounded-2xl border border-neutral-border bg-white p-4 shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-vino/10 text-vino">
              <c.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-text-muted">{c.label}</p>
              <p className="truncate text-lg font-bold text-text-dark">{c.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-smog-alto/30 bg-smog-alto/5 p-3 text-sm text-smog-alto">
          <span className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" /> {error}
          </span>
          <button onClick={load} className="inline-flex items-center gap-1 font-medium hover:underline">
            <ArrowPathIcon className="h-4 w-4" /> Reintentar
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={generar} className="h-fit rounded-2xl border border-neutral-border bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:col-span-5">
          <h2 className="mb-1 text-lg font-bold text-vino">Nuevo reporte</h2>
          <p className="mb-4 text-xs text-text-muted">1. Elige el tipo · 2. Define el período · 3. Genera el PDF</p>
          <ReportTypeCards value={tipo} onChange={setTipo} />
          <div className="my-5 h-px bg-neutral-border" />
          <ParamsPanel value={params} onChange={setParams} usaAgrupar={meta.usaAgrupar} />
          <button
            type="submit"
            disabled={exporting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rojo-tinto px-4 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {exporting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generando PDF…
              </>
            ) : (
              <>
                <DocumentArrowDownIcon className="h-5 w-5" /> Generar PDF
              </>
            )}
          </button>
          {exporting && <p className="mt-2 text-center text-xs text-text-muted">Puede tardar unos segundos mientras se dibujan los gráficos y mapas.</p>}
        </form>

        <section className="rounded-2xl border border-neutral-border bg-white p-5 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-vino">Historial</h2>
              <p className="text-xs text-text-muted">
                {stats.faltantes > 0 ? `${stats.faltantes} reporte(s) sin archivo en el servidor` : 'Todos los archivos están disponibles'}
              </p>
            </div>
            <button onClick={load} className="rounded-lg p-2 text-text-muted hover:bg-neutral-bg hover:text-vino" aria-label="Actualizar historial" title="Actualizar">
              <ArrowPathIcon className={loading ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
            </button>
          </div>
          <HistoryList
            items={items}
            loading={loading}
            canDelete={canDelete}
            highlightId={highlight}
            onPreview={setPreview}
            onDownload={descargar}
            onDelete={setAEliminar}
          />
        </section>
      </div>

      <PdfPreviewModal reporte={preview} onClose={() => setPreview(null)} />

      <Modal open={!!aEliminar} onClose={() => setAEliminar(null)} className="max-w-md" labelledBy="del-title">
        {aEliminar && (
          <div className="p-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-smog-alto/10 text-smog-alto">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </span>
              <h2 id="del-title" className="text-lg font-bold text-text-dark">
                ¿Eliminar reporte #{aEliminar.id}?
              </h2>
            </div>
            <p className="text-sm text-text-muted">
              Se borrará el registro y su archivo PDF del servidor. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setAEliminar(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-text-dark ring-1 ring-neutral-border hover:bg-neutral-bg">
                Cancelar
              </button>
              <button onClick={confirmarEliminar} className="rounded-lg bg-smog-alto px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <p className="mt-6 text-center text-xs text-text-muted">
        Tipos disponibles: {REPORT_TYPES.map((t) => t.titulo).join(' · ')}
      </p>
    </div>
  );
};

export default ReportesGenerados;
