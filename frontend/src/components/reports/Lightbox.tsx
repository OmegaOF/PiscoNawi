import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon, MapPinIcon, ClockIcon, IdentificationIcon } from '@heroicons/react/24/outline';
import { CapturaTop } from '../../lib/reportsApi';
import { fmtDateTime, fmtPct01 } from '../../lib/format';
import ClaseBadge from './ClaseBadge';

interface LightboxProps {
  items: CapturaTop[];
  index: number | null;
  onClose: () => void;
  onNavigate: (i: number) => void;
}

export const IMG_FALLBACK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23E7E2D8'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%236B6B6B' font-family='sans-serif' font-size='18'>Imagen no disponible</text></svg>";

const Lightbox: React.FC<LightboxProps> = ({ items, index, onClose, onNavigate }) => {
  const item = index != null ? items[index] : null;

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        onNavigate((index + 1) % items.length);
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        onNavigate((index - 1 + items.length) % items.length);
      }
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {item && index != null && (
        <motion.div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de captura"
        >
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Cerrar">
            <XMarkIcon className="h-6 w-6" />
          </button>
          <button
            onClick={() => onNavigate((index - 1 + items.length) % items.length)}
            className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Anterior"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <button
            onClick={() => onNavigate((index + 1) % items.length)}
            className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Siguiente"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#1C1517] text-white shadow-2xl md:flex-row">
            <motion.img
              layoutId={`cap-${item.imagen_id}`}
              src={item.ruta_archivo}
              alt={`Captura ${item.imagen_id}`}
              onError={(e) => ((e.target as HTMLImageElement).src = IMG_FALLBACK)}
              className="max-h-[60vh] w-full bg-black object-contain md:max-h-[88vh] md:w-2/3"
            />
            <div className="flex flex-1 flex-col gap-4 p-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-pres-muted">Confianza de la predicción</p>
                <p className="text-5xl font-extrabold">{fmtPct01(item.confianza, 1)}</p>
              </div>
              <ClaseBadge clase={item.clase_predicha} size="md" />
              <dl className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <IdentificationIcon className="h-4 w-4 text-pres-muted" />
                  <dt className="text-pres-muted">Placa:</dt>
                  <dd className="font-mono font-semibold tracking-wider">{item.placa_manual || 'Sin placa'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="h-4 w-4 text-pres-muted" />
                  <dt className="text-pres-muted">Zona:</dt>
                  <dd>{item.ubicacion_nombre || '—'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-pres-muted" />
                  <dt className="text-pres-muted">Fecha:</dt>
                  <dd>{fmtDateTime(item.fecha_prediccion)}</dd>
                </div>
              </dl>
              <p className="mt-auto text-xs text-pres-muted">
                {index + 1} de {items.length}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Lightbox;
