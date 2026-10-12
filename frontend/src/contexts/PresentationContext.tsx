import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { makeChartCtx, ChartCtx } from '../lib/chartCtx';

const STORAGE_KEY = 'pisconawi.presentation';

interface PresentationCtx {
  /** Preferencia guardada: abrir el panel en modo presentación. */
  enabled: boolean;
  /** El contenedor de presentación está montado en pantalla. */
  active: boolean;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  setActive: (v: boolean) => void;
}

const Ctx = createContext<PresentationCtx>({
  enabled: false,
  active: false,
  enable: () => {},
  disable: () => {},
  toggle: () => {},
  setActive: () => {},
});

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const PresentationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabled, setEnabled] = useState<boolean>(readStored);
  const [active, setActive] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* almacenamiento no disponible */
    }
  }, [enabled]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-presentation', active);
  }, [active]);

  const enable = useCallback(() => setEnabled(true), []);
  const disable = useCallback(() => setEnabled(false), []);
  const toggle = useCallback(() => setEnabled((v) => !v), []);

  const value = useMemo(
    () => ({ enabled, active, enable, disable, toggle, setActive }),
    [enabled, active, enable, disable, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function usePresentation(): PresentationCtx {
  return useContext(Ctx);
}

export function useChartCtx(): ChartCtx {
  const { active } = usePresentation();
  return useMemo(() => makeChartCtx(active), [active]);
}
