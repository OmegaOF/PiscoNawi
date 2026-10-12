import React from 'react';
import { motion } from 'framer-motion';
import { ArrowPathIcon, CheckIcon, ExclamationTriangleIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { EstadoOcr } from '../../hooks/useOcrPlaca';
import { LecturaPlaca } from '../../lib/ocrPlaca';

interface OcrPanelProps {
  estado: EstadoOcr;
  progreso: number;
  resultado: LecturaPlaca | null;
  error: string | null;
  onUsar: (texto: string) => void;
  onDescartar: () => void;
  onReintentar: () => void;
}

const OcrPanel: React.FC<OcrPanelProps> = ({ estado, progreso, resultado, error, onUsar, onDescartar, onReintentar }) => {
  if (estado === 'idle') return null;
  const fallo = estado === 'listo' && !resultado?.texto;
  const dudosa = !!resultado && resultado.confianza < 25;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-neutral-border bg-neutral-bg p-3"
      data-testid="ocr-panel"
    >
      {(estado === 'preparando' || estado === 'leyendo') && (
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-rojo-tinto/30 border-t-rojo-tinto" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-dark">
              {estado === 'preparando' ? 'Preparando lector (solo la primera vez)…' : 'Leyendo la placa…'}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-border">
              <motion.div className="h-full bg-rojo-tinto" animate={{ width: `${Math.round(progreso * 100)}%` }} />
            </div>
          </div>
          <button onClick={onDescartar} className="rounded-lg p-1.5 text-text-muted hover:bg-white" aria-label="Cancelar lectura">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {estado === 'error' && (
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-smog-alto" />
          <p className="flex-1 text-sm text-text-dark">{error || 'No se pudo ejecutar el lector.'} Escribe la placa manualmente.</p>
          <button onClick={onReintentar} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-rojo-tinto hover:bg-white">
            <ArrowPathIcon className="h-4 w-4" /> Reintentar
          </button>
          <button onClick={onDescartar} className="rounded-lg p-1.5 text-text-muted hover:bg-white" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {estado === 'listo' && resultado && (
        <div className="flex flex-wrap items-center gap-3" data-testid="ocr-resultado">
          <img src={resultado.previewDataUrl} alt="Recorte procesado" className="h-14 max-w-[180px] rounded border border-neutral-border bg-white object-contain" />
          <div className="min-w-[160px] flex-1">
            {fallo ? (
              <p className="flex items-center gap-1.5 text-sm text-text-dark">
                <ExclamationTriangleIcon className="h-4 w-4 text-[#A86E00]" />
                No se pudo leer la placa. Escríbela manualmente.
              </p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-muted">
                  <SparklesIcon className="h-3.5 w-3.5" /> Lectura sugerida
                </p>
                <p className="text-sm text-text-dark">
                  <span className="font-mono text-xl font-bold tracking-widest">{resultado.texto}</span>
                  <span className="ml-2 text-text-muted">({resultado.confianza} % de coincidencia)</span>
                </p>
                {dudosa ? (
                  <p className="text-xs font-medium text-[#A86E00]">Lectura dudosa: revisa cada carácter con la imagen antes de guardar.</p>
                ) : (
                  <p className="text-xs text-text-muted">Lectura aproximada: compárala con la imagen antes de guardar.</p>
                )}
                {!resultado.formatoOk && <p className="text-xs text-[#A86E00]">No coincide con el formato boliviano.</p>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!fallo && (
              <button
                onClick={() => onUsar(resultado.texto)}
                className="inline-flex items-center gap-1 rounded-lg bg-rojo-tinto px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                data-testid="ocr-usar"
              >
                <CheckIcon className="h-4 w-4" /> Usar
              </button>
            )}
            <button onClick={onReintentar} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-text-dark ring-1 ring-neutral-border hover:bg-white">
              <ArrowPathIcon className="h-4 w-4" /> Otra vez
            </button>
            <button onClick={onDescartar} className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-white">
              Descartar
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default OcrPanel;
