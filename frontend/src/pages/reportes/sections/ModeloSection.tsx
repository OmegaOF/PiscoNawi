import React from 'react';
import { BeakerIcon, ChartBarIcon, SparklesIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import EChart from '../../../components/reports/EChart';
import { useSurface } from '../../../components/reports/surface';
import { useChartCtx, usePresentation } from '../../../contexts/PresentationContext';
import { histogramGroupedOption, separationOption } from '../../../lib/chartOptions';
import { fmtInt, fmtPct, fmtPct01 } from '../../../lib/format';
import { cx } from '../../../lib/cx';

const ModeloSection: React.FC<SectionProps> = ({ data }) => {
  const ctx = useChartCtx();
  const s = useSurface();
  const { active } = usePresentation();
  const clase = data.clase.data || [];
  const smog = clase.find((c) => c.clase === 'smog')?.cantidad ?? 0;
  const sin = clase.find((c) => c.clase === 'sin_smog')?.cantidad ?? 0;
  const otros = clase.filter((c) => c.clase !== 'smog' && c.clase !== 'sin_smog').reduce((a, c) => a + c.cantidad, 0);
  const total = smog + sin + otros;
  const scatter = data.scatter.data || [];
  const dudosos = scatter.filter((p) => p.p_smog >= 0.45 && p.p_smog < 0.55).length;
  const conf = data.distConfianza.data || [];
  const psmog = data.distPSmog.data || [];

  const tiles = [
    { label: 'Clasificados con smog', value: fmtInt(smog), sub: total ? fmtPct((smog / total) * 100) : '—', tone: 'text-smog-alto' },
    { label: 'Clasificados sin smog', value: fmtInt(sin), sub: total ? fmtPct((sin / total) * 100) : '—', tone: 'text-smog-bajo' },
    { label: 'Confianza promedio', value: fmtPct01(data.kpis.data?.confianza_promedio ?? null), sub: 'seguridad del modelo', tone: s.text },
    {
      label: 'Casos dudosos',
      value: fmtInt(dudosos),
      sub: scatter.length ? `${fmtPct((dudosos / scatter.length) * 100)} con p_smog entre 45 % y 55 %` : '—',
      tone: 'text-smog-moderado',
    },
  ];

  return (
    <SectionWrap id="modelo" subtitle="Cómo se comporta la red neuronal convolucional (CNN)">
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={cx('rounded-2xl border p-4', s.card)}>
            <p className={cx('text-xs font-medium uppercase tracking-wide', s.muted)}>{t.label}</p>
            <p className={cx('mt-2 text-3xl font-bold', t.tone)}>{t.value}</p>
            <p className={cx('mt-1 text-xs', s.muted)}>{t.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Distribución de confianza y probabilidad"
          subtitle="Cantidad de predicciones por rango"
          icon={ChartBarIcon}
          loading={data.distConfianza.loading || data.distPSmog.loading}
          hasData={!!data.distConfianza.data && !!data.distPSmog.data}
          error={data.distConfianza.error || data.distPSmog.error}
          onRetry={() => {
            data.distConfianza.reload();
            data.distPSmog.reload();
          }}
          empty={!!data.distConfianza.data && conf.every((b) => !b.cantidad) && psmog.every((b) => !b.cantidad)}
          minHeight={320}
          help={
            <>
              <p className="mb-2">
                <strong>Confianza</strong>: qué tan seguro está el modelo de la clase que eligió.
              </p>
              <p>
                <strong>p_smog</strong>: probabilidad que el modelo asigna a la clase “smog”. Si es 50 % o más, el vehículo se clasifica con smog.
              </p>
            </>
          }
        >
          <EChart option={histogramGroupedOption(conf, psmog, ctx)} height={active ? 400 : 320} ariaLabel="Histograma de confianza y p_smog" />
        </ChartCard>
        <ChartCard
          title="Separación entre clases"
          subtitle={`Cómo reparte la CNN la probabilidad de smog · ${fmtInt(scatter.length)} predicciones recientes`}
          icon={SparklesIcon}
          loading={data.scatter.loading}
          hasData={!!data.scatter.data}
          error={data.scatter.error}
          onRetry={data.scatter.reload}
          empty={!!data.scatter.data && scatter.length === 0}
          minHeight={320}
          help={
            <p>
              Cada barra agrupa predicciones según la probabilidad de smog que asignó la red. Un buen modelo concentra los casos en los extremos (cerca de 0 % y 100 %). La franja
              central marca los casos dudosos, cercanos al umbral de 50 %.
            </p>
          }
        >
          <EChart option={separationOption(scatter, ctx)} height={active ? 400 : 320} ariaLabel="Histograma de probabilidad de smog por clase" />
        </ChartCard>
      </div>
      <p className={cx('mt-3 flex items-center gap-1.5 text-xs', s.muted)}>
        <BeakerIcon className="h-4 w-4" /> Clasificación binaria: p_smog ≥ 50 % → con smog; confianza = p_smog o 1 − p_smog según la clase.
      </p>
    </SectionWrap>
  );
};

export default ModeloSection;
