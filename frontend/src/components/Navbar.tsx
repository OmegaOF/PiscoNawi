import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Panel Principal' },
    { path: '/captura', label: 'Captura de Vehículos' },
    { path: '/procesar-capturas', label: 'Procesar Capturas (CNN)' },
    { path: '/analisis', label: 'Resultados CNN' },
    { path: '/analisis-masivo', label: 'Análisis Masivo' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-rojo-tinto text-white shadow-lg fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <img
                src="/vermilion-2.png"
                alt="Pisco Nawi Icon"
                className="w-8 h-8 mr-3"
              />
              <h1 className="text-xl font-bold">PISCONAWI IA</h1>
            </div>
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive(item.path)
                        ? 'bg-neutral-bg text-rojo-tinto'
                        : 'text-white hover:bg-neutral-bg hover:text-rojo-tinto'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <span className="text-sm">
                Bienvenido, {user.nombre}
              </span>
            )}
              <button
                onClick={logout}
                className="bg-neutral-bg text-rojo-tinto px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-80 transition-colors duration-200"
              >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-rojo-tinto border-t border-neutral-bg">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive(item.path)
                  ? 'bg-neutral-bg text-rojo-tinto'
                  : 'text-white hover:bg-neutral-bg hover:text-rojo-tinto'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;