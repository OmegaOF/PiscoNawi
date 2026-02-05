import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = 'http://localhost:8000/api/reports';

interface KPIs {
  total_imagenes: number;
  total_predicciones: number;
  pct_smog: number;
  confianza_promedio: number;
  ubicaciones_activas: number;
  usuarios_activos: number;
}

interface ClasePredichaItem {
  clase: string;
  cantidad: number;
}

interface TendenciaItem {
  periodo: string;
  total: number;
  smog: number;
  sin_smog: number;
}

interface HistogramBucket {
  rango: string;
  cantidad: number;
}

interface PorUbicacionItem {
  ubicacion_id: number;
  nombre: string | null;
  latitud: number;
  longitud: number;
  total: number;
  smog: number;
  sin_smog: number;
  pct_smog: number;
}

interface PorUsuarioItem {
  usuario_id: number;
  nombre: string;
  username: string;
  total_imagenes: number;
  total_predicciones: number;
}

interface TablaResumenRow {
  periodo: string;
  total_predicciones: number;
  total_smog: number;
  pct_smog: number;
  confianza_promedio: number;
  p_smog_promedio: number;
}

const COLORS = ['#7A1E2B', '#2d5a27', '#C6B38E', '#6B1F2B', '#1E1E1E'];

function getSmogColor(pct: number): string {
  if (pct >= 70) return '#7A1E2B';
  if (pct >= 40) return '#b45309';
  return '#2d5a27';
}

