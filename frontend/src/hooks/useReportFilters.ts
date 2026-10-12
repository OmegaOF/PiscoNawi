import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Agrupar, ReportFilters } from '../lib/reportsApi';
import { fmtDate, toIsoDate } from '../lib/format';

export type Preset = 'hoy' | '7d' | '30d' | '3m' | '6m' | 'todo';

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: '3m', label: '3 meses' },
  { id: '6m', label: '6 meses' },
  { id: 'todo', label: 'Todo' },
];

const PRESET_AGRUPAR: Record<Preset, Agrupar> = { hoy: 'dia', '7d': 'dia', '30d': 'dia', '3m': 'semana', '6m': 'semana', todo: 'mes' };
const PRESET_LABEL: Record<Preset, string> = {
  hoy: 'el día de hoy',
  '7d': 'los últimos 7 días',
  '30d': 'los últimos 30 días',
  '3m': 'los últimos 3 meses',
  '6m': 'los últimos 6 meses',
  todo: 'todo el historial',
};

export function presetRange(p: Preset, today = new Date()): { desde?: string; hasta?: string } {
  if (p === 'todo') return {};
  const hasta = toIsoDate(today);
  const d = new Date(today);
  if (p === '7d') d.setDate(d.getDate() - 6);
  if (p === '30d') d.setDate(d.getDate() - 29);
  if (p === '3m') d.setMonth(d.getMonth() - 3);
  if (p === '6m') d.setMonth(d.getMonth() - 6);
  return { desde: toIsoDate(d), hasta };
}

function num(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function useReportFilters(defaultPreset: Preset = '6m') {
  const [params, setParams] = useSearchParams();

  const hasAny = ['desde', 'hasta', 'preset', 'agrupar'].some((k) => params.has(k));
  const presetParam = (params.get('preset') as Preset | null) ?? (hasAny ? null : defaultPreset);

  const filters: ReportFilters = useMemo(() => {
    const base = presetParam && !params.get('desde') && !params.get('hasta') ? presetRange(presetParam) : {};
    const agr = (params.get('agrupar') as Agrupar | null) ?? (presetParam ? PRESET_AGRUPAR[presetParam] : 'dia');
    return {
      desde: params.get('desde') || base.desde,
      hasta: params.get('hasta') || base.hasta,
      agrupar: ['dia', 'semana', 'mes'].includes(agr) ? agr : 'dia',
      ubicacion_id: num(params.get('ubicacion_id')),
      dispositivo_id: num(params.get('dispositivo_id')),
    };
  }, [params, presetParam]);

  const write = useCallback(
    (next: Partial<ReportFilters> & { preset?: Preset | null }) => {
      const merged = { ...filters, ...next };
      const p = new URLSearchParams();
      const preset = next.preset !== undefined ? next.preset : presetParam;
      if (preset) p.set('preset', preset);
      if (!preset) {
        if (merged.desde) p.set('desde', merged.desde);
        if (merged.hasta) p.set('hasta', merged.hasta);
      }
      p.set('agrupar', merged.agrupar);
      if (merged.ubicacion_id != null) p.set('ubicacion_id', String(merged.ubicacion_id));
      if (merged.dispositivo_id != null) p.set('dispositivo_id', String(merged.dispositivo_id));
      setParams(p, { replace: true });
    },
    [filters, presetParam, setParams],
  );

  const setFilters = useCallback(
    (patch: Partial<ReportFilters>) => {
      const changesDates = 'desde' in patch || 'hasta' in patch;
      write({ ...patch, preset: changesDates ? null : undefined });
    },
    [write],
  );

  const applyPreset = useCallback(
    (p: Preset) => write({ ...presetRange(p), agrupar: PRESET_AGRUPAR[p], preset: p }),
    [write],
  );

  const rangeLabel = presetParam
    ? PRESET_LABEL[presetParam]
    : filters.desde || filters.hasta
      ? `el período ${fmtDate(filters.desde || null)} – ${fmtDate(filters.hasta || null)}`
      : 'todo el historial';

  return { filters, preset: presetParam, setFilters, applyPreset, rangeLabel };
}
