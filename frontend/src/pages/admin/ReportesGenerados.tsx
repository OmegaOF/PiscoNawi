import React, { useEffect, useState } from 'react';
import api from '../../lib/api';

interface ReporteGeneradoResponse {
  id: number;
  nombre_reporte: string;
  fecha_generado?: string | null;
  usuario_id: number;
  ruta_archivo: string;
}

const ReportesGenerados: React.FC = () => {
  const [items, setItems] = useState<ReporteGeneradoResponse[]>([]);
  const [selected, setSelected] = useState<ReporteGeneradoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({ tipo_reporte: 'reporte_general', desde: '', hasta: '', agrupar: 'dia' });

  const requiereAgrupacion = (tipoReporte: string) => {
    return ['reporte_general', 'cambios_tiempo', 'detallado'].includes(tipoReporte);
  };

  const load = async () => {
    try {
      const res = await api.get<ReporteGeneradoResponse[]>('/reportes-generados');
      setItems(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar reportes generados');
    }
  };

  useEffect(() => { load(); }, []);

  const exportPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true);
    setError(null);
    try {
      await api.post('/reportes-generados/exportar-pdf', form);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const verDetalle = async (id: number) => {
    try {
      const res = await api.get<ReporteGeneradoResponse>(`/reportes-generados/${id}`);
      setSelected(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo obtener detalle');
    }
  };

  const descargar = async (id: number) => {
    try {
      const res = await api.get(`/reportes-generados/${id}/descargar`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo descargar PDF');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Reportes Generados (PDF)</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

        <form onSubmit={exportPdf} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid md:grid-cols-5 gap-3">
          <select className="border rounded px-3 py-2" value={form.tipo_reporte} onChange={(e) => setForm({ ...form, tipo_reporte: e.target.value })}>
            <option value="reporte_general">reporte_general</option>
            <option value="cambios_tiempo">cambios_tiempo</option>
            <option value="comparacion">comparacion</option>
            <option value="por_zonas">por_zonas</option>
            <option value="detallado">detallado</option>

          </select>
          <input className="border rounded px-3 py-2" type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
          <input className="border rounded px-3 py-2" type="date" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />         {requiereAgrupacion(form.tipo_reporte) ? (
            <select className="border rounded px-3 py-2" value={form.agrupar} onChange={(e) => setForm({ ...form, agrupar: e.target.value })}>
              <option value="dia">día</option>
              <option value="semana">semana</option>
              <option value="mes">mes</option>
            </select>
          ) : (
            <div className="border rounded px-3 py-2 text-sm text-gray-500 bg-gray-50 flex items-center">
              Sin agrupación para este tipo
            </div>
          )}

          <button className="bg-vino text-white rounded px-4 py-2" disabled={exporting}>{exporting ? 'Exportando...' : 'Exportar PDF'}</button>
        </form>

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">ID</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Reporte</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Fecha</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Usuario</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-sm">{r.id}</td>
                  <td className="px-4 py-2 text-sm">{r.nombre_reporte}</td>
                  <td className="px-4 py-2 text-sm">{r.fecha_generado || '—'}</td>
                  <td className="px-4 py-2 text-sm">{r.usuario_id}</td>
                  <td className="px-4 py-2 text-sm flex gap-2">
                    <button className="border rounded px-2 py-1" onClick={() => verDetalle(r.id)}>Detalle</button>
                    <button className="bg-vino text-white rounded px-2 py-1" onClick={() => descargar(r.id)}>Descargar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="font-semibold text-vino mb-2">Detalle reporte #{selected.id}</h2>
            <p><strong>Nombre:</strong> {selected.nombre_reporte}</p>
            <p><strong>Fecha:</strong> {selected.fecha_generado || '—'}</p>
            <p><strong>Usuario:</strong> {selected.usuario_id}</p>
            <p><strong>Ruta archivo:</strong> {selected.ruta_archivo}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportesGenerados;
