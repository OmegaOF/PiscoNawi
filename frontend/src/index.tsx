import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// El servidor de desarrollo muestra una pantalla roja ante cualquier error, incluso los que
// la interfaz ya maneja y de los que se recupera sola. Durante una demostración eso tapa la
// pantalla sin motivo, así que se oculta. En el build de producción este overlay no existe.
if (process.env.NODE_ENV === 'development') {
  const ocultarOverlay = () => {
    document.querySelectorAll('iframe').forEach((f) => {
      if (f.style.zIndex === '2147483647') f.remove();
    });
    // El contenedor del overlay a veces queda como nodo suelto en el body.
    document.querySelectorAll('body > div').forEach((d) => {
      const el = d as HTMLElement;
      if (el.style.zIndex === '2147483647' || el.id === 'webpack-dev-server-client-overlay') el.remove();
    });
  };
  window.addEventListener('error', ocultarOverlay, true);
  window.addEventListener('unhandledrejection', ocultarOverlay, true);
  new MutationObserver(ocultarOverlay).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(ocultarOverlay, 400);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);