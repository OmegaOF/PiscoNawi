import React from 'react';
import { ArrowDownTrayIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import { useSurface } from '../../../components/reports/surface';
import { usePresentation } from '../../../contexts/PresentationContext';
import { fmtInt, fmtNum, fmtPct, fmtPeriodo } from '../../../lib/format';
import { nivelSmog } from '../../../lib/smog';
import { LEVEL_COLORS } from '../../../lib/chartCtx';
import { cx } from '../../../lib/cx';

const TablaSection: React.FC<SectionProps> = ({ data, filters }) => {
  const s = useSurface();
  const { active } = usePresentation();
  const rows = data.tabla.data || [];
  const shown = active ? rows.slice(-12) : rows;
  const tot = rows.reduce((a, r) => a + r.total_predicciones, 0);
  const smog = rows.reduce((a, r) => a + r.total_smog, 0);
  const conf = tot ? rows.reduce((a, r) => a + r.confianza_promedio * r.total_predicciones, 0) / tot : 0;

  const exportCsv = () => {
    const dec = (n: number, d = 2) => n.toFixed(d).replace('.', ',');
    const lines = [
      ['Período', 'Predicciones', 'Con smog', '% con smog', 'Confianza promedio (%)'].join(';'),
      ...rows.map((r) => [fmtPeriodo(r.periodo, filters.agrupar), r.total_predicciones, r.total_smog, dec(r.pct_smog), dec(r.confianza_promedio * 100)].join(';')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumen_${filters.desde || 'inicio'}_${filters.hasta || 'hoy'}_${filters.agrupar}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide';

  return (
    <SectionWrap id="tabla" subtitle="Detalle numérico por período (equivalente en tabla de los gráficos)">
      <ChartCard
        title="Resumen por período"
        subtitle={`${fmtInt(rows.length)} períodos · agrupado por ${filters.agrupar === 'dia' ? 'día' : filters.agrupar}`}
        icon={TableCellsIcon}
        loading={data.tabla.loading}
        hasData={!!data.tabla.data}
        error={data.tabla.error}
        onRetry={data.tabla.reload}
        empty={!!data.tabla.data && rows.length === 0}
        minHeight={240}
        allowFullscreen={false}
        bodyClassName="px-0 pb-0 pt-3"
        actions={
          rows.length > 0 && (
            <button onClick={exportCsv} className="mr-1 inline-flex items-center gap-1 rounded-lg bg-rojo-tinto px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
              <ArrowDownTrayIcon className="h-4 w-4" /> Exportar CSV
            </button>
          )
        }
      >
        <div className={cx('overflow-auto', active ? 'max-h-[60vh]' : 'max-h-[480px]')}>
          <table className="min-w-full text-sm">
            <thead className={cx('sticky top-0 z-10', s.dark ? 'bg-pres-card' : 'bg-neutral-bg')}>
              <tr className={s.muted}>
                <th className={cx(th, 'text-left')}>Período</th>
                <th className={cx(th, 'text-right')}>Predicciones</th>
                <th className={cx(th, 'text-right')}>Con smog</th>
                <th className={cx(th, 'w-1/4 text-left')}>% con smog</th>
                <th className={cx(th, 'text-right')}>Confianza prom.</th>
              </tr>
            </thead>
            <tbody className={cx('divide-y', s.dark ? 'divide-pres-border' : 'divide-neutral-border')}>
              {shown.map((r) => {
                const color = LEVEL_COLORS[nivelSmog(r.pct_smog, r.total_smog)][s.dark ? 'dark' : 'light'];
                return (
                  <tr key={r.periodo} className={s.hover}>
                    <td className="px-4 py-2.5 font-medium">{fmtPeriodo(r.periodo, filters.agrupar)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(r.total_predicciones)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(r.total_smog)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cx('h-2 flex-1 overflow-hidden rounded-full', s.dark ? 'bg-white/10' : 'bg-neutral-bg')}>
                          <div className="h-full rounded-full" style={{ width: `${r.pct_smog}%`, background: color }} />
                        </div>
                        <span className="w-14 text-right font-semibold tabular-nums" style={{ color }}>
                          {fmtPct(r.pct_smog, 1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(r.confianza_promedio * 100, 1)} %</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className={cx('sticky bottom-0 font-semibold', s.dark ? 'bg-pres-card' : 'bg-neutral-bg')}>
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(tot)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(smog)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtPct(tot ? (smog / tot) * 100 : 0, 1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtNum(conf * 100, 1)} %</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </ChartCard>
    </SectionWrap>
  );
};

export default TablaSection;
