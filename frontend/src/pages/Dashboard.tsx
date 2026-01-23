import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const cards = [
    {
      title: 'Captura de Vehículos',
      description: 'Controlar el proceso de captura YOLO y ver vehículos detectados en tiempo real.',
      path: '/captura',
      icon: '📹',
    },
    {
      title: 'Análisis de Emisiones',
      description: 'Analizar imágenes existentes usando IA y actualizar predicciones.',
      path: '/analisis',
      icon: '📊',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-8">Panel Principal</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Link
              key={card.path}
              to={card.path}
              className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6 border border-gray-200"
            >
              <div className="flex items-center mb-4">
                <span className="text-4xl mr-4">{card.icon}</span>
                <h2 className="text-xl font-semibold text-vino">{card.title}</h2>
              </div>
              <p className="text-gray-600">{card.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-semibold text-vino mb-4">Sistema PISCONAWI IA</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Captura de Vehículos</h3>
              <p className="text-gray-600 mb-4">
                Utiliza YOLO para detectar y capturar vehículos en tiempo real. Las imágenes se guardan automáticamente
                en el directorio de capturas.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Análisis con IA</h3>
              <p className="text-gray-600 mb-4">
                Emplea CNN para analizar imágenes de vehículos, detectar placas y evaluar emisiones de smog.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;