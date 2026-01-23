import React, { useState } from 'react';
import axios from 'axios';

interface BulkAnalysisResult {
  processed_count: number;
  success_count: number;
  failed_count: number;
  errors: string[];
}

const AnalisisMasivo: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkAnalysisResult | null>(null);

  const handleAnalizarTodas = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:8000/api/analisis/analizar-todas-hoy');
      setResult(response.data);
      alert('Análisis masivo completado exitosamente');
    } catch (err: any) {
      console.error('Error analyzing all images:', err);
      alert(`Error en el análisis masivo: ${err.response?.data?.detail || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-8">Análisis Masivo de Emisiones</h1>

        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-vino">Procesar Todas las Imágenes del Día</h2>
            <p className="text-sm text-gray-600 mt-1">
              Analiza automáticamente todas las imágenes capturadas hoy usando CNN.
              Este proceso actualizará las predicciones de todas las imágenes del día actual.
            </p>
          </div>

          <div className="px-6 py-6">
            <div className="text-center">
              <button
                onClick={handleAnalizarTodas}
                disabled={loading}
                className="bg-vino text-white px-8 py-4 rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Procesando imágenes...
                  </div>
                ) : (
                  'Analizar Todas las Imágenes del Día'
                )}
              </button>

              {loading && (
                <p className="text-sm text-gray-500 mt-4">
                  Este proceso puede tomar varios minutos dependiendo del número de imágenes...
                </p>
              )}
            </div>

            {result && (
              <div className="mt-8 bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resultado del Análisis</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{result.processed_count}</div>
                    <div className="text-sm text-blue-800">Imágenes Procesadas</div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{result.success_count}</div>
                    <div className="text-sm text-green-800">Procesadas Exitosamente</div>
                  </div>

                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{result.failed_count}</div>
                    <div className="text-sm text-red-800">Errores</div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-md font-semibold text-red-800 mb-2">Errores Encontrados:</h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {result.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.success_count > 0 && result.failed_count === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium">
                      ✅ Todas las imágenes del día han sido procesadas exitosamente.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalisisMasivo;