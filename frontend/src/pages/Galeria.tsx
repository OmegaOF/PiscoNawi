import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface GalleryImage {
  filename: string;
  filepath: string;
  timestamp: string;
  size: number;
}

const Galeria: React.FC = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    loadImages();
  }, [fechaDesde, fechaHasta]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);

      const response = await axios.get(`http://localhost:8000/api/galeria/imagenes?${params}`);
      setImages(response.data);
    } catch (err) {
      console.error('Error loading gallery images:', err);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearFilters = () => {
    setFechaDesde('');
    setFechaHasta('');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-8">Galería de Capturas</h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-vino mb-4">Filtros</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="fechaDesde" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Desde
              </label>
              <input
                type="date"
                id="fechaDesde"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-vino focus:border-vino"
              />
            </div>

            <div>
              <label htmlFor="fechaHasta" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Hasta
              </label>
              <input
                type="date"
                id="fechaHasta"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-vino focus:border-vino"
              />
            </div>

            <div>
              <button
                onClick={clearFilters}
                className="w-full bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-200"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Images Grid */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-vino">Imágenes Capturadas</h2>
            <span className="text-sm text-gray-500">
              {images.length} imagen{images.length !== 1 ? 'es' : ''} encontrada{images.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vino mx-auto"></div>
              <p className="text-gray-500 mt-4">Cargando imágenes...</p>
            </div>
          ) : images.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No hay imágenes capturadas en el período seleccionado.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {images.map((image) => (
                <div key={image.filename} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="aspect-w-4 aspect-h-3 bg-gray-100">
                    <img
                      src={`file://${image.filepath}`}
                      alt={image.filename}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        // Fallback for file:// protocol issues in browser
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDMTMuMSAyIDE0IDIuOSAxNCA0VjE2QzE0IDE3LjEgMTMuMSAxOCA5LjkgMTlIMTlDMTguMSAxOSAxNyAyMC4xIDE3IDIxVjIyQzE3IDIzLjEgMTYuMSAyNCAxNSAyNEgxN0MxNS44IDI0IDE1IDIzLjEgMTUgMjJWMTlIMTQuOUMxNS44IDE5IDE2IDE4LjEgMTYgMTdWNFoiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-900 truncate mb-1">{image.filename}</p>
                    <p className="text-xs text-gray-500 mb-1">{formatTimestamp(image.timestamp)}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(image.size)}</p>
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

export default Galeria;