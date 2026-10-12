import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from '../../../components/ui/Modal';
import { errorMessage, ReporteGenerado, reportesGeneradosApi } from '../../../lib/reportsApi';
import { fmtDateTime, formatBytes, parseUtc } from '../../../lib/format';
import { typeMeta } from './reportTypes';

interface Props {
  reporte: ReporteGenerado | null;
  onClose: () => void;
}

export function nombreArchivo(r: ReporteGenerado): string {
  return `${r.tipo_reporte || r.nombre_reporte}_${r.id}.pdf`;
}

export function descargarUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const PdfPreviewModal: React.FC<Props> = ({ reporte, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openId = useRef<number | null>(null);

  useEffect(() => {
    if (!reporte) return;
    openId.current = reporte.id;
    setUrl(null);
    setError(null);
    let created: string | null = null;
    reportesGeneradosApi
      .descargarBlob(reporte.id)
      .then((blob) => {
        if (openId.current !== reporte.id) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(async (e) => {
        if (openId.current !== reporte.id) return;
        let msg = errorMessage(e, 'No se pudo cargar el PDF');
        const data = (e as { response?: { data?: Blob } })?.response?.data;
        if (data instanceof Blob) {
          try {
            msg = JSON.parse(await data.text()).detail || msg;
          } catch {
            /* sin detalle */
          }
        }
        setError(msg);
      });
    return () => {
      openId.current = null;
      if (created) URL.revokeObjectURL(created);
    };
  }, [reporte]);

  const meta = typeMeta(reporte?.tipo_reporte);
  const titulo = meta?.titulo || reporte?.tipo_reporte_label || reporte?.nombre_reporte || 'Reporte';

  return (
    <Modal open={!!reporte} onClose={onClose} className="max-w-5xl" labelledBy="pdf-title">
      {reporte && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-border px-5 py-3">
            <div className="min-w-0">
              <h2 id="pdf-title" className="truncate font-semibold text-vino">
                {titulo} <span className="font-normal text-text-muted">#{reporte.id}</span>
              </h2>
              <p className="text-xs text-text-muted">
                {fmtDateTime(parseUtc(reporte.fecha_generado))}
                {reporte.tamano_bytes ? ` · ${formatBytes(reporte.tamano_bytes)}` : ''}
                {reporte.usuario_nombre ? ` · ${reporte.usuario_nombre}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!url}
                onClick={() => url && descargarUrl(url, nombreArchivo(reporte))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rojo-tinto px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <ArrowDownTrayIcon className="h-4 w-4" /> Descargar
              </button>
              <button
                disabled={!url}
                onClick={() => url && window.open(url, '_blank', 'noopener')}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-text-dark ring-1 ring-neutral-border hover:bg-neutral-bg disabled:opacity-40"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" /> Abrir en pestaña nueva
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-neutral-bg" aria-label="Cerrar vista previa">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="bg-neutral-bg p-3">
            {error ? (
              <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
                <ExclamationTriangleIcon className="h-10 w-10 text-smog-alto" />
                <p className="text-sm text-text-muted">{error}</p>
              </div>
            ) : url ? (
              <iframe title={`Vista previa ${titulo}`} src={`${url}#toolbar=1&view=FitH`} className="h-[75vh] w-full rounded-lg bg-white" />
            ) : (
              <div className="skeleton h-[75vh] w-full rounded-lg" />
            )}
          </div>
        </>
      )}
    </Modal>
  );
};

export default PdfPreviewModal;
