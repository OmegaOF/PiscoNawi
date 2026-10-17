import React, { useCallback, useMemo, useState } from 'react';
import { MapPinIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import EChart from '../../../components/reports/EChart';
import SmogMap from '../../../components/reports/SmogMap';
import NivelBadge from '../../../components/reports/NivelBadge';
import { useSurface } from '../../../components/reports/surface';
import { useChartCtx, usePresentation } from '../../../contexts/PresentationContext';
import { rankingBarOption, zonaToRank } from '../../../lib/chartOptions';
import { NIVEL_LABEL, Nivel } from '../../../lib/smog';
import { LEVEL_COLORS } from '../../../lib/chartCtx';
import { cx } from '../../../lib/cx';

const LEYENDA: Nivel[] = ['alto', 'moderado', 'bajo', 'sin'];

const MapaSection: React.FC<SectionProps> = ({ data }) => {
  const ctx = useChartCtx();
  const s = useSurface();
  const { active } = usePresentation();
  const [selected, setSelected] = useState<number | null>(null);
  const zonas = useMemo(() => data.zonas.data || [], [data.zonas.data]);
  const ranking = useMemo(() => zonas.map(zonaToRank).sort((a, b) => b.pct - a.pct), [zonas]);
  const height = active ? '62vh' : '100%';
  const opcionRanking = useMemo(() => rankingBarOption(ranking, ctx), [ranking, ctx]);
  // Se resuelve por nombre de la barra, no por posición: el índice puede venir de un
  // render anterior si los datos cambiaron mientras el puntero estaba sobre el gráfico.
  const alElegirZona = useCallback(
    (p: { dataIndex: number; name?: string }) => {
      const zona = ranking.find((z) => z.label === p.name) ?? ranking[p.dataIndex];
      setSelected(zona?.id ?? null);
    },
    [ranking],
  );
  const eventosRanking = useMemo(() => ({ click: alElegirZona }), [alElegirZona]);

  return (
    <SectionWrap id="mapa" subtitle="Dónde se concentra el smog en el área metropolitana de Cochabamba">
      <div className="grid gap-5 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="Mapa de calor por zona"
          subtitle="Tamaño = vehículos analizados · color = nivel de smog"
          icon={MapPinIcon}
          loading={data.zonas.loading}
          hasData={!!data.zonas.data}
          error={data.zonas.error}
          onRetry={data.zonas.reload}
          empty={!!data.zonas.data && zonas.length === 0}
          emptyText="No hay ubicaciones con predicciones en este rango."
          minHeight={320}
          actions={
            <div className="hidden items-center gap-3 pr-2 sm:flex">
              {LEYENDA.map((n) => (
                <span key={n} className={cx('flex items-center gap-1 text-xs', s.muted)}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_COLORS[n][ctx.dark ? 'dark' : 'light'] }} />
                  {NIVEL_LABEL[n]}
                </span>
              ))}
            </div>
          }
        >
          <div className={active ? '' : 'h-[320px] sm:h-[440px] lg:h-[560px]'}>
            <SmogMap zonas={zonas} height={height} dark={ctx.dark} permanentLabels={active} selectedId={selected} />
          </div>
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Ranking de zonas"
          subtitle="Porcentaje de vehículos con smog · clic para ubicar en el mapa"
          icon={ChartBarIcon}
          loading={data.zonas.loading}
          hasData={!!data.zonas.data}
          error={data.zonas.error}
          onRetry={data.zonas.reload}
          empty={!!data.zonas.data && zonas.length === 0}
          minHeight={300}
          help={<p>Las líneas verticales marcan los umbrales de 15 % (moderado) y 30 % (alto).</p>}
        >
          <EChart
            option={opcionRanking}
            height={Math.max(220, ranking.length * 46)}
            onEvents={eventosRanking}
            ariaLabel="Ranking de zonas por porcentaje de smog"
          />
          <ul className={cx('mt-3 divide-y text-sm', s.dark ? 'divide-pres-border' : 'divide-neutral-border')}>
            {zonas
              .slice()
              .sort((a, b) => b.pct_smog - a.pct_smog)
              .slice(0, active ? 3 : 6)
              .map((z) => (
                <li key={z.ubicacion_id} className="flex items-center justify-between gap-2 py-2">
                  <button className={cx('truncate text-left hover:underline', s.text)} onClick={() => setSelected(z.ubicacion_id)}>
                    {z.etiqueta || z.nombre}
                    {z.ciudad && <span className={cx('ml-1 text-xs', s.muted)}>· {z.ciudad}</span>}
                  </button>
                  <NivelBadge pct={z.pct_smog} smog={z.smog} size="sm" />
                </li>
              ))}
          </ul>
        </ChartCard>
      </div>
    </SectionWrap>
  );
};

export default MapaSection;
