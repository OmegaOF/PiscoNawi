import React from 'react';
import { CameraIcon, CpuChipIcon, FireIcon, MapPinIcon, PhotoIcon, UsersIcon, SparklesIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import EChart from '../../../components/reports/EChart';
import KpiCard from '../../../components/reports/KpiCard';
import NivelBadge from '../../../components/reports/NivelBadge';
import { useSurface } from '../../../components/reports/surface';
import { useChartCtx, usePresentation } from '../../../contexts/PresentationContext';
import { gaugeOption } from '../../../lib/chartOptions';
import { buildConclusion, NIVEL_DESC, nivelSmog } from '../../../lib/smog';
import { fmtDate } from '../../../lib/format';
import { cx } from '../../../lib/cx';

const HeroSection: React.FC<SectionProps> = ({ data, filters, rangeLabel }) => {
  const ctx = useChartCtx();
  const s = useSurface();
  const { active } = usePresentation();
  const k = data.kpis.data;
  const comp = data.comparativa.data;
  // Solo mostrar variaciones si el período anterior tiene una muestra mínima
  const compValida = !!comp && comp.anterior.total_predicciones >= 20;
  const d = compValida ? comp!.delta_pct : undefined;
  const dAbs = compValida ? comp!.delta_abs : undefined;
  const nivel = k ? nivelSmog(k.pct_smog, k.total_smog) : 'sin';
  const conclusion = buildConclusion({ kpis: k, zonas: data.zonas.data, heatmap: data.heatmap.data, rangeLabel });
  const comparando = compValida
    ? `vs. ${fmtDate(comp!.periodo_anterior.desde)} – ${fmtDate(comp!.periodo_anterior.hasta)}`
    : undefined;

  return (
    <SectionWrap id="resumen" subtitle={`Indicadores clave para ${rangeLabel}`}>
      <div className="grid gap-5 lg:grid-cols-12">
        <ChartCard
          className="relative overflow-hidden lg:col-span-5"
          title="Tasa global de smog"
          subtitle="Porcentaje de vehículos clasificados con smog"
          icon={FireIcon}
          loading={data.kpis.loading}
          hasData={!!k}
          error={data.kpis.error}
          onRetry={data.kpis.reload}
          empty={!!k && k.total_predicciones === 0}
          emptyText="Aún no hay predicciones en el rango seleccionado."
          minHeight={300}
          help={
            <>
              <p className="mb-2">El medidor muestra qué porcentaje de los vehículos analizados fue clasificado con smog por la red neuronal.</p>
              <p>Verde: hasta 15 % · Ámbar: 15 % a 30 % · Rojo: más de 30 %.</p>
            </>
          }
        >
          {!active && (
            <img src="/art-2.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-6 -right-10 w-64 opacity-[0.07]" />
          )}
          {k && (
            <div className="relative">
              <EChart option={gaugeOption(k.pct_smog, ctx)} height={active ? 340 : 270} ariaLabel={`Medidor: ${k.pct_smog}% de vehículos con smog`} />
              <div className="mt-1 flex flex-col items-center gap-2 text-center">
                <NivelBadge pct={k.pct_smog} smog={k.total_smog} size="lg" />
                <p className={cx('text-xs', s.muted)}>{NIVEL_DESC[nivel]}</p>
              </div>
            </div>
          )}
        </ChartCard>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:col-span-7">
          <KpiCard label="Vehículos analizados" value={k?.total_predicciones} format="int" icon={CpuChipIcon} delta={d?.total_predicciones} goodWhen="neutral" loading={data.kpis.loading} hint={comparando ? 'vs. período anterior' : undefined} />
          <KpiCard
            label="Con smog"
            value={k?.pct_smog}
            format="pct"
            icon={FireIcon}
            delta={dAbs?.pct_smog}
            deltaUnit="pp"
            goodWhen="down"
            loading={data.kpis.loading}
            accentClass="bg-smog-alto/15 text-smog-alto"
          />
          <KpiCard label="Confianza promedio" value={k?.confianza_promedio} format="pct01" icon={SparklesIcon} delta={dAbs?.confianza_promedio != null ? dAbs.confianza_promedio * 100 : null} deltaUnit="pp" goodWhen="up" loading={data.kpis.loading} />
          <KpiCard label="Imágenes subidas" value={k?.total_imagenes} format="int" icon={PhotoIcon} delta={d?.total_imagenes} goodWhen="neutral" loading={data.kpis.loading} />
          <KpiCard label="Zonas activas" value={k?.ubicaciones_activas} format="int" icon={MapPinIcon} delta={d?.ubicaciones_activas} goodWhen="neutral" loading={data.kpis.loading} />
          <KpiCard label="Operadores activos" value={k?.usuarios_activos} format="int" icon={UsersIcon} delta={d?.usuarios_activos} goodWhen="neutral" loading={data.kpis.loading} />

          <div className={cx('col-span-2 flex items-start gap-3 rounded-2xl border p-4 md:col-span-3', s.card)}>
            <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', s.chip)}>
              <CameraIcon className="h-4 w-4" />
            </span>
            <div>
              <p className={cx('text-xs font-semibold uppercase tracking-wide', s.muted)}>Conclusión automática</p>
              {conclusion ? (
                <p className={cx('mt-1 leading-relaxed', active ? 'text-lg' : 'text-sm', s.text)}>{conclusion}</p>
              ) : data.kpis.loading ? (
                <div className="skeleton mt-2 h-4 w-3/4 rounded" />
              ) : (
                <p className={cx('mt-1 text-sm', s.muted)}>No hay datos suficientes para generar una conclusión.</p>
              )}
              {!filters.desde && !filters.hasta ? (
                <p className={cx('mt-1 text-xs', s.muted)}>Elige un rango de fechas para comparar con el período anterior.</p>
              ) : comp && !compValida ? (
                <p className={cx('mt-1 text-xs', s.muted)}>El período anterior no tiene datos suficientes para comparar.</p>
              ) : comparando ? (
                <p className={cx('mt-1 text-xs', s.muted)}>Variaciones calculadas {comparando}.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </SectionWrap>
  );
};

export default HeroSection;
