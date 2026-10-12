import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EstadoPlaca, PlacasListParams } from '../lib/placasApi';
import { Preset, presetRange } from './useReportFilters';

function num(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const ESTADOS: EstadoPlaca[] = ['sin_placa', 'con_placa', 'todas'];

/** Estado de filtros sincronizado con la URL (las escrituras combinan, no reemplazan). */
export function usePlacasFilters() {
  const [params, setParams] = useSearchParams();

  const estadoRaw = params.get('estado') as EstadoPlaca | null;
  const estado: EstadoPlaca = estadoRaw && ESTADOS.includes(estadoRaw) ? estadoRaw : 'sin_placa';
  const soloSmog = params.get('clase') !== 'todas';
  const q = params.get('q') || '';
  const preset = (params.get('preset') as Preset | null) ?? (params.has('desde') || params.has('hasta') ? null : 'todo');
  const rango = preset ? presetRange(preset) : { desde: params.get('desde') || undefined, hasta: params.get('hasta') || undefined };
  const ubicacion_id = num(params.get('ubicacion_id'));
  const dispositivo_id = num(params.get('dispositivo_id'));
  const page = Math.max(1, num(params.get('page')) || 1);
  const imagenId = num(params.get('imagen'));

  const listParams: PlacasListParams = useMemo(
    () => ({
      estado,
      clase: soloSmog ? 'smog' : 'todas',
      q: q || undefined,
      desde: rango.desde,
      hasta: rango.hasta,
      ubicacion_id,
      dispositivo_id,
      page,
    }),
    [estado, soloSmog, q, rango.desde, rango.hasta, ubicacion_id, dispositivo_id, page],
  );

  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, resetPage = true) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? p.delete(k) : p.set(k, String(v))));
          if (resetPage && !('page' in patch)) p.delete('page');
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setPreset = useCallback((p: Preset) => set({ preset: p, desde: null, hasta: null }), [set]);
  const limpiar = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  return { listParams, estado, soloSmog, q, preset, rango, ubicacion_id, dispositivo_id, page, imagenId, set, setPreset, limpiar };
}
