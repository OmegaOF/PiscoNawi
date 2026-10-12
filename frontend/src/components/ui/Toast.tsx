import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; text: string }
interface ToastApi { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }

const Ctx = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} });

const STYLE: Record<ToastKind, string> = {
  success: 'border-smog-bajo/40 bg-white text-text-dark',
  error: 'border-smog-alto/40 bg-white text-text-dark',
  info: 'border-neutral-border bg-white text-text-dark',
};
const ICON = { success: CheckCircleIcon, error: ExclamationTriangleIcon, info: InformationCircleIcon };
const ICON_COLOR = { success: 'text-smog-bajo', error: 'text-smog-alto', info: 'text-vino' };

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, kind, text }]);
      setTimeout(() => remove(id), 5000);
    },
    [remove],
  );
  const api = useMemo(
    () => ({ success: (t: string) => push('success', t), error: (t: string) => push('error', t), info: (t: string) => push('info', t) }),
    [push],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[80] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = ICON[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg ${STYLE[t.kind]}`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[t.kind]}`} />
                <p className="flex-1 text-sm">{t.text}</p>
                <button onClick={() => remove(t.id)} aria-label="Cerrar aviso" className="text-text-muted hover:text-text-dark">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
};

export function useToast(): ToastApi {
  return useContext(Ctx);
}
