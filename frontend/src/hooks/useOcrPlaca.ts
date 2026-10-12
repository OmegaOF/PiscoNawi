import { useCallback, useEffect, useRef, useState } from 'react';
import { LecturaPlaca, leerPlaca, RectNat, terminarOcrWorker } from '../lib/ocrPlaca';

export type EstadoOcr = 'idle' | 'preparando' | 'leyendo' | 'listo' | 'error';

export function useOcrPlaca() {
  const [estado, setEstado] = useState<EstadoOcr>('idle');
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<LecturaPlaca | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const leer = useCallback(async (url: string, rect: RectNat) => {
    const id = ++reqId.current;
    setResultado(null);
    setError(null);
    setProgreso(0);
    setEstado('preparando');
    try {
      const r = await leerPlaca(url, rect, (status, p) => {
        if (id !== reqId.current) return;
        setEstado(status === 'recognizing text' ? 'leyendo' : 'preparando');
        setProgreso(p || 0);
      });
      if (id !== reqId.current) return;
      setResultado(r);
      setEstado('listo');
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : 'No se pudo ejecutar el lector');
      setEstado('error');
    }
  }, []);

  const descartar = useCallback(() => {
    reqId.current++;
    setEstado('idle');
    setResultado(null);
    setError(null);
    setProgreso(0);
  }, []);

  // El lector se libera al salir de la página.
  useEffect(() => () => {
    terminarOcrWorker();
  }, []);

  return { estado, progreso, resultado, error, leer, descartar };
}
