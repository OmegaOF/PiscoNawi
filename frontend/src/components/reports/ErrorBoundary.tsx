import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Altura que conserva el hueco cuando el contenido falla, para no descuadrar la página. */
  minHeight?: number | string;
  /** Al cambiar este valor se vuelve a intentar renderizar (p. ej. nuevos datos). */
  resetKey?: unknown;
}

interface State {
  fallo: boolean;
}

/**
 * Aísla una parte de la página. Si algo falla al renderizar, el hueco queda vacío
 * y el resto del panel sigue funcionando: no se muestra ningún aviso en pantalla.
 * El detalle del fallo va solo a la consola del navegador.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { fallo: false };

  static getDerivedStateFromError(): State {
    return { fallo: true };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.fallo && prev.resetKey !== this.props.resetKey) this.setState({ fallo: false });
  }

  componentDidCatch(error: Error) {
    // Queda registrado en consola para diagnóstico, nunca en la interfaz.
    console.error('[render]', error);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return <div aria-hidden style={{ minHeight: this.props.minHeight ?? 200 }} />;
  }
}

/**
 * Envoltorio para una página entera: si el contenido falla, se reintenta solo
 * tras un instante en vez de dejar la pantalla en blanco. Tampoco muestra avisos.
 */
export class PageBoundary extends React.Component<{ children: React.ReactNode }, { fallo: boolean }> {
  private temporizador?: ReturnType<typeof setTimeout>;
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: Error) {
    console.error('[render]', error);
    this.temporizador = setTimeout(() => this.setState({ fallo: false }), 150);
  }

  componentWillUnmount() {
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  render() {
    if (this.state.fallo) return <div aria-hidden className="min-h-screen" />;
    return this.props.children;
  }
}

export default ErrorBoundary;
