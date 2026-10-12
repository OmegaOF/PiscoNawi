import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownTrayIcon, EyeIcon, MagnifyingGlassIcon, TrashIcon, UserIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { ReporteGenerado } from '../../../lib/reportsApi';
import { fmtDate, fmtDateTime, fmtInt, formatBytes, parseUtc } from '../../../lib/format';
import { AGRUPAR_LABEL, FALLBACK_ICON, REPORT_TYPES, typeMeta } from './reportTypes';
import { cx } from '../../../lib/cx';

interface Props {
  items: ReporteGenerado[];
  loading: boolean;
  canDelete: boolean;
  highlightId?: number | null;
  onPreview: (r: ReporteGenerado) => void;
  onDownload: (r: ReporteGenerado) => void;
  onDelete: (r: ReporteGenerado) => void;
}

const HistoryList: React.FC<Props> = ({ items, loading, canDelete, highlightId, onPreview, onDownload, onDelete }) => {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<string>('todos');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((r) => {
      if (tipo !== 'todos' && r.tipo_reporte !== tipo) return false;
      if (!term) return true;
      const meta = typeMeta(r.tipo_reporte);
      return [meta?.titulo, r.tipo_reporte_label, r.nombre_reporte, r.usuario_nombre, r.usuario_username, String(r.id)]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(term));
    });
  }, [items, q, tipo]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por tipo, usuario o número…"
            aria-label="Buscar reportes"
            className="h-9 w-full rounded-lg border border-neutral-border bg-white pl-9 pr-3 text-sm focus:border-rojo-tinto focus:outline-none focus:ring-2 focus:ring-rojo-tinto/20"
          />
        </div>
      </div>
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {[{ id: 'todos', titulo: 'Todos' }, ...REPORT_TYPES].map((t) => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            className={cx(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              tipo === t.id ? 'bg-vino text-white' : 'bg-neutral-bg text-text-dark ring-1 ring-neutral-border hover:ring-vino/40',
            )}
          >
            {t.titulo}
          </button>
        ))}
      </div>

      {loading && !items.length ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[72px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-border py-12 text-center">
          <img src="/art-1.png" alt="" className="h-20 w-20 object-contain opacity-70" />
          <p className="text-sm text-text-muted">
            {items.length ? 'Ningún reporte coincide con la búsqueda.' : 'Todavía no se generaron reportes. Elige un tipo a la izquierda.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((r, i) => {
              const meta = typeMeta(r.tipo_reporte);
              const Icon = meta?.icon || FALLBACK_ICON;
              const fecha = parseUtc(r.fecha_generado);
              const disponible = r.existe_archivo !== false;
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  className={cx(
                    'flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 transition-shadow hover:shadow-sm',
                    highlightId === r.id ? 'border-vino ring-2 ring-vino/40' : 'border-neutral-border',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vino/10 text-vino">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-0">
                    <p className="truncate font-medium text-text-dark">
                      {meta?.titulo || r.tipo_reporte_label || r.nombre_reporte} <span className="text-text-muted">#{r.id}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                      <span>{fmtDateTime(fecha)}</span>
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {r.usuario_nombre || (r.usuario_id ? `Usuario #${r.usuario_id}` : '—')}
                      </span>
                      {(r.desde || r.hasta) && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDaysIcon className="h-3 w-3" />
                          {fmtDate(r.desde || null)} – {fmtDate(r.hasta || null)}
                        </span>
                      )}
                      {r.agrupar && meta?.usaAgrupar && <span>Agrupado por {AGRUPAR_LABEL[r.agrupar]?.toLowerCase() || r.agrupar}</span>}
                      {r.total_registros != null && <span>{fmtInt(r.total_registros)} registros</span>}
                      {r.tamano_bytes != null && <span>{formatBytes(r.tamano_bytes)}</span>}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'ml-[3.25rem] rounded-full px-2 py-0.5 text-[11px] font-semibold sm:ml-0',
                      disponible ? 'bg-smog-bajo/15 text-smog-bajo' : 'bg-smog-moderado/15 text-[#A86E00]',
                    )}
                  >
                    {disponible ? 'Disponible' : 'Archivo faltante'}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => onPreview(r)}
                      disabled={!disponible}
                      className="rounded-lg p-2 text-text-muted hover:bg-neutral-bg hover:text-vino disabled:opacity-30"
                      title="Vista previa"
                      aria-label={`Vista previa del reporte ${r.id}`}
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onDownload(r)}
                      disabled={!disponible}
                      className="rounded-lg p-2 text-text-muted hover:bg-neutral-bg hover:text-vino disabled:opacity-30"
                      title="Descargar"
                      aria-label={`Descargar reporte ${r.id}`}
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => onDelete(r)}
                        className="rounded-lg p-2 text-text-muted hover:bg-smog-alto/10 hover:text-smog-alto"
                        title="Eliminar"
                        aria-label={`Eliminar reporte ${r.id}`}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};

export default HistoryList;