const Reportes: React.FC = () => {
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');
  const [agrupar, setAgrupar] = useState<'dia' | 'semana' | 'mes'>('dia');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [clasePredicha, setClasePredicha] = useState<ClasePredichaItem[]>([]);
  const [tendenciaPredicciones, setTendenciaPredicciones] = useState<TendenciaItem[]>([]);
  const [tendenciaImagenes, setTendenciaImagenes] = useState<TendenciaItem[]>([]);
  const [distribucionConfianza, setDistribucionConfianza] = useState<HistogramBucket[]>([]);
  const [distribucionPSmog, setDistribucionPSmog] = useState<HistogramBucket[]>([]);
  const [porUbicacion, setPorUbicacion] = useState<PorUbicacionItem[]>([]);
  const [porUsuario, setPorUsuario] = useState<PorUsuarioItem[]>([]);
  const [tablaResumen, setTablaResumen] = useState<TablaResumenRow[]>([]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { agrupar };
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;

    try {
      const [
        kpisRes,
        claseRes,
        tendPredRes,
        tendImgRes,
        distConfRes,
        distSmogRes,
        ubicRes,
        userRes,
        tablaRes,
      ] = await Promise.all([
        axios.get<KPIs>(`${API_BASE}/kpis`),
        axios.get<ClasePredichaItem[]>(`${API_BASE}/clase-predicha`),
        axios.get<TendenciaItem[]>(`${API_BASE}/tendencia-predicciones`, { params }),
        axios.get<TendenciaItem[]>(`${API_BASE}/tendencia-imagenes`, { params }),
        axios.get<HistogramBucket[]>(`${API_BASE}/distribucion-confianza`),
        axios.get<HistogramBucket[]>(`${API_BASE}/distribucion-p-smog`),
        axios.get<PorUbicacionItem[]>(`${API_BASE}/por-ubicacion`),
        axios.get<PorUsuarioItem[]>(`${API_BASE}/por-usuario`),
        axios.get<TablaResumenRow[]>(`${API_BASE}/tabla-resumen`, { params }),
      ]);

      setKpis(kpisRes.data);
      setClasePredicha(claseRes.data);
      setTendenciaPredicciones(tendPredRes.data);
      setTendenciaImagenes(tendImgRes.data);
      setDistribucionConfianza(distConfRes.data);
      setDistribucionPSmog(distSmogRes.data);
      setPorUbicacion(ubicRes.data);
      setPorUsuario(userRes.data);
      setTablaResumen(tablaRes.data);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail || err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, agrupar]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading && !kpis) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rojo-tinto mx-auto" />
          <p className="text-gray-500 mt-4">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error al cargar reportes: {error}
        </div>
      </div>
    );
  }

  const gaugeData = kpis
    ? [{ name: 'Smog', value: kpis.pct_smog, fill: getSmogColor(kpis.pct_smog) }]
    : [];

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Reportes y Gráficos</h1>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agrupar por</label>
            <select
              value={agrupar}
              onChange={(e) => setAgrupar(e.target.value as 'dia' | 'semana' | 'mes')}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
            </select>
          </div>
          <button
            onClick={fetchReports}
            className="bg-rojo-tinto text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            Actualizar
          </button>
        </div>

        {/* 1. KPI Cards + Gauge */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Resumen general</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {kpis && (
              <>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase">Total imágenes</p>
                  <p className="text-2xl font-bold text-vino">{kpis.total_imagenes}</p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase">Total predicciones</p>
                  <p className="text-2xl font-bold text-vino">{kpis.total_predicciones}</p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase">% con smog</p>
                  <p className="text-2xl font-bold" style={{ color: getSmogColor(kpis.pct_smog) }}>
                    {kpis.pct_smog.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase">Confianza promedio</p>
                  <p className="text-2xl font-bold text-vino">
                    {(kpis.confianza_promedio * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase">Ubicaciones activas</p>
                  <p className="text-2xl font-bold text-vino">{kpis.ubicaciones_activas}</p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase">Usuarios activos</p>
                  <p className="text-2xl font-bold text-vino">{kpis.usuarios_activos}</p>
                </div>
              </>
            )}
          </div>
          {/* Gauge: % smog */}
          {kpis && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col items-center">
              <p className="text-sm font-medium text-gray-700 mb-2">Tasa global de smog</p>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart
                  innerRadius="60%"
                  outerRadius="100%"
                  data={gaugeData}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar background dataKey="value" cornerRadius={8} />
                  <Tooltip formatter={(value: number | undefined) => [value != null ? `${value.toFixed(1)}%` : '—', 'Smog']} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-3xl font-bold mt-2" style={{ color: getSmogColor(kpis.pct_smog) }}>
                {kpis.pct_smog.toFixed(1)}%
              </p>
            </div>
          )}
        </section>

        {/* 2. Pie + Bar clase predicha */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Emisiones por resultado (clase predicha)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={clasePredicha}
                    dataKey="cantidad"
                    nameKey="clase"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {clasePredicha.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clasePredicha} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="clase" width={80} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#7A1E2B" name="Cantidad" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* 3. Tendencia predicciones: Line/Area + stacked */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Tendencia de predicciones en el tiempo</h2>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={tendenciaPredicciones}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="smog" stackId="1" stroke="#7A1E2B" fill="#7A1E2B" fillOpacity={0.7} name="Smog" />
                <Area type="monotone" dataKey="sin_smog" stackId="1" stroke="#2d5a27" fill="#2d5a27" fillOpacity={0.7} name="Sin smog" />
                <Line type="monotone" dataKey="total" stroke="#1E1E1E" strokeWidth={2} name="Total" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 4. Tendencia imágenes */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Imágenes subidas por período</h2>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tendenciaImagenes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#C6B38E" name="Imágenes" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 5. Histogramas confianza y p_smog */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Distribución del modelo</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Confianza</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={distribucionConfianza}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rango" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#6B1F2B" name="Cantidad" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Probabilidad de smog (p_smog)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={distribucionPSmog}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rango" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#7A1E2B" name="Cantidad" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* 6. Por ubicación: Bar + Map */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Emisiones por ubicación</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={porUbicacion.map((u) => ({
                    ...u,
                    nombre: u.nombre || `Ubicación ${u.ubicacion_id}`,
                  }))}
                  margin={{ bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" angle={-35} textAnchor="end" height={70} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="smog" stackId="a" fill="#7A1E2B" name="Smog" />
                  <Bar dataKey="sin_smog" stackId="a" fill="#2d5a27" name="Sin smog" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              {porUbicacion.length > 0 ? (
                <div className="h-[320px] rounded overflow-hidden">
                  <MapContainer
                    center={[porUbicacion[0].latitud, porUbicacion[0].longitud]}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {porUbicacion.map((u) => (
                      <CircleMarker
                        key={u.ubicacion_id}
                        center={[u.latitud, u.longitud]}
                        radius={8 + Math.min(u.total / 5, 12)}
                        pathOptions={{
                          fillColor: getSmogColor(u.pct_smog),
                          color: '#1E1E1E',
                          weight: 1,
                          fillOpacity: 0.8,
                        }}
                      >
                        <Popup>
                          <strong>{u.nombre || `Ubicación ${u.ubicacion_id}`}</strong>
                          <br />
                          Total: {u.total} | Smog: {u.smog} ({u.pct_smog.toFixed(1)}%)
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-gray-500">
                  No hay datos de ubicaciones
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 7. Por usuario */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Actividad por usuario</h2>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={porUsuario}
                margin={{ bottom: 60 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="nombre" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_imagenes" fill="#C6B38E" name="Imágenes" radius={[0, 4, 4, 0]} />
                <Bar dataKey="total_predicciones" fill="#7A1E2B" name="Predicciones" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 8. Tabla resumen por período */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-vino mb-4">Resumen por período</h2>
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Predicciones</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Smog</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Smog</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Confianza prom.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">p_smog prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tablaResumen.map((row) => (
                  <tr key={row.periodo} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{row.periodo}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.total_predicciones}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.total_smog}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium" style={{ color: getSmogColor(row.pct_smog) }}>
                      {row.pct_smog.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{(row.confianza_promedio * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm text-right">{(row.p_smog_promedio * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tablaResumen.length === 0 && (
              <div className="text-center py-8 text-gray-500">No hay datos para el rango seleccionado.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Reportes;
