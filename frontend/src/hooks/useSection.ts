import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../lib/reportsApi';

export interface Section<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Carga independiente por sección: conserva los datos previos mientras recarga
 * (sin parpadeo) e ignora respuestas obsoletas cuando cambia la clave.
 */
export function useSection<T>(fetcher: () => Promise<T>, key: string, enabled = true): Section<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((res) => {
        if (id === reqId.current) setData(res);
      })
      .catch((e) => {
        if (id === reqId.current) setError(errorMessage(e, 'No se pudieron cargar los datos'));
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [enabled]);

  useEffect(() => {
    run();
  }, [run, key]);

  return { data, loading, error, reload: run };
}
