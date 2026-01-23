import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

const Analisis: React.FC = () => {
  const [analisisData, setAnalisisData] = useState<AnalisisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);

  useEffect(() => {
    loadAnalisisData();
  }, []);

  const loadAnalisisData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/analisis/emisiones');
      setAnalisisData(response.data);
    } catch (err) {
      console.error('Error loading analysis data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalizarConIA = async (imagenId: number) => {
    setAnalyzingId(imagenId);
    try {
      await axios.post(`http://localhost:8000/api/analisis/analizar/${imagenId}`);
      // Reload data to show updated results
      await loadAnalisisData();
      alert('Análisis completado exitosamente');
    } catch (err: any) {
      console.error('Error analyzing with AI:', err);
      alert(`Error en el análisis: ${err.response?.data?.detail || 'Error desconocido'}`);
    } finally {
      setAnalyzingId(null);
    }
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
        <h1 className="text-3xl font-bold text-vino mb-8">Análisis de Emisiones</h1>

        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-vino">Análisis de Vehículos</h2>
            <p className="text-sm text-gray-600 mt-1">
              Tabla combinada de imágenes y predicciones. Haz clic en "Analizar con IA" para actualizar usando OpenAI Vision.
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
                      Placa Manual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clase Predicha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confianza
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P Smog
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acción
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
                              className="h-12 w-12 rounded-lg object-cover"
                              src={`file://${item.ruta_archivo}`}
                              alt={item.filename_original}
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.placa_manual || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.clase_predicha === 'smog'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.clase_predicha}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatConfidence(item.confianza)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatSmogPercentage(item.p_smog)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                        {item.observacion || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleAnalizarConIA(item.imagen_id)}
                          disabled={analyzingId === item.imagen_id}
                          className="bg-vino text-white px-4 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {analyzingId === item.imagen_id ? 'Analizando...' : 'Analizar con IA'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analisis;