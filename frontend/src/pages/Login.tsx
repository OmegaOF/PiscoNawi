import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(username, password);
      if (!success) {
        setError('Usuario o contraseña incorrectos');
      }
    } catch (err) {
      setError('Error al iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Repeatable background image (shows where video doesn't cover) */}
      <div
        className="absolute inset-0 bg-repeat"
        style={{
          backgroundImage: 'url(/bg-video-jp.png)',
          backgroundSize: 'auto 100vh',
        }}
        aria-hidden
      />

      {/* Full-page video background */}
      <video
        src="/video/video-smog-login.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-contain object-left"
      >
        Tu navegador no soporta la reproducción de video.
      </video>

      {/* Overlay for readability */}
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
      />

      {/* Content on top */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md">
            Pisco Nawi IA
          </h1>
          <h2 className="text-2xl font-semibold text-white/95 mb-1">
            Iniciar Sesión
          </h2>
          <p className="text-white/80">
            Accede a tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="sr-only">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="appearance-none relative block w-full px-4 py-3 border border-white/30 bg-white/90 placeholder-text-muted text-text-dark rounded-md focus:outline-none focus:ring-2 focus:ring-rojo-tinto focus:border-rojo-tinto"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="appearance-none relative block w-full px-4 py-3 border border-white/30 bg-white/90 placeholder-text-muted text-text-dark rounded-md focus:outline-none focus:ring-2 focus:ring-rojo-tinto focus:border-rojo-tinto"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50/95 p-4 border border-red-200">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-rojo-tinto hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rojo-tinto disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;