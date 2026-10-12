import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowPathIcon, ChevronDownIcon, DocumentArrowDownIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { Agrupar, DispositivoCatalogo, ReportFilters, ZonaItem } from '../../lib/reportsApi';
import { Preset, PRESETS } from '../../hooks/useReportFilters';
import { etiquetaZona } from '../../lib/smog';
import Segmented from './Segmented';
import PresentationToggle from './PresentationToggle';
import { cx } from '../../lib/cx';

interface FilterBarProps {
  filters: ReportFilters;
  preset: Preset | null;
  onPreset: (p: Preset) => void;
  onChange: (patch: Partial<ReportFilters>) => void;
  zonas: ZonaItem[];
  dispositivos: DispositivoCatalogo[];
  loading?: boolean;
  onReload: () => void;
  exportHref: string;
}

const inputCls = 'h-9 rounded-lg border border-neutral-border bg-white px-2.5 text-sm text-text-dark focus:border-rojo-tinto focus:outline-none focus:ring-2 focus:ring-rojo-tinto/20';

const FilterBar: React.FC<FilterBarProps> = ({ filters, preset, onPreset, onChange, zonas, dispositivos, loading, onReload, exportHref }) => {
  const [abierto, setAbierto] = useState(false);
  const etiqueta = PRESETS.find((p) => p.id === preset)?.label || (filters.desde || filters.hasta ? 'Rango personalizado' : 'Todo');
  return (
  <div className="-mx-4 mb-6 border-b border-neutral-border/70 bg-neutral-bg/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:shadow-sm lg:sticky lg:top-20 lg:z-30">
    <button
      type="button"
      onClick={() => setAbierto((v) => !v)}
      aria-expanded={abierto}
      className="flex w-full items-center justify-between gap-2 text-sm font-medium text-text-dark lg:hidden"
    >
      <span className="flex items-center gap-2">
        <FunnelIcon className="h-4 w-4 text-text-muted" /> Filtros · <span className="text-rojo-tinto">{etiqueta}</span>
      </span>
      <ChevronDownIcon className={cx('h-4 w-4 transition-transform', abierto && 'rotate-180')} />
    </button>
    <div className={cx('flex-wrap items-center gap-x-4 gap-y-3 lg:flex', abierto ? 'mt-3 flex' : 'hidden')}>
      <div className="flex items-center gap-2">
        <FunnelIcon className="hidden h-4 w-4 text-text-muted lg:block" aria-hidden />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Rango rápido">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                preset === p.id ? 'bg-rojo-tinto text-white shadow-sm' : 'bg-white text-text-dark ring-1 ring-neutral-border hover:ring-rojo-tinto/40',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="f-desde">Desde</label>
        <input id="f-desde" type="date" value={filters.desde || ''} onChange={(e) => onChange({ desde: e.target.value || undefined })} className={inputCls} />
        <span className="text-xs text-text-muted">a</span>
        <label className="sr-only" htmlFor="f-hasta">Hasta</label>
        <input id="f-hasta" type="date" value={filters.hasta || ''} onChange={(e) => onChange({ hasta: e.target.value || undefined })} className={inputCls} />
      </div>

      <Segmented<Agrupar>
        ariaLabel="Agrupar por"
        value={filters.agrupar}
        onChange={(v) => onChange({ agrupar: v })}
        options={[
          { value: 'dia', label: 'Día' },
          { value: 'semana', label: 'Semana' },
          { value: 'mes', label: 'Mes' },
        ]}
      />

      <select
        aria-label="Zona"
        value={filters.ubicacion_id ?? ''}
        onChange={(e) => onChange({ ubicacion_id: e.target.value ? Number(e.target.value) : undefined })}
        className={cx(inputCls, 'max-w-[200px]')}
      >
        <option value="">Todas las zonas</option>
        {zonas.map((z) => (
          <option key={z.ubicacion_id} value={z.ubicacion_id}>
            {etiquetaZona(z)}
          </option>
        ))}
      </select>

      <select
        aria-label="Dispositivo"
        value={filters.dispositivo_id ?? ''}
        onChange={(e) => onChange({ dispositivo_id: e.target.value ? Number(e.target.value) : undefined })}
        className={cx(inputCls, 'max-w-[200px]')}
      >
        <option value="">Todos los dispositivos</option>
        {dispositivos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre_dispositivo}
          </option>
        ))}
      </select>

      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
        <button
          type="button"
          onClick={onReload}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-text-muted ring-1 ring-neutral-border hover:text-rojo-tinto"
          aria-label="Actualizar datos"
          title="Actualizar"
        >
          <ArrowPathIcon className={cx('h-4 w-4', loading && 'animate-spin')} />
        </button>
        <Link
          to={exportHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-rojo-tinto ring-1 ring-rojo-tinto/30 hover:bg-rojo-tinto/5"
        >
          <DocumentArrowDownIcon className="h-4 w-4" /> Exportar PDF
        </Link>
        <PresentationToggle />
      </div>
    </div>
  </div>
  );
};

export default FilterBar;
