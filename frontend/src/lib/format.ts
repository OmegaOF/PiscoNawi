// Formateadores en español (Bolivia)
const LOCALE = 'es-BO';

const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return intFmt.format(n);
}

export function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** Porcentaje ya expresado en 0-100. */
export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${fmtNum(n, decimals)} %`;
}

/** Proporción 0-1 mostrada como porcentaje. */
export function fmtPct01(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return fmtPct(n * 100, decimals);
}

/** Fecha local del backend: "YYYY-MM-DD HH:MM:SS" o ISO sin zona. */
export function parseLocal(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha guardada en UTC sin "Z" (reportes_generados.fecha_generado). */
export function parseUtc(s: string | null | undefined): Date | null {
  if (!s) return null;
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(d: Date | string | null | undefined): string {
  const date = typeof d === 'string' ? parseLocal(d) : d;
  if (!date) return '—';
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  const date = typeof d === 'string' ? parseLocal(d) : d;
  if (!date) return '—';
  return date.toLocaleString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Primer día (lunes) de una semana, con la misma convención que usa la base de datos:
 * la semana 01 es la que contiene al 4 de enero, y cada semana empieza en lunes.
 */
function lunesDeSemana(anio: number, semana: number): Date {
  const cuatroEnero = new Date(anio, 0, 4);
  const diaSemana = (cuatroEnero.getDay() + 6) % 7; // 0 = lunes
  const lunesSemana1 = new Date(anio, 0, 4 - diaSemana);
  return new Date(lunesSemana1.getFullYear(), lunesSemana1.getMonth(), lunesSemana1.getDate() + (semana - 1) * 7);
}

/** Rango de fechas de una semana, p. ej. "5 – 11 oct 2026". */
export function rangoSemana(periodo: string): string | null {
  const [a, w] = periodo.split('-');
  const anio = Number(a);
  const semana = Number(w);
  if (!Number.isFinite(anio) || !Number.isFinite(semana)) return null;
  const inicio = lunesDeSemana(anio, semana);
  const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
  const mesInicio = MESES[inicio.getMonth()];
  const mesFin = MESES[fin.getMonth()];
  if (inicio.getMonth() === fin.getMonth()) {
    return `${inicio.getDate()} – ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`;
  }
  const anioInicio = inicio.getFullYear() !== fin.getFullYear() ? ` ${inicio.getFullYear()}` : '';
  return `${inicio.getDate()} ${mesInicio}${anioInicio} – ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`;
}

/** Etiqueta legible para un período del backend según la agrupación. */
export function fmtPeriodo(periodo: string, agrupar: 'dia' | 'semana' | 'mes'): string {
  if (agrupar === 'mes') {
    const [y, m] = periodo.split('-');
    return `${MESES[Number(m) - 1] ?? m} ${y}`;
  }
  if (agrupar === 'semana') {
    const [y, w] = periodo.split('-');
    return `Sem ${Number(w)} · ${y}`;
  }
  const d = parseLocal(periodo);
  return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : periodo;
}

/** Etiqueta para tooltips: en semanas añade el rango de fechas entre paréntesis. */
export function fmtPeriodoDetalle(periodo: string, agrupar: 'dia' | 'semana' | 'mes'): string {
  const base = fmtPeriodo(periodo, agrupar);
  if (agrupar !== 'semana') return base;
  const rango = rangoSemana(periodo);
  return rango ? `${base} (${rango})` : base;
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${fmtNum(n / 1024, 1)} KB`;
  return `${fmtNum(n / 1024 / 1024, 1)} MB`;
}

export function timeAgo(d: Date | null): string {
  if (!d) return '—';
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / 86400 / 30), 'month');
  return rtf.format(Math.round(diff / 86400 / 365), 'year');
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // 0 = lunes (igual que el backend)
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function fmtHora(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
