import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface HistorialItem {
  imagen_id: number;
  filename_original: string;
  ruta_archivo: string;
  placa_manual: string | null;
  clase_predicha: string | null;
  confianza: number | null;
  p_smog: number | null;
  observacion: string | null;
  fecha_prediccion: string;
}

const HistorialOperador: React.FC = () => {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistorial = async () => {
      try {
        const response = await axios.get<HistorialItem[]>(
          'http://localhost:8000/api/operator/historial-propio'
        );
        setHistorial(response.data);
      } catch (err) {
        setError('No se pudo cargar el historial del operador.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, []);

  const formatNumber = (value: number | null) => {
    if (value === null) return '—';
    return value.toFixed(4);
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Mi Historial de Predicciones</h1>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {loading && <p className="p-6 text-gray-600">Cargando historial...</p>}

          {!loading && error && <p className="p-6 text-red-600">{error}</p>}

          {!loading && !error && historial.length === 0 && (
            <p className="p-6 text-gray-600">No hay historial disponible</p>
          )}

          {!loading && !error && historial.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Archivo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Placa</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Clase</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Confianza</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">P Smog</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Observación</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {historial.map((item) => (
                    <tr key={item.imagen_id}>
                      <td className="px-4 py-3 text-sm text-gray-800">{item.imagen_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <div className="font-medium">{item.filename_original || '—'}</div>
                        <div className="text-xs text-gray-500">{item.ruta_archivo || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">{item.placa_manual || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{item.clase_predicha || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{formatNumber(item.confianza)}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{formatNumber(item.p_smog)}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{item.observacion || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{formatDate(item.fecha_prediccion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistorialOperador;
