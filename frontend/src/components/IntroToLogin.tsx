import React, { useState, useCallback } from 'react';
import Login from '../pages/Login';

type Phase = 'intro' | 'transition' | 'login';

const IntroToLogin: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [videoEnded, setVideoEnded] = useState(false);

  const handleContinue = useCallback(() => {
    if (phase === 'intro') {
      setPhase('transition');
      setTimeout(() => {
        setPhase('login');
      }, 800);
    }
  }, [phase]);

  const handleSkip = useCallback(() => {
    setPhase('login');
  }, []);

  const handleVideoEnded = useCallback(() => {
    setVideoEnded(true);
  }, []);

  if (phase === 'login') {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-neutral-bg overflow-hidden">
      {/* Intro Splash Screen - Fullscreen video background */}
      {phase === 'intro' && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ width: '100vw', height: '100vh' }}
        >
          {/* Fullscreen video background - covers viewport, freezes on last frame when ended */}
          <video
            className="absolute inset-0 w-full h-full object-cover"
            style={{ width: '100vw', height: '100vh', objectFit: 'cover' }}
            src="/video/intro-pisconawi.mp4"
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
          />

          {/* Subtle dark overlay for readability */}
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden
          />

          {/* Skip button - always visible */}
          <button
            onClick={handleSkip}
            className="absolute top-6 right-6 text-white/90 hover:text-white transition-colors duration-200 text-sm z-20 drop-shadow-md"
          >
            Saltar
          </button>

          {/* Centered overlay content */}
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-4">
            {/* Site title - visible while video plays and after */}
            <h1 className="text-4xl md:text-6xl font-bold text-white text-center drop-shadow-lg mb-2">
              Pisco Nawi IA
            </h1>
            <h2 className="text-lg md:text-xl text-white/90 text-center drop-shadow-md mb-8">
              Sistema Inteligente de Detección de Smog
            </h2>
            <div className="mb-10 flex justify-center">
              <div className="w-fit rounded-2xl bg-black/30 px-5 py-3 backdrop-blur-sm ring-1 ring-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] md:text-xs font-medium tracking-[0.16em] uppercase text-white/65">
                      Autor
                    </span>
                    <span className="text-sm md:text-base font-semibold text-white">
                      Jose Pedro Ortuño Flores
                    </span>
                  </div>

                  <div className="hidden sm:block h-4 w-px bg-white/15" aria-hidden />

                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] md:text-xs font-medium tracking-[0.16em] uppercase text-white/65">
                      Tutor
                    </span>
                    <span className="text-sm md:text-base font-semibold text-white">
                      Ing. Jimenez Velasco Richard
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue button - hidden until video ends, then smooth fade-in */}
            <div
              className={`flex justify-center ${videoEnded ? 'animate-fade-in-button' : 'opacity-0 pointer-events-none'}`}
            >
              <button
                onClick={handleContinue}
                className="bg-rojo-tinto text-white px-8 py-3 rounded-lg font-medium hover:bg-opacity-90 transition-colors duration-200 shadow-lg"
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
          <div
            className="w-2/5 bg-caki flex flex-col items-center justify-center px-8 animate-slide-in-left"
            style={{ backgroundColor: '#C6B38E', backgroundImage: 'none' }}
          >
            <video
              src="/video/login-animation.mp4"
              className="w-[640px] h-[640px] md:w-[768px] md:h-[768px] object-contain bg-caki mb-6"
              style={{ backgroundColor: '#C6B38E', backgroundImage: 'none' }}
              autoPlay
              loop
              muted
              playsInline
            />
            <h1 className="text-2xl font-bold text-text-dark text-center">
              Pisco Nawi IA..
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
                  Iniciar Sesión 1
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
