import { DIAS_LARGOS, fmtHora, fmtInt, fmtPct } from './format';
import type { HeatCell, Kpis, ZonaItem } from './reportsApi';

export type Nivel = 'alto' | 'moderado' | 'bajo' | 'sin';

export const UMBRAL_ALTO = 30;
export const UMBRAL_MODERADO = 15;

/**
 * Registros mínimos para que una franja día × hora pueda declararse la más crítica
 * o la más limpia. Con pocas muestras el porcentaje es ruido: 6 de 9 (67 %) no dice
 * más que 35 de 53 (66 %), pero ganaría el desempate por decimales.
 */
export const MIN_MUESTRA_FRANJA = 12;

/** Mismos umbrales que el backend (utils_reportes.nivel_smog). */
export function nivelSmog(pct: number, smog?: number | null): Nivel {
  if (smog != null && smog <= 0) return 'sin';
  if (pct > UMBRAL_ALTO) return 'alto';
  if (pct > UMBRAL_MODERADO) return 'moderado';
  return 'bajo';
}

export function nivelDesdeTexto(n?: string | null): Nivel | null {
  switch ((n || '').toLowerCase()) {
    case 'alto':
      return 'alto';
    case 'moderado':
      return 'moderado';
    case 'bajo':
      return 'bajo';
    case 'sin smog':
      return 'sin';
    default:
      return null;
  }
}

export const NIVEL_LABEL: Record<Nivel, string> = {
  alto: 'Alto',
  moderado: 'Moderado',
  bajo: 'Bajo',
  sin: 'Sin smog',
};

export const NIVEL_DESC: Record<Nivel, string> = {
  alto: 'Más del 30 % de los vehículos presentó smog',
  moderado: 'Entre 15 % y 30 % de los vehículos presentó smog',
  bajo: 'Hasta 15 % de los vehículos presentó smog',
  sin: 'No se detectó smog',
};

export function etiquetaZona(z: Pick<ZonaItem, 'ubicacion_id' | 'etiqueta' | 'direccion' | 'nombre'>): string {
  return z.etiqueta || z.direccion?.split(',')[0] || z.nombre || `Zona ${z.ubicacion_id}`;
}

export interface ConclusionArgs {
  kpis: Kpis | null;
  zonas: ZonaItem[] | null;
  heatmap: HeatCell[] | null;
  rangeLabel: string;
}

/** Frase automática de conclusión para el resumen ejecutivo. */
export function buildConclusion({ kpis, zonas, heatmap, rangeLabel }: ConclusionArgs): string | null {
  if (!kpis || !kpis.total_predicciones) return null;
  const nivel = nivelSmog(kpis.pct_smog, kpis.total_smog);
  const partes: string[] = [];
  partes.push(
    `En ${rangeLabel}, el ${fmtPct(kpis.pct_smog)} de los ${fmtInt(kpis.total_predicciones)} vehículos analizados presentó smog (nivel ${NIVEL_LABEL[nivel].toLowerCase()}).`,
  );
  const zonasValidas = (zonas || []).filter((z) => z.total >= 5);
  if (zonasValidas.length > 1) {
    const peor = zonasValidas.reduce((a, b) => (b.pct_smog > a.pct_smog ? b : a));
    partes.push(`La zona más crítica fue ${etiquetaZona(peor)} (${fmtPct(peor.pct_smog, 0)}).`);
  }
  const celdas = (heatmap || []).filter((c) => c.total >= MIN_MUESTRA_FRANJA);
  if (celdas.length) {
    const pico = celdas.reduce((a, b) => (b.pct_smog > a.pct_smog || (b.pct_smog === a.pct_smog && b.total > a.total) ? b : a));
    partes.push(`El momento con más smog fue el ${DIAS_LARGOS[pico.dia_semana]} a las ${fmtHora(pico.hora)}.`);
  }
  return partes.join(' ');
}
