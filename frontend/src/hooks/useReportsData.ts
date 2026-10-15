import { ReportFilters, reportsApi } from '../lib/reportsApi';
import { useSection } from './useSection';

export function useReportsData(filters: ReportFilters, opts: { topLimit?: number } = {}) {
  const key = JSON.stringify(filters);
  const keyNoGroup = JSON.stringify({ ...filters, agrupar: undefined });
  const topLimit = opts.topLimit ?? 12;
  const conRango = Boolean(filters.desde && filters.hasta);

  const kpis = useSection(() => reportsApi.kpis(filters), keyNoGroup);
  const comparativa = useSection(() => reportsApi.comparativa(filters), keyNoGroup, conRango);
  const clase = useSection(() => reportsApi.clasePredicha(filters), keyNoGroup);
  const tendencia = useSection(() => reportsApi.tendencia(filters), key);
  const tendenciaDiaria = useSection(() => reportsApi.tendenciaDiaria(filters), keyNoGroup);
  const tendenciaImagenes = useSection(() => reportsApi.tendenciaImagenes(filters), key);
  const distConfianza = useSection(() => reportsApi.distConfianza(filters), keyNoGroup);
  const heatmap = useSection(() => reportsApi.heatmap(filters), keyNoGroup);
  const zonas = useSection(() => reportsApi.porUbicacion(filters), keyNoGroup);
  const dispositivos = useSection(() => reportsApi.porDispositivo(filters), keyNoGroup);
  const usuarios = useSection(() => reportsApi.porUsuario(filters), keyNoGroup);
  const topCapturas = useSection(() => reportsApi.topCapturas(filters, topLimit), `${keyNoGroup}|${topLimit}`);
  const placas = useSection(() => reportsApi.placas(filters), keyNoGroup);
  const tabla = useSection(() => reportsApi.tablaResumen(filters), key);

  const all = [kpis, comparativa, clase, tendencia, tendenciaDiaria, tendenciaImagenes, distConfianza, heatmap, zonas, dispositivos, usuarios, topCapturas, placas, tabla];
  const anyLoading = all.some((s) => s.loading);

  return {
    kpis, comparativa, clase, tendencia, tendenciaDiaria, tendenciaImagenes, distConfianza,
    heatmap, zonas, dispositivos, usuarios, topCapturas, placas, tabla, anyLoading,
    reloadAll: () => all.forEach((s) => s.reload()),
  };
}

export type ReportsData = ReturnType<typeof useReportsData>;
