import api from './api';

export type EstadoPlaca = 'sin_placa' | 'con_placa' | 'todas';
export type ClasePlaca = 'smog' | 'sin_smog' | 'todas';

export interface VehiculoPlaca {
  imagen_id: number;
  ruta_archivo: string;
  filename_original: string;
  placa_manual: string | null;
  clase_predicha: string | null;
  confianza: number;
  fecha_prediccion: string | null;
  ubicacion_id: number | null;
  ubicacion_nombre: string | null;
  dispositivo_id: number | null;
  dispositivo_nombre: string | null;
  usuario_nombre: string | null;
  observacion: string | null;
}

export interface ResumenPlacas {
  total: number;
  con_placa: number;
  sin_placa: number;
  pct_completado: number;
}

export interface VehiculosPlacaResponse {
  items: VehiculoPlaca[];
  total: number;
  page: number;
  size: number;
  resumen: ResumenPlacas;
}

export interface PlacasListParams {
  estado?: EstadoPlaca;
  clase?: ClasePlaca;
  q?: string;
  orden?: 'fecha' | 'confianza';
  page?: number;
  size?: number;
  desde?: string;
  hasta?: string;
  ubicacion_id?: number;
  dispositivo_id?: number;
}

export interface OpcionFiltro {
  id: number;
  nombre: string;
}

export const PLACA_REGEX = /^\d{3,4}[A-Z]{3}$/;
export const PLACA_MAX = 20;

/** Mayúsculas, sin espacios ni guiones (igual que el backend). */
export function normalizarPlaca(s: string): string {
  return s.toUpperCase().replace(/[\s-]/g, '').slice(0, PLACA_MAX);
}

export function esFormatoBoliviano(s: string): boolean {
  return PLACA_REGEX.test(s);
}

function limpiarParams(p: PlacasListParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v as string | number;
  });
  return out;
}

export const placasApi = {
  list: (p: PlacasListParams) =>
    api.get<VehiculosPlacaResponse>('/placas/vehiculos', { params: limpiarParams(p) }).then((r) => r.data),
  get: (id: number) => api.get<VehiculoPlaca>(`/placas/vehiculos/${id}`).then((r) => r.data),
  update: (id: number, placa: string | null) =>
    api.put<VehiculoPlaca & { formato_valido: boolean }>(`/placas/${id}`, { placa }).then((r) => r.data),
  filtros: () =>
    api.get<{ zonas: OpcionFiltro[]; dispositivos: OpcionFiltro[] }>('/placas/filtros').then((r) => r.data),
};
