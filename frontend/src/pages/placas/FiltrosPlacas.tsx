import React, { useEffect, useState } from 'react';
import { ArrowPathIcon, FireIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Segmented from '../../components/reports/Segmented';
import { EstadoPlaca, OpcionFiltro } from '../../lib/placasApi';
import { PRESETS, Preset } from '../../hooks/useReportFilters';
import { cx } from '../../lib/cx';

interface Props {
  estado: EstadoPlaca;
  soloSmog: boolean;
  q: string;
  preset: Preset | null;
  ubicacionId?: number;
  dispositivoId?: number;
  zonas: OpcionFiltro[];
  dispositivos: OpcionFiltro[];
  loading: boolean;
  onSet: (patch: Record<string, string | number | null | undefined>) => void;
  onPreset: (p: Preset) => void;
  onReload: () => void;
}

const inputCls =
  'h-9 rounded-lg border border-neutral-border bg-white px-2.5 text-sm text-text-dark focus:border-rojo-tinto focus:outline-none focus:ring-2 focus:ring-rojo-tinto/20';

const FiltrosPlacas: React.FC<Props> = ({ estado, soloSmog, q, preset, ubicacionId, dispositivoId, zonas, dispositivos, loading, onSet, onPreset, onReload }) => {
  const [texto, setTexto] = useState(q);
  useEffect(() => setTexto(q), [q]);
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => onSet({ q: texto.toUpperCase().replace(/[\s-]/g, '') || null }), 250);
    return () => clearTimeout(t);
  }, [texto, q, onSet]);

  return (
    <div className="-mx-4 mb-5 border-b border-neutral-border/70 bg-neutral-bg/85 px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border sm:shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <Segmented<EstadoPlaca>
          size="md"
          ariaLabel="Estado de la placa"
          value={estado}
          onChange={(v) => onSet({ estado: v === 'sin_placa' ? null : v })}
          options={[
            { value: 'sin_placa', label: 'Sin placa' },
            { value: 'con_placa', label: 'Con placa' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
        <button
          type="button"
          aria-pressed={soloSmog}
          onClick={() => onSet({ clase: soloSmog ? 'todas' : null })}
          className={cx(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
            soloSmog ? 'bg-rojo-tinto text-white shadow-sm' : 'bg-white text-text-dark ring-1 ring-neutral-border hover:ring-rojo-tinto/40',
          )}
        >
          <FireIcon className="h-4 w-4" /> Solo con smog
        </button>
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value.toUpperCase())}
            placeholder="Buscar placa…"
            aria-label="Buscar placa"
            className={cx(inputCls, 'w-40 pl-8 font-mono uppercase tracking-wider')}
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                preset === p.id ? 'bg-vino text-white' : 'bg-white text-text-dark ring-1 ring-neutral-border hover:ring-vino/40',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Zona"
          value={ubicacionId ?? ''}
          onChange={(e) => onSet({ ubicacion_id: e.target.value || null })}
          className={cx(inputCls, 'max-w-[190px]')}
        >
          <option value="">Todas las zonas</option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Dispositivo"
          value={dispositivoId ?? ''}
          onChange={(e) => onSet({ dispositivo_id: e.target.value || null })}
          className={cx(inputCls, 'max-w-[190px]')}
        >
          <option value="">Todos los dispositivos</option>
          {dispositivos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onReload}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white text-text-muted ring-1 ring-neutral-border hover:text-rojo-tinto"
          aria-label="Actualizar lista"
          title="Actualizar"
        >
          <ArrowPathIcon className={cx('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
};

export default FiltrosPlacas;
