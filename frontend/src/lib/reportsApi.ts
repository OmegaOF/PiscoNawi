import api from './api';

export type Agrupar = 'dia' | 'semana' | 'mes';

export interface ReportFilters {
  desde?: string;
  hasta?: string;
  agrupar: Agrupar;
  ubicacion_id?: number;
  dispositivo_id?: number;
}

export function toParams(f: ReportFilters, withAgrupar = false): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (f.desde) p.desde = f.desde;
  if (f.hasta) p.hasta = f.hasta;
  if (f.ubicacion_id != null) p.ubicacion_id = f.ubicacion_id;
  if (f.dispositivo_id != null) p.dispositivo_id = f.dispositivo_id;
  if (withAgrupar) p.agrupar = f.agrupar;
  return p;
}

export interface Kpis {
  total_imagenes: number;
  total_predicciones: number;
  pct_smog: number;
  confianza_promedio: number;
  ubicaciones_activas: number;
  usuarios_activos: number;
  total_smog?: number;
}
export interface Comparativa {
  periodo_actual: { desde: string; hasta: string; dias: number };
  periodo_anterior: { desde: string; hasta: string; dias: number };
  actual: Kpis;
  anterior: Kpis;
  delta_abs: Partial<Record<keyof Kpis, number>>;
  delta_pct: Partial<Record<keyof Kpis, number | null>>;
}
export interface ClaseItem { clase: string; cantidad: number }
export interface TendenciaItem { periodo: string; total: number; smog: number; sin_smog: number }
export interface Bucket { rango: string; cantidad: number }
export interface ScatterPoint { p_smog: number; confianza: number; clase: string }
export interface HeatCell { dia_semana: number; hora: number; total: number; smog: number; pct_smog: number }
export interface ZonaItem {
  ubicacion_id: number;
  nombre: string | null;
  latitud: number;
  longitud: number;
  total: number;
  smog: number;
  sin_smog: number;
  pct_smog: number;
  etiqueta?: string | null;
  direccion?: string | null;
  departamento?: string | null;
  ciudad?: string | null;
  nivel?: string;
  p_smog_promedio?: number;
}
export interface DispositivoItem {
  dispositivo_id: number;
  nombre_dispositivo: string;
  tipo_dispositivo?: string | null;
  activo?: boolean | null;
  total: number;
  smog: number;
  sin_smog: number;
  pct_smog: number;
  p_smog_promedio: number;
  nivel?: string;
}
export interface UsuarioItem {
  usuario_id: number;
  nombre: string;
  username: string;
  total_imagenes: number;
  total_predicciones: number;
  smog?: number;
  sin_smog?: number;
  pct_smog?: number;
}
export interface CapturaTop {
  imagen_id: number;
  ruta_archivo: string;
  placa_manual: string | null;
  p_smog: number;
  confianza: number;
  clase_predicha: string;
  fecha_prediccion: string | null;
  ubicacion_id?: number | null;
  ubicacion_nombre: string | null;
}
export interface PlacaItem { placa: string; total: number; smog: number; sin_smog?: number; pct_smog: number; ultima_fecha: string | null }
export interface TablaRow {
  periodo: string;
  total_predicciones: number;
  total_smog: number;
  pct_smog: number;
  confianza_promedio: number;
  p_smog_promedio: number;
}
export interface DispositivoCatalogo { id: number; nombre_dispositivo: string; tipo_dispositivo?: string | null; activo?: boolean | null }

export interface ReporteGenerado {
  id: number;
  nombre_reporte: string;
  fecha_generado?: string | null;
  usuario_id?: number | null;
  ruta_archivo?: string | null;
  usuario_nombre?: string | null;
  usuario_username?: string | null;
  tipo_reporte?: string;
  tipo_reporte_label?: string;
  tamano_bytes?: number | null;
  existe_archivo?: boolean;
  desde?: string | null;
  hasta?: string | null;
  agrupar?: string | null;
  total_registros?: number | null;
}
export interface ExportResult { reporte_generado: ReporteGenerado; total_registros_exportados: number }

const R = '/reports';
const get = <T,>(url: string, params?: Record<string, string | number>) => api.get<T>(url, { params }).then((r) => r.data);

export const reportsApi = {
  kpis: (f: ReportFilters) => get<Kpis>(`${R}/kpis`, toParams(f)),
  comparativa: (f: ReportFilters) => get<Comparativa>(`${R}/comparativa-periodos`, toParams(f)),
  clasePredicha: (f: ReportFilters) => get<ClaseItem[]>(`${R}/clase-predicha`, toParams(f)),
  tendencia: (f: ReportFilters) => get<TendenciaItem[]>(`${R}/tendencia-predicciones`, toParams(f, true)),
  tendenciaDiaria: (f: ReportFilters) => get<TendenciaItem[]>(`${R}/tendencia-predicciones`, { ...toParams(f), agrupar: 'dia' }),
  tendenciaImagenes: (f: ReportFilters) => get<TendenciaItem[]>(`${R}/tendencia-imagenes`, toParams(f, true)),
  distConfianza: (f: ReportFilters) => get<Bucket[]>(`${R}/distribucion-confianza`, toParams(f)),
  distPSmog: (f: ReportFilters) => get<Bucket[]>(`${R}/distribucion-p-smog`, toParams(f)),
  scatter: (f: ReportFilters) => get<ScatterPoint[]>(`${R}/scatter-confianza`, toParams(f)),
  heatmap: (f: ReportFilters) => get<HeatCell[]>(`${R}/heatmap-horas`, toParams(f)),
  porUbicacion: (f: ReportFilters) => get<ZonaItem[]>(`${R}/por-ubicacion`, toParams(f)),
  porDispositivo: (f: ReportFilters) => get<DispositivoItem[]>(`${R}/por-dispositivo`, toParams(f)),
  porUsuario: (f: ReportFilters) => get<UsuarioItem[]>(`${R}/por-usuario`, toParams(f)),
  topCapturas: (f: ReportFilters, limit = 12) => get<CapturaTop[]>(`${R}/top-capturas`, { ...toParams(f), limit, orden: 'p_smog' }),
  placas: (f: ReportFilters, limit = 20) => get<PlacaItem[]>(`${R}/placas-reincidentes`, { ...toParams(f), limit }),
  tablaResumen: (f: ReportFilters) => get<TablaRow[]>(`${R}/tabla-resumen`, toParams(f, true)),
  zonasCatalogo: () => get<ZonaItem[]>(`${R}/por-ubicacion`),
  dispositivos: () => get<DispositivoCatalogo[]>('/dispositivos'),
};

export const reportesGeneradosApi = {
  list: () => get<ReporteGenerado[]>('/reportes-generados'),
  exportar: (body: { tipo_reporte: string; desde?: string; hasta?: string; agrupar?: string }) =>
    api.post<ExportResult>('/reportes-generados/exportar-pdf', body).then((r) => r.data),
  descargarBlob: (id: number) =>
    api
      .get(`/reportes-generados/${id}/descargar`, { responseType: 'blob' })
      .then((r) => new Blob([r.data], { type: 'application/pdf' })),
  eliminar: (id: number) => api.delete(`/reportes-generados/${id}`).then((r) => r.data),
};

export function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (err?.message === 'Network Error') return 'No se pudo conectar con el servidor';
  return fallback;
}
