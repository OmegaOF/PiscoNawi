import React from 'react';
import { BeakerIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import EChart from '../../../components/reports/EChart';
import { useSurface } from '../../../components/reports/surface';
import { useChartCtx, usePresentation } from '../../../contexts/PresentationContext';
import { confianzaHistogramOption } from '../../../lib/chartOptions';
import { fmtInt, fmtPct, fmtPct01 } from '../../../lib/format';
import { cx } from '../../../lib/cx';

/** Por debajo de este valor la predicción se considera poco confiable. */
const CONFIANZA_BAJA = 0.6;

const ModeloSection: React.FC<SectionProps> = ({ data }) => {
  const ctx = useChartCtx();
  const s = useSurface();
  const { active } = usePresentation();
  const clase = data.clase.data || [];
  const smog = clase.find((c) => c.clase === 'smog')?.cantidad ?? 0;
  const sin = clase.find((c) => c.clase === 'sin_smog')?.cantidad ?? 0;
  const otros = clase.filter((c) => c.clase !== 'smog' && c.clase !== 'sin_smog').reduce((a, c) => a + c.cantidad, 0);
  const total = smog + sin + otros;
  const conf = data.distConfianza.data || [];
  const totalConf = conf.reduce((a, b) => a + b.cantidad, 0);
  const bajas = conf.filter((b) => Number(b.rango.split('-')[1]) <= CONFIANZA_BAJA).reduce((a, b) => a + b.cantidad, 0);

  const tiles = [
    { label: 'Con smog', value: fmtInt(smog), sub: total ? fmtPct((smog / total) * 100) : '—', tone: 'text-smog-alto' },
    { label: 'Sin smog', value: fmtInt(sin), sub: total ? fmtPct((sin / total) * 100) : '—', tone: 'text-smog-bajo' },
    { label: 'Confianza promedio', value: fmtPct01(data.kpis.data?.confianza_promedio ?? null), sub: 'seguridad del modelo', tone: s.text },
    {
      label: 'Confianza baja',
      value: fmtInt(bajas),
      sub: totalConf ? `${fmtPct((bajas / totalConf) * 100)} por debajo del 60 %` : '—',
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
      <ChartCard
        title="Distribución de la confianza"
        subtitle="Cantidad de predicciones por rango de confianza"
        icon={ChartBarIcon}
        loading={data.distConfianza.loading}
        hasData={!!data.distConfianza.data}
        error={data.distConfianza.error}
        onRetry={data.distConfianza.reload}
        empty={!!data.distConfianza.data && conf.every((b) => !b.cantidad)}
        minHeight={320}
        help={
          <p>
            El sistema entrega un resultado binario: con smog o sin smog. La <strong>confianza</strong> indica qué tan seguro está el modelo de esa decisión. Las predicciones por
            debajo del 60 % conviene revisarlas a mano.
          </p>
        }
      >
        <EChart option={confianzaHistogramOption(conf, ctx)} height={active ? 420 : 340} ariaLabel="Histograma de confianza" />
      </ChartCard>
      <p className={cx('mt-3 flex items-center gap-1.5 text-xs', s.muted)}>
        <BeakerIcon className="h-4 w-4" /> Clasificación binaria: cada vehículo queda como “con smog” o “sin smog”, acompañado de la confianza de esa decisión.
      </p>
    </SectionWrap>
  );
};

export default ModeloSection;
