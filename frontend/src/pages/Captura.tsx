import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownTrayIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';

// Activar con REACT_APP_DEBUG_CAMARAS=1 para ver el detalle en la consola del navegador.
const DEBUG_CAMARAS = process.env.REACT_APP_DEBUG_CAMARAS === '1';

interface CapturedImage {
  filename: string;
  url: string; // HTTP URL to the image
  timestamp: string;
}

interface CaptureStatus {
  is_running: boolean;
  process_id: number | null;
  camera_index: number | null;
}

interface CameraDevice {
  index: number;
  label: string;
  available: boolean;
}

const Captura: React.FC = () => {
  const [status, setStatus] = useState<CaptureStatus>({ is_running: false, process_id: null, camera_index: null });
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [buscandoCamaras, setBuscandoCamaras] = useState(false);

  useEffect(() => {
    checkStatus();
    loadImages();
    loadCameras();

    // Set up interval to refresh images when capture is running
    const interval = setInterval(() => {
      if (status.is_running) {
        loadImages();
      }
    }, 3000); // Refresh every 3 seconds when running

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.is_running]);

  const checkStatus = async () => {
    try {
      const response = await api.get('/captura/estado');
      setStatus(response.data);
    } catch (err) {
    }
  };

  // El navegador conoce el nombre real de cada cámara; el backend solo su índice.
  // Nunca debe impedir que se muestre la lista: si falla o tarda, se usan los nombres genéricos.
  const nombresDelNavegador = async (): Promise<string[]> => {
    const conTiempoLimite = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('tiempo agotado')), ms))]);
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      let camaras = (await conTiempoLimite(navigator.mediaDevices.enumerateDevices(), 3000)).filter(
        (d) => d.kind === 'videoinput',
      );
      if (camaras.length > 0 && camaras.every((d) => !d.label)) {
        const permiso = await conTiempoLimite(navigator.mediaDevices.getUserMedia({ video: true }), 8000);
        permiso.getTracks().forEach((t) => t.stop());
        // Da un instante al sistema para liberar la cámara antes de que el backend la abra
        await new Promise((r) => setTimeout(r, 400));
        camaras = (await conTiempoLimite(navigator.mediaDevices.enumerateDevices(), 3000)).filter(
          (d) => d.kind === 'videoinput',
        );
      }
      return camaras.map((d) => d.label);
    } catch (e) {
      if (DEBUG_CAMARAS) console.warn('[camaras] no se pudieron obtener los nombres:', e);
      return [];
    }
  };

  const loadCameras = async (refrescar = false) => {
    setBuscandoCamaras(true);
    setError('');
    try {
      // Los nombres son opcionales: se piden primero y, pase lo que pase, luego se consulta el backend.
      const nombres = await nombresDelNavegador();
      const response = await api.get<CameraDevice[]>('/captura/dispositivos', {
        params: refrescar ? { refrescar: true } : undefined,
      });
      // Los nombres solo se usan cuando su cantidad coincide con la del backend:
      // de lo contrario no hay forma fiable de saber qué nombre va con qué índice.
      const usarNombres = nombres.length === (response.data || []).length;
      const devices = (response.data || []).map((cam, i) => ({
        ...cam,
        label: (usarNombres && nombres[i]?.trim()) || cam.label,
      }));
      if (DEBUG_CAMARAS) console.info('[camaras] backend:', response.data, '| nombres:', nombres);
      setCameras(devices);
      if (devices.length > 0) {
        setSelectedCamera((prev) => (devices.some((d) => d.index === prev) ? prev : devices[0].index));
      }
    } catch (err: any) {
      if (DEBUG_CAMARAS) console.error('[camaras] error al listar:', err);
      setError(
        err?.response?.data?.detail ||
          'No se pudo obtener la lista de cámaras. Revisa que el servidor esté activo y vuelve a intentar.',
      );
    } finally {
      setBuscandoCamaras(false);
    }
  };

  const loadImages = async () => {
    try {
      setRefreshing(true);
      const response = await api.get('/captura/imagenes');
      // Limit to most recent 20 images to prevent UI overload
      setImages(response.data.slice(0, 20));
    } catch (err) {
    } finally {
      setRefreshing(false);
    }
  };


  const handleStartCapture = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/captura/iniciar', { camera_index: selectedCamera });
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
      const response = await api.post('/captura/detener');
      setStatus(response.data);
      loadCameras();
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

  const actual = preview != null ? images[preview] : null;

  const mover = useCallback(
    (paso: number) => {
      setPreview((i) => (i == null || images.length === 0 ? i : (i + paso + images.length) % images.length));
    },
    [images.length],
  );

  // Teclado en la vista previa: Esc cierra, flechas navegan
  useEffect(() => {
    if (preview == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
      else if (e.key === 'ArrowRight') mover(1);
      else if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [preview, mover]);

  // Si la lista cambia (p. ej. al eliminar), mantener la vista previa dentro de rango
  useEffect(() => {
    setPreview((i) => (i == null ? i : images.length === 0 ? null : Math.min(i, images.length - 1)));
  }, [images.length]);

  const handleDeleteImage = async (filename: string) => {
    try {
      await api.delete(`/captura/eliminar/${filename}`);
      setImages(images.filter(img => img.filename !== filename));
    } catch (err) {
      setError('Error al eliminar imagen');
    }
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

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-1">
                Cámara
              </label>
              <select
                id="camera-select"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(Number(e.target.value))}
                disabled={status.is_running || loading || buscandoCamaras}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cameras.length === 0 && (
                  <option value={selectedCamera}>
                    {buscandoCamaras ? 'Buscando cámaras…' : 'No se detectaron cámaras'}
                  </option>
                )}
                {cameras.map((cam) => (
                  <option key={cam.index} value={cam.index}>
                    {cam.label}
                    {!cam.available ? ' (en uso o sin señal)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => loadCameras(true)}
              disabled={status.is_running || loading || buscandoCamaras}
              className="border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Volver a buscar cámaras disponibles"
            >
              {buscandoCamaras ? 'Buscando…' : 'Buscar cámaras'}
            </button>
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

          {cameras.some((c) => !c.available) && (
            <p className="mb-2 text-sm text-amber-700">
              Alguna cámara está ocupada por otro programa (o por otra pestaña del navegador). Ciérralo y pulsa «Buscar cámaras».
            </p>
          )}

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
              {images.map((image, index) => (
                <div key={image.filename} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="aspect-w-4 aspect-h-3 bg-gray-100 relative group">
                    <button
                      type="button"
                      onClick={() => setPreview(index)}
                      className="block w-full focus:outline-none focus:ring-2 focus:ring-rojo-tinto"
                      title="Ver imagen en grande"
                      aria-label={`Ver ${image.filename} en grande`}
                    >
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-48 cursor-zoom-in object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(image.filename);
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-700"
                      title="Eliminar imagen"
                    >
                      ✕
                    </button>
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

      {/* Vista previa de la imagen */}
      {actual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la captura"
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Cerrar vista previa"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={() => mover(-1)}
                className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                aria-label="Imagen anterior"
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </button>
              <button
                onClick={() => mover(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                aria-label="Imagen siguiente"
              >
                <ChevronRightIcon className="h-6 w-6" />
              </button>
            </>
          )}
          <div className="flex max-h-full w-full max-w-5xl flex-col items-center gap-3">
            <img
              src={actual.url}
              alt={actual.filename}
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
            <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur">
              <div className="min-w-0">
                <p className="truncate font-medium">{actual.filename}</p>
                <p className="text-sm text-white/70">
                  {formatTimestamp(actual.timestamp)}
                  {images.length > 1 && ` · ${(preview ?? 0) + 1} de ${images.length}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={actual.url}
                  download={actual.filename}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" /> Descargar
                </a>
                <button
                  onClick={() => {
                    const nombre = actual.filename;
                    setPreview(null);
                    handleDeleteImage(nombre);
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Captura;
