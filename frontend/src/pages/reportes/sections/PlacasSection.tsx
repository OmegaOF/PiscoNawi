import React, { useState } from 'react';
import { IdentificationIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import NivelBadge from '../../../components/reports/NivelBadge';
import { useSurface } from '../../../components/reports/surface';
import { usePresentation } from '../../../contexts/PresentationContext';
import { fmtDateTime, fmtInt, fmtPct } from '../../../lib/format';
import { nivelSmog } from '../../../lib/smog';
import { LEVEL_COLORS } from '../../../lib/chartCtx';
import { cx } from '../../../lib/cx';

const PlacasSection: React.FC<SectionProps> = ({ data }) => {
  const s = useSurface();
  const { active } = usePresentation();
  const [todas, setTodas] = useState(false);
  const all = data.placas.data || [];
  const items = all.slice(0, todas ? all.length : active ? 8 : 10);

  return (
    <SectionWrap id="placas" subtitle="Vehículos detectados varias veces, ordenados por detecciones con smog">
      <ChartCard
        title="Placas reincidentes"
        subtitle={`${fmtInt(all.length)} placas con 2 o más detecciones`}
        icon={IdentificationIcon}
        loading={data.placas.loading}
        hasData={!!data.placas.data}
        error={data.placas.error}
        onRetry={data.placas.reload}
        empty={!!data.placas.data && all.length === 0}
        emptyText="No se registraron placas con más de una detección."
        minHeight={220}
        allowFullscreen={false}
        help={<p>Solo se incluyen capturas con placa registrada. Útil para identificar vehículos que emiten smog de forma recurrente.</p>}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={cx('text-left text-xs uppercase tracking-wide', s.muted)}>
                <th className="hidden py-2 pr-4 font-medium sm:table-cell">#</th>
                <th className="py-2 pr-4 font-medium">Placa</th>
                <th className="hidden py-2 pr-4 text-right font-medium sm:table-cell">Detecciones</th>
                <th className="py-2 pr-4 text-right font-medium">Con smog</th>
                <th className="hidden w-1/3 py-2 pr-4 font-medium md:table-cell">Porcentaje con smog</th>
                <th className="py-2 pr-4 font-medium">Nivel</th>
                <th className="hidden py-2 font-medium lg:table-cell">Última detección</th>
              </tr>
            </thead>
            <tbody className={cx('divide-y', s.dark ? 'divide-pres-border' : 'divide-neutral-border')}>
              {items.map((p, i) => {
                const color = LEVEL_COLORS[nivelSmog(p.pct_smog, p.smog)][s.dark ? 'dark' : 'light'];
                return (
                  <tr key={p.placa} className={s.hover}>
                    <td className={cx('hidden py-2.5 pr-4 tabular-nums sm:table-cell', s.muted)}>{i + 1}</td>
                    <td className="py-2.5 pr-4">
                      <span className={cx('inline-block rounded-md border-2 px-1.5 py-0.5 font-mono text-sm font-bold tracking-wider sm:px-2 sm:text-base sm:tracking-widest', s.dark ? 'border-pres-border bg-white/5' : 'border-text-dark/70 bg-white')}>
                        {p.placa}
                      </span>
                    </td>
                    <td className="hidden py-2.5 pr-4 text-right tabular-nums sm:table-cell">{fmtInt(p.total)}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{fmtInt(p.smog)}</td>
                    <td className="hidden py-2.5 pr-4 md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className={cx('h-2 flex-1 overflow-hidden rounded-full', s.dark ? 'bg-white/10' : 'bg-neutral-bg')}>
                          <div className="h-full rounded-full" style={{ width: `${p.pct_smog}%`, background: color }} />
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums">{fmtPct(p.pct_smog, 0)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <NivelBadge pct={p.pct_smog} smog={p.smog} size="sm" />
                    </td>
                    <td className={cx('hidden py-2.5 text-xs lg:table-cell', s.muted)}>{fmtDateTime(p.ultima_fecha)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {all.length > 10 && !active && (
          <button onClick={() => setTodas((v) => !v)} className="mt-3 text-sm font-medium text-rojo-tinto hover:underline">
            {todas ? 'Ver menos' : `Ver todas (${all.length})`}
          </button>
        )}
      </ChartCard>
    </SectionWrap>
  );
};

export default PlacasSection;
