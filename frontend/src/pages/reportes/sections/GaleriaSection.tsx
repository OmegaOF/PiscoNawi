import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PhotoIcon, MapPinIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import Lightbox, { IMG_FALLBACK } from '../../../components/reports/Lightbox';
import { usePresentation } from '../../../contexts/PresentationContext';
import { fmtDateTime, fmtPct01 } from '../../../lib/format';
import { nivelSmog } from '../../../lib/smog';
import { LEVEL_COLORS } from '../../../lib/chartCtx';

const GaleriaSection: React.FC<SectionProps> = ({ data }) => {
  const { active } = usePresentation();
  const [open, setOpen] = useState<number | null>(null);
  const items = (data.topCapturas.data || []).slice(0, active ? 8 : 12);

  return (
    <SectionWrap id="galeria" subtitle="Evidencia visual: capturas con mayor probabilidad de smog">
      <ChartCard
        title="Capturas con mayor probabilidad de smog"
        subtitle="Clic en una imagen para ver el detalle"
        icon={PhotoIcon}
        loading={data.topCapturas.loading}
        hasData={!!data.topCapturas.data}
        error={data.topCapturas.error}
        onRetry={data.topCapturas.reload}
        empty={!!data.topCapturas.data && items.length === 0}
        emptyText="No hay capturas con smog en este rango."
        minHeight={280}
        allowFullscreen={false}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((it, i) => {
            const color = LEVEL_COLORS[nivelSmog(it.p_smog * 100)].dark;
            return (
              <motion.button
                key={it.imagen_id}
                type="button"
                onClick={() => setOpen(i)}
                whileHover={{ scale: 1.03 }}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-border text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-rojo-tinto"
                aria-label={`Ver captura ${it.imagen_id}`}
              >
                <motion.img
                  layoutId={`cap-${it.imagen_id}`}
                  src={it.ruta_archivo}
                  alt=""
                  loading="lazy"
                  onError={(e) => ((e.target as HTMLImageElement).src = IMG_FALLBACK)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow" style={{ background: color }}>
                  #{i + 1}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-2 text-white sm:p-3">
                  <p className="text-lg font-extrabold leading-none sm:text-2xl" style={{ color }}>
                    {fmtPct01(it.p_smog, 0)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] font-semibold tracking-wider sm:text-xs">{it.placa_manual || 'Sin placa'}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/80">
                    <MapPinIcon className="h-3 w-3 shrink-0" />
                    {it.ubicacion_nombre || '—'} · {fmtDateTime(it.fecha_prediccion)}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </ChartCard>
      <Lightbox items={items} index={open} onClose={() => setOpen(null)} onNavigate={setOpen} />
    </SectionWrap>
  );
};

export default GaleriaSection;
