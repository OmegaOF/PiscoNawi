import React, { useMemo } from 'react';
import { ClockIcon, FireIcon, SunIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import EChart from '../../../components/reports/EChart';
import { useSurface } from '../../../components/reports/surface';
import { useChartCtx, usePresentation } from '../../../contexts/PresentationContext';
import { hourHeatmapOption } from '../../../lib/chartOptions';
import { DIAS_LARGOS, fmtHora, fmtInt, fmtPct } from '../../../lib/format';
import { HeatCell } from '../../../lib/reportsApi';
import { MIN_MUESTRA_FRANJA } from '../../../lib/smog';
import { cx } from '../../../lib/cx';

// Mismo criterio de muestra mínima que usa la conclusión automática.
const MIN = MIN_MUESTRA_FRANJA;

const PatronHorarioSection: React.FC<SectionProps> = ({ data }) => {
  const ctx = useChartCtx();
  const s = useSurface();
  const { active } = usePresentation();
  const cells = useMemo(() => data.heatmap.data || [], [data.heatmap.data]);
  const total = cells.reduce((a, c) => a + c.total, 0);

  const { pico, limpia, horaPico } = useMemo(() => {
    const valid = cells.filter((c) => c.total >= MIN);
    const pick = (cmp: (a: HeatCell, b: HeatCell) => boolean) => (valid.length ? valid.reduce((a, b) => (cmp(b, a) ? b : a)) : null);
    const porHora = new Map<number, { t: number; s: number }>();
    cells.forEach((c) => {
      const v = porHora.get(c.hora) || { t: 0, s: 0 };
      v.t += c.total;
      v.s += c.smog;
      porHora.set(c.hora, v);
    });
    let hp: { hora: number; t: number } | null = null;
    porHora.forEach((v, h) => {
      if (!hp || v.t > hp.t) hp = { hora: h, t: v.t };
    });
    return {
      pico: pick((a, b) => a.pct_smog > b.pct_smog || (a.pct_smog === b.pct_smog && a.total > b.total)),
      // Ante varias franjas igual de limpias gana la que tiene más registros: más evidencia.
      limpia: pick((a, b) => a.pct_smog < b.pct_smog || (a.pct_smog === b.pct_smog && a.total > b.total)),
      horaPico: hp as { hora: number; t: number } | null,
    };
  }, [cells]);

  const Callout: React.FC<{ icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; title: string; tone: string; children: React.ReactNode }> = ({ icon: Icon, title, tone, children }) => (
    <div className={cx('rounded-2xl border p-5', s.card)}>
      <div className="flex items-center gap-2">
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <p className={cx('text-xs font-semibold uppercase tracking-wide', s.muted)}>{title}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );

  return (
    <SectionWrap id="horario" subtitle="Qué días y horas presentan más vehículos con smog">
      <div className="grid gap-5 lg:grid-cols-4">
        <ChartCard
          className="lg:col-span-3"
          title="Mapa de calor día × hora"
          subtitle="Porcentaje de vehículos con smog en cada franja"
          icon={ClockIcon}
          loading={data.heatmap.loading}
          hasData={!!data.heatmap.data}
          error={data.heatmap.error}
          onRetry={data.heatmap.reload}
          empty={!!data.heatmap.data && total === 0}
          emptyText="Sin datos horarios en este rango."
          minHeight={320}
          help={<p>Cada celda combina un día de la semana y una hora. Más oscuro = mayor porcentaje con smog. Pasa el cursor para ver la cantidad de vehículos.</p>}
        >
          <EChart option={hourHeatmapOption(cells, ctx)} height={active ? 420 : 330} ariaLabel="Mapa de calor por día y hora" />
        </ChartCard>

        <div className="flex flex-col gap-5">
          <Callout icon={FireIcon} title="Momento más crítico" tone="bg-smog-alto/15 text-smog-alto">
            {pico ? (
              <>
                <p className={cx('text-2xl font-bold capitalize', s.text)}>
                  {DIAS_LARGOS[pico.dia_semana]} {fmtHora(pico.hora)}
                </p>
                <p className={cx('text-sm', s.muted)}>
                  {fmtPct(pico.pct_smog, 0)} con smog · {fmtInt(pico.total)} vehículos
                </p>
              </>
            ) : (
              <p className={cx('text-sm', s.muted)}>Datos insuficientes</p>
            )}
          </Callout>
          <Callout icon={SunIcon} title="Momento más limpio" tone="bg-smog-bajo/15 text-smog-bajo">
            {limpia ? (
              <>
                <p className={cx('text-2xl font-bold capitalize', s.text)}>
                  {DIAS_LARGOS[limpia.dia_semana]} {fmtHora(limpia.hora)}
                </p>
                <p className={cx('text-sm', s.muted)}>
                  {fmtPct(limpia.pct_smog, 0)} con smog · {fmtInt(limpia.total)} vehículos
                </p>
              </>
            ) : (
              <p className={cx('text-sm', s.muted)}>Datos insuficientes</p>
            )}
          </Callout>
          <Callout icon={ClockIcon} title="Hora de mayor tráfico" tone={s.chip}>
            {horaPico && horaPico.t > 0 ? (
              <>
                <p className={cx('text-2xl font-bold', s.text)}>{fmtHora(horaPico.hora)}</p>
                <p className={cx('text-sm', s.muted)}>{fmtInt(horaPico.t)} vehículos analizados</p>
              </>
            ) : (
              <p className={cx('text-sm', s.muted)}>Datos insuficientes</p>
            )}
          </Callout>
        </div>
      </div>
    </SectionWrap>
  );
};

export default PatronHorarioSection;
