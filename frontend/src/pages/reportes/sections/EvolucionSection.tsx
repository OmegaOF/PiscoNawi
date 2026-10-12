import React, { useState } from 'react';
import { ChartBarIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import EChart from '../../../components/reports/EChart';
import Segmented from '../../../components/reports/Segmented';
import { useSurface } from '../../../components/reports/surface';
import { useChartCtx, usePresentation } from '../../../contexts/PresentationContext';
import { calendarOption, trendOption } from '../../../lib/chartOptions';
import { cx } from '../../../lib/cx';

const EvolucionSection: React.FC<SectionProps> = ({ data, filters }) => {
  const ctx = useChartCtx();
  const s = useSurface();
  const { active } = usePresentation();
  const [modo, setModo] = useState<'area' | 'barras'>('area');
  const [conImagenes, setConImagenes] = useState(false);

  const rows = data.tendencia.data || [];
  const dias = data.tendenciaDiaria.data || [];
  const range: [string, string] | null = dias.length
    ? [filters.desde || dias[0].periodo, filters.hasta || dias[dias.length - 1].periodo]
    : null;
  const spanDays = range ? (new Date(range[1]).getTime() - new Date(range[0]).getTime()) / 86400000 : 0;
  const calendarHeight = range ? Math.max(180, Math.ceil(spanDays / 365 + 0.01) * 170 + 60) : 200;

  return (
    <SectionWrap id="evolucion" subtitle="Cómo cambia la detección de smog a lo largo del tiempo">
      <div className="grid gap-5">
        <ChartCard
          title="Vehículos con y sin smog por período"
          subtitle={`Agrupado por ${filters.agrupar === 'dia' ? 'día' : filters.agrupar}`}
          icon={ChartBarIcon}
          loading={data.tendencia.loading}
          hasData={!!data.tendencia.data}
          error={data.tendencia.error}
          onRetry={data.tendencia.reload}
          empty={!!data.tendencia.data && rows.length === 0}
          emptyText="No hay predicciones en este período."
          minHeight={340}
          actions={
            <div className="flex items-center gap-3 pr-1">
              <label className={cx('hidden cursor-pointer items-center gap-1.5 text-xs sm:flex', s.muted)}>
                <input type="checkbox" checked={conImagenes} onChange={(e) => setConImagenes(e.target.checked)} className="accent-rojo-tinto" />
                Imágenes subidas
              </label>
              <Segmented
                ariaLabel="Tipo de gráfico"
                value={modo}
                onChange={setModo}
                options={[
                  { value: 'area', label: 'Área' },
                  { value: 'barras', label: 'Barras' },
                ]}
              />
            </div>
          }
          help={<p>La línea horizontal marca el promedio de vehículos con smog por período. Arrastra el control inferior para acercar un rango.</p>}
        >
          <EChart
            option={trendOption(rows, conImagenes ? data.tendenciaImagenes.data : null, filters.agrupar, ctx, modo === 'barras')}
            height={active ? 440 : 360}
            ariaLabel="Evolución de vehículos con y sin smog"
          />
        </ChartCard>

        <ChartCard
          title="Calendario de smog"
          subtitle="Porcentaje diario de vehículos con smog"
          icon={CalendarDaysIcon}
          loading={data.tendenciaDiaria.loading}
          hasData={!!data.tendenciaDiaria.data}
          error={data.tendenciaDiaria.error}
          onRetry={data.tendenciaDiaria.reload}
          empty={!range || spanDays > 400}
          emptyText={!range ? 'No hay datos diarios en este rango.' : 'Elige un rango de hasta 12 meses para ver el calendario.'}
          minHeight={180}
          help={<p>Cada celda es un día. Más oscuro = mayor porcentaje de vehículos con smog. Las celdas vacías son días sin capturas.</p>}
        >
          {range && <EChart option={calendarOption(dias, range, ctx)} height={calendarHeight} ariaLabel="Calendario diario de smog" />}
        </ChartCard>
      </div>
    </SectionWrap>
  );
};

export default EvolucionSection;
