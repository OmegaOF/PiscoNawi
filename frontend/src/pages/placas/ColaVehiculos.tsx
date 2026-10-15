import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { VehiculoPlaca } from '../../lib/placasApi';
import { IMG_FALLBACK } from '../../components/reports/Lightbox';
import { fmtDateTime, fmtInt, fmtPct01 } from '../../lib/format';
import { LEVEL_COLORS } from '../../lib/chartCtx';
import { cx } from '../../lib/cx';

interface Props {
  items: VehiculoPlaca[];
  selId: number | null;
  onSelect: (id: number) => void;
  total: number;
  page: number;
  size: number;
  onPage: (p: number) => void;
  loading: boolean;
  className?: string;
}

const ColaVehiculos: React.FC<Props> = ({ items, selId, onSelect, total, page, size, onPage, loading, className }) => {
  const refs = useRef<Record<number, HTMLButtonElement | null>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const paginas = Math.max(1, Math.ceil(total / size));

  // Desplaza solo la lista (no la página) para mostrar el elemento activo
  useEffect(() => {
    const list = listRef.current;
    const el = selId != null ? refs.current[selId] : null;
    if (!list || !el) return;
    const vertical = list.scrollHeight > list.clientHeight + 1;
    if (vertical) {
      const top = el.offsetTop - list.offsetTop;
      if (top < list.scrollTop) list.scrollTo({ top: top - 8, behavior: 'smooth' });
      else if (top + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTo({ top: top + el.offsetHeight - list.clientHeight + 8, behavior: 'smooth' });
    } else {
      const left = el.offsetLeft - list.offsetLeft;
      if (left < list.scrollLeft || left + el.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollTo({ left: left - 8, behavior: 'smooth' });
    }
  }, [selId]);

  return (
    <div className={cx('flex min-w-0 flex-col rounded-2xl border border-neutral-border bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-neutral-border px-4 py-3">
        <div>
          <h2 className="font-semibold text-text-dark">Cola de vehículos</h2>
          <p className="text-xs text-text-muted">{fmtInt(total)} en esta vista · más recientes primero</p>
        </div>
      </div>
      <div
        ref={listRef}
        className={cx(
          'relative flex gap-2 overflow-x-auto p-3 lg:max-h-[calc(100vh-17rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden',
          loading && items.length > 0 && 'opacity-60',
        )}
      >
        {loading && items.length === 0 &&
          [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-[76px] min-w-[240px] rounded-xl lg:min-w-0" />)}
        <AnimatePresence initial={false}>
          {items.map((it) => {
            const activo = it.imagen_id === selId;
            const color = LEVEL_COLORS[it.clase_predicha === 'smog' ? 'alto' : 'bajo'].light;
            return (
              <motion.button
                key={it.imagen_id}
                ref={(el: HTMLButtonElement | null) => {
                  refs.current[it.imagen_id] = el;
                }}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                type="button"
                onClick={() => onSelect(it.imagen_id)}
                data-testid="cola-item"
                className={cx(
                  'flex min-w-[240px] shrink-0 items-center gap-3 rounded-xl border p-2 text-left transition-colors lg:min-w-0',
                  activo ? 'border-rojo-tinto bg-rojo-tinto/5 ring-2 ring-rojo-tinto/60' : 'border-neutral-border hover:border-rojo-tinto/40 hover:bg-neutral-bg',
                )}
              >
                <img
                  src={it.ruta_archivo}
                  alt=""
                  loading="lazy"
                  onError={(e) => ((e.target as HTMLImageElement).src = IMG_FALLBACK)}
                  className="h-14 w-20 shrink-0 rounded-lg bg-neutral-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold uppercase leading-none tracking-wide" style={{ color }}>
                      {it.clase_predicha === 'smog' ? 'Con smog' : 'Sin smog'}
                      <span className="ml-1.5 text-xs font-semibold normal-case tracking-normal text-text-muted">{fmtPct01(it.confianza, 0)}</span>
                    </span>
                    {it.placa_manual ? (
                      <span className="rounded border-2 border-text-dark/70 px-1.5 font-mono text-xs font-bold tracking-widest text-text-dark">{it.placa_manual}</span>
                    ) : (
                      <span className="text-xs italic text-text-muted">Sin placa</span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-text-muted">
                    <MapPinIcon className="h-3 w-3 shrink-0" />
                    {it.ubicacion_nombre || 'Sin zona'}
                  </p>
                  <p className="truncate text-[11px] text-text-muted">{fmtDateTime(it.fecha_prediccion)}</p>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-neutral-border px-4 py-2.5 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-text-dark hover:bg-neutral-bg disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Anterior
        </button>
        <span className="text-xs text-text-muted">
          Página {page} de {paginas}
        </span>
        <button
          type="button"
          disabled={page >= paginas}
          onClick={() => onPage(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-text-dark hover:bg-neutral-bg disabled:opacity-30"
        >
          Siguiente <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ColaVehiculos;
