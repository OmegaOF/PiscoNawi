import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface AnalisisItem {
  id: number;
  imagen_id: number;
  filename_original: string;
  ruta_archivo: string;
  placa_manual: string | null;
  clase_predicha: string;
  confianza: number;
  p_smog: number;
  observacion: string | null;
  fecha_prediccion: string;
}

interface AnalisisPagina {
  items: AnalisisItem[];
  total: number;
  page: number;
  size: number;
  paginas: number;
}

const POR_PAGINA = 30;

const Analisis: React.FC = () => {
  const [analisisData, setAnalisisData] = useState<AnalisisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);

  useEffect(() => {
    const loadAnalisisData = async () => {
      setLoading(true);
      try {
        const response = await api.get<AnalisisPagina>('/analisis/emisiones', { params: { page, size: POR_PAGINA } });
        setAnalisisData(response.data.items);
        setTotal(response.data.total);
        setPaginas(response.data.paginas);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    loadAnalisisData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const desde = total === 0 ? 0 : (page - 1) * POR_PAGINA + 1;
  const hasta = Math.min(page * POR_PAGINA, total);

  const formatFecha = (s: string) => {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };


  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(2)}%`;
  };

  const formatSmogPercentage = (pSmog: number) => {
    return `${(pSmog * 100).toFixed(2)}%`;
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-8">Ver Resultados de CNN</h1>

        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-vino">Análisis de Vehículos</h2>
            <p className="text-sm text-gray-600 mt-1">
              Tabla combinada de imágenes y predicciones de CNN, de la más reciente a la más antigua.
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vino mx-auto"></div>
                <p className="text-gray-500 mt-4">Cargando datos de análisis...</p>
              </div>
            ) : analisisData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay datos de análisis disponibles.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Imagen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha de análisis
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Placa Manual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clase Predicha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confianza
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prob. de smog
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analisisData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            <img
                              className="h-12 w-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              src={item.ruta_archivo}
                              alt={item.filename_original}
                              onClick={() => setSelectedImage(item.ruta_archivo)}
                              onError={(e) => {
                                // Fallback for file:// protocol issues
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDMTMuMSAyIDE0IDIuOSAxNCA0VjE2QzE0IDE3LjEgMTMuMSAxOCA5LjkgMTlIMTlDMTguMSAxOSAxNyAyMC4xIDE3IDIxVjIyQzE3IDIzLjEgMTYuMSAyNCAxNSAyNEgxN0MxNS44IDI0IDE1IDIzLjEgMTUgMjJWMTlIMTQuOUMxNS44IDE5IDE2IDE4LjEgMTYgMTdWNFoiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
                              }}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {item.filename_original}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatFecha(item.fecha_prediccion)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-semibold text-gray-900">
                          {item.placa_manual || '-'}
                        </div>
                        <Link to={`/placas?imagen=${item.imagen_id}`} className="text-xs font-medium text-rojo-tinto hover:underline">
                          {item.placa_manual ? 'Editar placa' : 'Registrar placa'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.clase_predicha === 'smog'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.clase_predicha === 'smog' ? 'Con smog' : item.clase_predicha === 'sin_smog' ? 'Sin smog' : item.clase_predicha}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatConfidence(item.confianza)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatSmogPercentage(item.p_smog)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 text-sm">
              <span className="text-gray-600">
                Mostrando <strong>{desde}</strong>–<strong>{hasta}</strong> de <strong>{total}</strong> análisis
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1 || loading}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  « Primera
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  ‹ Anterior
                </button>
                <span className="px-2 text-gray-600">
                  Página {page} de {paginas}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(paginas, p + 1))}
                  disabled={page >= paginas || loading}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente ›
                </button>
                <button
                  onClick={() => setPage(paginas)}
                  disabled={page >= paginas || loading}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Última »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedImage(null)}>
          <div className="max-w-4xl max-h-full p-4">
            <img
              src={selectedImage}
              alt="Imagen ampliada"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-70"
              onClick={() => setSelectedImage(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analisis;