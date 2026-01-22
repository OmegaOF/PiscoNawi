import React, { useState, useEffect, useCallback } from 'react';
import Login from '../pages/Login';

type Phase = 'intro' | 'transition' | 'login';

const IntroToLogin: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('intro');

  const handleContinue = useCallback(() => {
    if (phase === 'intro') {
      setPhase('transition');
      // After transition animation completes, show login
      setTimeout(() => {
        setPhase('login');
      }, 800); // Transition duration
    }
  }, [phase]);

  useEffect(() => {
    // Auto transition after 12 seconds if still on intro (much longer animation - triple the time)
    if (phase === 'intro') {
      const timer = setTimeout(() => {
        handleContinue();
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [phase, handleContinue]);

  const handleSkip = () => {
    setPhase('login');
  };

  if (phase === 'login') {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-neutral-bg overflow-hidden">
      {/* Intro Splash Screen */}
      {phase === 'intro' && (
        <div className="fixed inset-0 flex flex-col items-center justify-center">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-bg to-caki opacity-80" />

          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-6 right-6 text-text-muted hover:text-text-dark transition-colors duration-200 text-sm z-20"
          >
            Saltar
          </button>

          {/* Content Container */}
          <div className="relative z-10 w-full max-w-7xl px-8">
            {/* Hero Content */}
            <div className="flex items-center justify-between mb-12">
              {/* Left side - Text */}
              <div className="flex-1 pr-8 animate-fade-in-up">
                <h1 className="text-5xl md:text-6xl font-bold text-text-dark mb-4">
                  Pisco Nawi IA
                </h1>
                <h2 className="text-xl md:text-2xl text-text-muted mb-2">
                  Sistema Inteligente de Detección de Smog
                </h2>
                <p className="text-text-muted text-lg">
                  Monitoreo y detección en tiempo real
                </p>
              </div>

              {/* Right side - Image */}
              <div className="flex-1 flex justify-center animate-fade-in-scale">
              <img
                src="/vermilion-3.png"
                alt="Pisco Nawi Bird Flying"
                className="w-[640px] h-[640px] md:w-[768px] md:h-[768px] object-contain"
              />
              </div>
            </div>

            {/* Continue button */}
            <div className="flex justify-center animate-fade-in-up" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
              <button
                onClick={handleContinue}
                className="bg-rojo-tinto text-white px-8 py-3 rounded-lg font-medium hover:bg-opacity-90 transition-colors duration-200"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Phase - Smooth morph from intro to login */}
      {phase === 'transition' && (
        <div className="min-h-screen flex bg-neutral-bg">
          {/* Left Sidebar - Bird moving into position */}
          <div className="w-2/5 bg-caki flex flex-col items-center justify-center px-8 animate-slide-in-left">
            <img
              src="/vermilion.png"
              alt="Pisco Nawi Bird"
              className="w-[640px] h-[640px] md:w-[768px] md:h-[768px] object-contain mb-6"
            />
            <h1 className="text-2xl font-bold text-text-dark text-center">
              Pisco Nawi IA
            </h1>
          </div>

          {/* Right Side - Login Form appearing */}
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-8 animate-fade-in-up-delayed">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-text-dark mb-2">
                  Iniciar Sesión
                </h2>
                <p className="text-text-muted">
                  Accede a tu cuenta
                </p>
              </div>

              {/* Placeholder for login form - will be replaced by actual Login component */}
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Usuario"
                    className="w-full px-4 py-3 border border-neutral-border rounded-md focus:outline-none focus:ring-2 focus:ring-rojo-tinto focus:border-transparent"
                    disabled
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Contraseña"
                    className="w-full px-4 py-3 border border-neutral-border rounded-md focus:outline-none focus:ring-2 focus:ring-rojo-tinto focus:border-transparent"
                    disabled
                  />
                </div>
                <button
                  className="w-full bg-rojo-tinto text-white py-3 px-4 rounded-md font-medium hover:bg-opacity-90 transition-colors duration-200"
                  disabled
                >
                  Iniciar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntroToLogin;