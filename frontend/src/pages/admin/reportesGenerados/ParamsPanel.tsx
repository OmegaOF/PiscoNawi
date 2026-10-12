import React from 'react';
import { PRESETS, Preset, presetRange } from '../../../hooks/useReportFilters';
import Segmented from '../../../components/reports/Segmented';
import { Agrupar } from '../../../lib/reportsApi';
import { cx } from '../../../lib/cx';

export interface Params {
  desde: string;
  hasta: string;
  agrupar: Agrupar;
}

interface Props {
  value: Params;
  onChange: (p: Params) => void;
  usaAgrupar: boolean;
}

const inputCls = 'h-10 w-full rounded-lg border border-neutral-border bg-white px-3 text-sm focus:border-rojo-tinto focus:outline-none focus:ring-2 focus:ring-rojo-tinto/20';

const ParamsPanel: React.FC<Props> = ({ value, onChange, usaAgrupar }) => {
  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p.id);
    return (r.desde || '') === value.desde && (r.hasta || '') === value.hasta;
  })?.id;

  const apply = (p: Preset) => {
    const r = presetRange(p);
    onChange({ ...value, desde: r.desde || '', hasta: r.hasta || '' });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Período</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p.id)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activePreset === p.id ? 'bg-rojo-tinto text-white' : 'bg-neutral-bg text-text-dark ring-1 ring-neutral-border hover:ring-rojo-tinto/40',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-text-muted">
            Desde
            <input type="date" className={cx(inputCls, 'mt-1')} value={value.desde} onChange={(e) => onChange({ ...value, desde: e.target.value })} />
          </label>
          <label className="text-xs text-text-muted">
            Hasta
            <input type="date" className={cx(inputCls, 'mt-1')} value={value.hasta} onChange={(e) => onChange({ ...value, hasta: e.target.value })} />
          </label>
        </div>
        {!value.desde && !value.hasta && <p className="mt-2 text-xs text-text-muted">Sin fechas se incluirá todo el historial.</p>}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Agrupación</p>
        {usaAgrupar ? (
          <Segmented<Agrupar>
            size="md"
            ariaLabel="Agrupar por"
            value={value.agrupar}
            onChange={(v) => onChange({ ...value, agrupar: v })}
            options={[
              { value: 'dia', label: 'Día' },
              { value: 'semana', label: 'Semana' },
              { value: 'mes', label: 'Mes' },
            ]}
          />
        ) : (
          <p className="rounded-lg bg-neutral-bg px-3 py-2 text-xs text-text-muted">Este reporte no usa agrupación por período.</p>
        )}
      </div>
    </div>
  );
};

export default ParamsPanel;
