import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon in react-leaflet (webpack)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

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

interface LocationCoords {
  lat: number;
  lng: number;
}

// Default center (e.g. Lima, Peru)
const DEFAULT_CENTER: LocationCoords = { lat: -12.0464, lng: -77.0428 };

// Draggable marker that reports position on drag end
function DraggableMarker({
  position,
  setPosition,
}: {
  position: LocationCoords;
  setPosition: (pos: LocationCoords) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setPosition({ lat: latlng.lat, lng: latlng.lng });
        }
      },
    }),
    [setPosition]
  );

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[position.lat, position.lng]}
      ref={markerRef}
    >
      <Popup>Arrastra el pin para ajustar la ubicación</Popup>
    </Marker>
  );
}

const ProcesarCapturas: React.FC = () => {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Current location (page/session) — from GPS or manual map; required to process
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationDisplayName, setLocationDisplayName] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapPinPosition, setMapPinPosition] = useState<LocationCoords>(DEFAULT_CENTER);

  // ✅ CNN processing state
  const [cnnStatus, setCnnStatus] = useState<CnnQueueStatus>({
    running: false,
    current_file: null,
    processed: 0,
    pending: 0,
  });
  const [processingCNN, setProcessingCNN] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reverse geocode to get display name (Nominatim)
  const fetchDisplayName = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'PiscoNawi-App/1.0' } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  }, []);

  const setLocationAndFetchName = useCallback(async (coords: LocationCoords) => {
    setLocation(coords);
    setLocationDisplayName(null);
    const name = await fetchDisplayName(coords.lat, coords.lng);
    setLocationDisplayName(name);
  }, [fetchDisplayName]);

  // Get current location from browser GPS
  const fetchLocationFromGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationLoading(false);
        setLocationAndFetchName(coords);
      },
      (err) => {
        setLocationError(err.message || 'No se pudo obtener la ubicación.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [setLocationAndFetchName]);

  // Open map modal (use current location or default center)
  const openMapModal = useCallback(() => {
    setMapPinPosition(location ?? DEFAULT_CENTER);
    setMapModalOpen(true);
  }, [location]);

  const confirmMapLocation = useCallback(() => {
    setLocationAndFetchName(mapPinPosition);
    setMapModalOpen(false);
  }, [mapPinPosition, setLocationAndFetchName]);

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

  // ✅ Start CNN processing (FIFO 1 by 1 in backend). Ubicación actual is required.
  const startCnnProcessing = async () => {
    if (!location) return;
    try {
      setProcessingCNN(true);
      setProgress(0);
      setError('');
      const body = {
        lat: location.lat,
        lng: location.lng,
        ...(locationDisplayName ? { nombre: locationDisplayName } : {}),
      };
      await axios.post('http://localhost:8000/api/analisis/procesar-cnn', body);
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

          {/* Require Ubicación actual before processing */}
          {!location && !locationLoading && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-800 text-sm">
                Debe definir la <strong>Ubicación actual</strong> (Usar GPS o Elegir en mapa) para poder procesar las capturas.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex space-x-4 flex-wrap gap-2 items-center">
              {/* CNN button: disabled when no location or when processing */}
              <button
                onClick={startCnnProcessing}
                disabled={!location || processingCNN || cnnStatus.running}
                className="bg-vino text-white px-6 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                title={location ? 'Procesa todas las capturas pendientes' : 'Defina la ubicación actual para procesar'}
              >
                {(processingCNN || cnnStatus.running) ? 'Procesando Capturas...' : 'Procesar Capturas (CNN)'}
              </button>

              <div className="flex items-center text-sm text-gray-600">
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

            {/* Ubicación actual: card con todos los datos disponibles */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-w-[280px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ubicación actual</span>
                {location && (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">Lista</span>
                )}
              </div>
              {locationLoading && (
                <p className="text-sm text-gray-500">Obteniendo ubicación...</p>
              )}
              {locationError && (
                <p className="text-sm text-amber-600">{locationError}</p>
              )}
              {location && !locationLoading && (
                <div className="space-y-2 text-sm">
                  {locationDisplayName && (
                    <p className="text-gray-800 font-medium leading-snug" title="Dirección / lugar">
                      {locationDisplayName}
                    </p>
                  )}
                  <p className="text-gray-600 font-mono text-xs">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                  <p className="text-gray-500 text-xs">Coordenadas (lat, lng)</p>
                </div>
              )}
              {!location && !locationLoading && !locationError && (
                <p className="text-gray-500 text-sm">No definida</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={fetchLocationFromGPS}
                  disabled={locationLoading}
                  className="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  Usar GPS
                </button>
                <button
                  type="button"
                  onClick={openMapModal}
                  className="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-100"
                >
                  Elegir en mapa
                </button>
              </div>
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

        {/* Map modal: drag pin to set location */}
        {mapModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-vino">Elegir ubicación en el mapa</h3>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-600 self-center">
                    {mapPinPosition.lat.toFixed(5)}, {mapPinPosition.lng.toFixed(5)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMapModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                    aria-label="Cerrar"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="relative w-full" style={{ height: '450px' }}>
                <MapContainer
                  center={[mapPinPosition.lat, mapPinPosition.lng]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                  className="rounded-b-lg z-0"
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <DraggableMarker position={mapPinPosition} setPosition={setMapPinPosition} />
                </MapContainer>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMapModalOpen(false)}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmMapLocation}
                  className="px-4 py-2 rounded bg-vino text-white hover:bg-opacity-90"
                >
                  Confirmar ubicación
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcesarCapturas;