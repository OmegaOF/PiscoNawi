import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { usePresentation } from '../../contexts/PresentationContext';
import { useFullscreen } from '../../hooks/useFullscreen';
import { cx } from '../../lib/cx';

interface PresentationShellProps {
  title: string;
  subtitle?: string;
  sections: { id: string; label: string }[];
  children: React.ReactNode;
}

const AUTO_MS = 20000;

const PresentationShell: React.FC<PresentationShellProps> = ({ title, subtitle, sections, children }) => {
  const { disable, setActive } = usePresentation();
  const fs = useFullscreen();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [toolbar, setToolbar] = useState(true);
  const [auto, setAuto] = useState(false);
  const idleTimer = useRef<number>();

  useEffect(() => {
    setActive(true);
    return () => setActive(false);
  }, [setActive]);

  const goTo = useCallback(
    (i: number) => {
      const els = scrollRef.current?.querySelectorAll<HTMLElement>('[data-section]');
      if (!els || !els.length) return;
      const clamped = Math.max(0, Math.min(els.length - 1, i));
      els[clamped].scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [],
  );

  // Sección activa según scroll
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-section]'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setIndex(els.indexOf(e.target as HTMLElement));
        });
      },
      { root, threshold: 0.5 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections.length]);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        goTo(index + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(sections.length - 1);
      else if (e.key.toLowerCase() === 'f') fs.toggle();
      else if (e.key.toLowerCase() === 'a') setAuto((v) => !v);
      else if (e.key === 'Escape' && !fs.isFullscreen) disable();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo, sections.length, fs, disable]);

  // Avance automático
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => goTo(index + 1 >= sections.length ? 0 : index + 1), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [auto, index, goTo, sections.length]);

  // Barra auto-oculta
  const onMove = () => {
    setToolbar(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setToolbar(false), 2500);
  };
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  const salir = () => {
    fs.exit();
    disable();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-pres-bg text-pres-text"
      style={{ backgroundImage: 'radial-gradient(ellipse at top, #3a141c 0%, #1C1517 55%)' }}
      onMouseMove={onMove}
    >
      <div ref={scrollRef} className="no-scrollbar h-full snap-y snap-proximity overflow-y-auto scroll-smooth">
        <header className="flex min-h-screen snap-start flex-col items-center justify-center px-8 text-center" data-section>
          <motion.img
            src="/vermilion-2.png"
            alt=""
            className="mb-6 h-20 w-20 object-contain opacity-90"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.9, scale: 1 }}
            transition={{ duration: 0.8 }}
          />
          <motion.h1
            className="text-4xl font-extrabold tracking-tight sm:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p className="mt-4 text-lg text-pres-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              {subtitle}
            </motion.p>
          )}
          <p className="mt-10 text-sm text-pres-muted">Usa ← → para navegar · F pantalla completa · A avance automático · Esc para salir</p>
        </header>
        {children}
      </div>

      {/* Barra superior */}
      <AnimatePresence>
        {toolbar && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed right-4 top-4 z-[61] flex items-center gap-1 rounded-full border border-pres-border bg-pres-card/90 px-2 py-1 shadow-xl backdrop-blur"
          >
            <button onClick={() => goTo(index - 1)} className="rounded-full p-2 hover:bg-white/10" aria-label="Sección anterior">
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="min-w-[56px] text-center text-sm tabular-nums text-pres-muted">
              {index + 1} / {sections.length + 1}
            </span>
            <button onClick={() => goTo(index + 1)} className="rounded-full p-2 hover:bg-white/10" aria-label="Sección siguiente">
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <span className="mx-1 h-5 w-px bg-pres-border" />
            <button onClick={() => setAuto((v) => !v)} className={cx('rounded-full p-2 hover:bg-white/10', auto && 'text-[#E8A532]')} aria-label="Avance automático" title="Avance automático (A)">
              {auto ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            </button>
            <button onClick={() => fs.toggle()} className="rounded-full p-2 hover:bg-white/10" aria-label="Pantalla completa" title="Pantalla completa (F)">
              {fs.isFullscreen ? <ArrowsPointingInIcon className="h-5 w-5" /> : <ArrowsPointingOutIcon className="h-5 w-5" />}
            </button>
            <button onClick={salir} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm hover:bg-white/10" aria-label="Salir del modo presentación">
              <XMarkIcon className="h-5 w-5" /> Salir
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Riel de puntos */}
      <nav className="fixed right-4 top-1/2 z-[61] hidden -translate-y-1/2 flex-col gap-2 md:flex" aria-label="Secciones">
        {[{ id: 'portada', label: 'Portada' }, ...sections].map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            title={s.label}
            aria-label={s.label}
            className={cx('h-2.5 w-2.5 rounded-full transition-all', i === index ? 'scale-125 bg-[#E0564A]' : 'bg-white/25 hover:bg-white/50')}
          />
        ))}
      </nav>

      {auto && (
        <motion.div
          key={index}
          className="fixed left-0 top-0 z-[61] h-1 bg-[#E0564A]"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: AUTO_MS / 1000, ease: 'linear' }}
        />
      )}
    </div>
  );
};

export default PresentationShell;
