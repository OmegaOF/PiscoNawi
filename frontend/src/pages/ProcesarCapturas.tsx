import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface CapturedImage {
  filename: string;
  url: string; // HTTP URL to the image
  timestamp: string;
}

// ✅ Interface for CNN queue status
interface CnnQueueStatus {
  running: boolean;
  current_file: string | null;
  processed: number;
  pending: number;
}

const ProcesarCapturas: React.FC = () => {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ✅ CNN processing state
  const [cnnStatus, setCnnStatus] = useState<CnnQueueStatus>({
    running: false,
    current_file: null,
    processed: 0,
    pending: 0,
  });
  const [processingCNN, setProcessingCNN] = useState(false);
  const [progress, setProgress] = useState(0);

  // ✅ Get CNN processing status
  const loadCnnStatus = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/analisis/estado-cnn');
      setCnnStatus(res.data);

      // Update progress bar based on processing status
      if (res.data.running) {
        const total = res.data.processed + res.data.pending;
        if (total > 0) {
          const currentProgress = (res.data.processed / total) * 100;
          setProgress(currentProgress);
        }
      } else if (processingCNN) {
        // Process finished, set to 100%
        setProgress(100);
        setTimeout(() => {
          setProcessingCNN(false);
          setProgress(0);
        }, 1000);
      }

      // If finished, turn off button state
      if (!res.data.running) {
        setProcessingCNN(false);
      }
    } catch (err) {
      // If it fails, don't break the UI
      // (for example if endpoint doesn't exist yet)
      // console.error('Error getting CNN status:', err);
    }
  }, [processingCNN]);

  useEffect(() => {
    loadImages();

    // ✅ Refresh CNN status always (every 1.5s)
    const interval = setInterval(() => {
      loadCnnStatus();
    }, 1500);

    return () => clearInterval(interval);
  }, [loadCnnStatus]);

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

  // ✅ Start CNN processing (FIFO 1 by 1 in backend)
  const startCnnProcessing = async () => {
    try {
      setProcessingCNN(true);
      setProgress(0);
      setError('');
      await axios.post('http://localhost:8000/api/analisis/procesar-cnn');
      // Refresh status right after starting
      await loadCnnStatus();
    } catch (err: any) {
      console.error('Error starting CNN:', err);
      setProcessingCNN(false);
      setProgress(0);
      setError(err.response?.data?.detail || 'Error starting CNN processing');
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

  // ✅ Helper for image status (without deleting anything)
  const renderCnnBadge = (filename: string) => {
    // Processing this one right now
    if (cnnStatus.running && cnnStatus.current_file === filename) {
      return <span className="text-blue-600 font-semibold">Procesando...</span>;
    }

    // If running but not the current one, there are two possible states:
    // - Pending (not arrived yet)
    // - Processed (already passed)
    // Since we don't read DB here yet, we use a neutral label.
    if (cnnStatus.running && cnnStatus.current_file !== filename) {
      return <span className="text-gray-500">Pendiente / Procesada</span>;
    }

    // If not running
    return <span className="text-gray-500">Pendiente / Procesada</span>;
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-4">Procesamiento CNN de Capturas</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-gray-700 leading-relaxed">
            Una Red Neuronal Convolucional (CNN) es un tipo avanzado de inteligencia artificial especializada en el procesamiento
            y análisis de imágenes. Este proceso puede tomar tiempo porque utiliza la CNN para identificar y analizar cada imagen
            de manera detallada. Nuestra CNN fue entrenada con casi 5000 imágenes recolectadas en campo, lo que le permite
            detectar con precisión características importantes en las capturas de vehículos.
          </p>
        </div>

        {/* CNN Processing Control Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-vino mb-4">Control de Procesamiento CNN</h2>

          <div className="flex items-center space-x-4 mb-4">
            <div className={`w-3 h-3 rounded-full ${cnnStatus.running ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-lg">
              Estado: {cnnStatus.running ? 'Procesando' : 'En Espera'}
            </span>
          </div>

          {/* Progress Bar */}
          {processingCNN && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progreso del procesamiento</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-vino h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex space-x-4 flex-wrap gap-2">
            {/* ✅ CNN button with SAME style (bg-vino) */}
            <button
              onClick={startCnnProcessing}
              disabled={processingCNN || cnnStatus.running}
              className="bg-vino text-white px-6 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Procesa todas las capturas pendientes"
            >
              {(processingCNN || cnnStatus.running) ? 'Procesando Capturas...' : 'Procesar Capturas (CNN)'}
            </button>

            {/* ✅ Mini progress indicator */}
            <div className="flex items-center text-sm text-gray-600 ml-2">
              {cnnStatus.running ? (
                <span>
                  CNN: {cnnStatus.processed} procesadas • {cnnStatus.pending} pendientes
                  {cnnStatus.current_file ? ` • Actual: ${cnnStatus.current_file}` : ''}
                </span>
              ) : (
                <span>CNN: en espera</span>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Success message */}
          {!cnnStatus.running && processingCNN === false && progress === 0 && cnnStatus.processed > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-700">✅ Procesamiento completado exitosamente</p>
            </div>
          )}
        </div>

        {/* Images Grid */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-vino">Capturas Disponibles para Procesamiento</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadImages}
                disabled={refreshing}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50"
              >
                {refreshing ? 'Actualizando...' : 'Actualizar'}
              </button>
              {refreshing && (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-vino mr-2"></div>
                  Actualizando...
                </div>
              )}
            </div>
          </div>

          {images.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No hay imágenes capturadas aún. Ve a la página de captura para comenzar.
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

                    {/* ✅ CNN status per image */}
                    <p className="text-xs mt-2">
                      {renderCnnBadge(image.filename)}
                    </p>
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

export default ProcesarCapturas;