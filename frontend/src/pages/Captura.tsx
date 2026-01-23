import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface CapturedImage {
  filename: string;
  url: string; // HTTP URL to the image
  timestamp: string;
}

interface CaptureStatus {
  is_running: boolean;
  process_id: number | null;
}

const Captura: React.FC = () => {
  const [status, setStatus] = useState<CaptureStatus>({ is_running: false, process_id: null });
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkStatus();
    loadImages();

    // Set up interval to refresh images when capture is running
    const interval = setInterval(() => {
      if (status.is_running) {
        loadImages();
      }
    }, 3000); // Refresh every 3 seconds when running

    return () => clearInterval(interval);
  }, [status.is_running]);

  const checkStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/captura/estado');
      setStatus(response.data);
    } catch (err) {
      console.error('Error checking status:', err);
    }
  };

  const loadImages = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get('http://localhost:8000/api/captura/imagenes');
      // Limit to most recent 20 images to prevent UI overload
      setImages(response.data.slice(0, 20));
    } catch (err) {
      console.error('Error loading images:', err);
    } finally {
      setRefreshing(false);
    }
  };


  const handleStartCapture = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/captura/iniciar');
      setStatus(response.data);
      // Reload images after a short delay
      setTimeout(loadImages, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al iniciar captura');
    } finally {
      setLoading(false);
    }
  };

  const handleStopCapture = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/captura/detener');
      setStatus(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al detener captura');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };


  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-8">Captura de Vehículos</h1>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-vino mb-4">Control de Captura</h2>

          <div className="flex items-center space-x-4 mb-4">
            <div className={`w-3 h-3 rounded-full ${status.is_running ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-lg">
              Estado: {status.is_running ? 'Ejecutándose' : 'Detenido'}
              {status.process_id && ` (PID: ${status.process_id})`}
            </span>
          </div>

          <div className="flex space-x-4 flex-wrap gap-2">
            <button
              onClick={handleStartCapture}
              disabled={status.is_running || loading}
              className="bg-vino text-white px-6 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando...' : 'Iniciar Captura'}
            </button>

            <button
              onClick={handleStopCapture}
              disabled={!status.is_running || loading}
              className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Deteniendo...' : 'Detener Captura'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Images Grid */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-vino">Vehículos Detectados en Tiempo Real</h2>
            {refreshing && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-vino mr-2"></div>
                Actualizando...
              </div>
            )}
          </div>

          {images.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No hay imágenes capturadas aún. Inicia la captura para comenzar.
              {status.is_running && <span className="block mt-2 text-sm">Las imágenes se actualizarán automáticamente cada 3 segundos.</span>}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image) => (
                <div key={image.filename} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="aspect-w-4 aspect-h-3 bg-gray-100">
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{image.filename}</p>
                    <p className="text-xs text-gray-500">{formatTimestamp(image.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Captura;
