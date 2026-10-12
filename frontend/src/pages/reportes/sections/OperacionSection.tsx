import React from 'react';
import { CameraIcon, UsersIcon } from '@heroicons/react/24/outline';
import SectionWrap from './SectionWrap';
import { SectionProps } from './types';
import ChartCard from '../../../components/reports/ChartCard';
import EChart from '../../../components/reports/EChart';
import { useSurface } from '../../../components/reports/surface';
import { useChartCtx, usePresentation } from '../../../contexts/PresentationContext';
import { dispToRank, operatorsOption, rankingBarOption } from '../../../lib/chartOptions';
import { fmtInt, fmtPct01 } from '../../../lib/format';
import { cx } from '../../../lib/cx';

const OperacionSection: React.FC<SectionProps> = ({ data }) => {
  const ctx = useChartCtx();
  const s = useSurface();
  const { active } = usePresentation();
  const disp = data.dispositivos.data || [];
  const conDatos = disp.filter((d) => d.total > 0);
  const users = (data.usuarios.data || []).filter((u) => u.total_predicciones > 0);

  return (
    <SectionWrap id="operacion" subtitle="Rendimiento por cámara y actividad de los operadores">
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Smog detectado por dispositivo"
          subtitle="Porcentaje de vehículos con smog por cámara"
          icon={CameraIcon}
          loading={data.dispositivos.loading}
          hasData={!!data.dispositivos.data}
          error={data.dispositivos.error}
          onRetry={data.dispositivos.reload}
          empty={!!data.dispositivos.data && conDatos.length === 0}
          emptyText="Sin actividad de dispositivos en este rango."
          minHeight={260}
        >
          <EChart option={rankingBarOption(conDatos.map(dispToRank), ctx)} height={Math.max(200, conDatos.length * 48)} ariaLabel="Smog por dispositivo" />
          <table className="mt-3 min-w-full text-sm">
            <thead>
              <tr className={cx('text-left text-xs uppercase tracking-wide', s.muted)}>
                <th className="py-1.5 font-medium">Dispositivo</th>
                <th className="py-1.5 font-medium">Tipo</th>
                <th className="py-1.5 font-medium">Estado</th>
                <th className="py-1.5 text-right font-medium">Vehículos</th>
                <th className="py-1.5 text-right font-medium">p_smog prom.</th>
              </tr>
            </thead>
            <tbody className={cx('divide-y', s.dark ? 'divide-pres-border' : 'divide-neutral-border')}>
              {disp.slice(0, active ? 4 : disp.length).map((d) => (
                <tr key={d.dispositivo_id}>
                  <td className="truncate py-1.5 pr-2">{d.nombre_dispositivo}</td>
                  <td className={cx('py-1.5 pr-2 text-xs', s.muted)}>{d.tipo_dispositivo || '—'}</td>
                  <td className="py-1.5 pr-2">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={cx('h-2 w-2 rounded-full', d.activo ? 'bg-smog-bajo' : 'bg-smog-sin')} />
                      {d.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtInt(d.total)}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.total ? fmtPct01(d.p_smog_promedio, 0) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        <ChartCard
          title="Actividad por operador"
          subtitle="Predicciones con y sin smog por usuario · etiqueta = % con smog"
          icon={UsersIcon}
          loading={data.usuarios.loading}
          hasData={!!data.usuarios.data}
          error={data.usuarios.error}
          onRetry={data.usuarios.reload}
          empty={!!data.usuarios.data && users.length === 0}
          emptyText="Sin actividad de operadores en este rango."
          minHeight={260}
        >
          <EChart option={operatorsOption(users, ctx)} height={Math.max(240, users.length * 52 + 40)} ariaLabel="Actividad por operador" />
        </ChartCard>
      </div>
    </SectionWrap>
  );
};

export default OperacionSection;
