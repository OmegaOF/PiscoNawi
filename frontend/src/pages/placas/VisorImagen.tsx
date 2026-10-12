import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IMG_FALLBACK } from '../../components/reports/Lightbox';
import { RectNat } from '../../lib/ocrPlaca';

interface VisorImagenProps {
  src: string;
  zoom: number;
  onZoomChange: (k: number) => void;
  resetKey: number;
  modoRecorte: boolean;
  onRecorte: (r: RectNat) => void;
  onSalirRecorte: () => void;
  onLoadedChange?: (ok: boolean) => void;
  className?: string;
}

const MIN_K = 1;
const MAX_K = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Visor con zoom (rueda / botones), arrastre para desplazar y modo recorte
 * para seleccionar la placa. Las coordenadas del recorte se devuelven en
 * píxeles de la imagen original (independientes del zoom).
 */
const VisorImagen: React.FC<VisorImagenProps> = ({
  src,
  zoom,
  onZoomChange,
  resetKey,
  modoRecorte,
  onRecorte,
  onSalirRecorte,
  onLoadedChange,
  className,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [t, setT] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(false);
  const [rectScreen, setRectScreen] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{ mode: 'pan' | 'crop'; x0: number; y0: number; tx: number; ty: number; startNat?: { x: number; y: number } } | null>(null);

  const fit = nat.w && box.w ? Math.min(box.w / nat.w, box.h / nat.h) : 1;
  const fw = nat.w * fit;
  const fh = nat.h * fit;
  const tx0 = (box.w - fw) / 2;
  const ty0 = (box.h - fh) / 2;
  const k = zoom;

  // refs para el listener nativo de rueda
  const stateRef = useRef({ k, t, fit, fw, fh, tx0, ty0, box });
  stateRef.current = { k, t, fit, fw, fh, tx0, ty0, box };

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampT = useCallback(
    (x: number, y: number, kk: number) => {
      const s = stateRef.current;
      const w = s.fw * kk;
      const h = s.fh * kk;
      const minX = Math.min(s.box.w - w, s.tx0);
      const maxX = Math.max(0, s.tx0);
      const minY = Math.min(s.box.h - h, s.ty0);
      const maxY = Math.max(0, s.ty0);
      return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
    },
    [],
  );

  // Reiniciar vista al cambiar de imagen o con resetKey
  useLayoutEffect(() => {
    setError(false);
    setRectScreen(null);
    // Si la imagen ya está en caché, onLoad pudo dispararse antes que este efecto.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) setNat({ w: img.naturalWidth, h: img.naturalHeight });
    else setNat({ w: 0, h: 0 });
  }, [src]);

  useEffect(() => {
    setT({ x: tx0, y: ty0 });
    if (zoom !== 1) onZoomChange(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, src, tx0, ty0]);

  // Zoom externo (botones / slider): mantiene el centro del visor fijo
  const prevK = useRef(k);
  useEffect(() => {
    const old = prevK.current;
    prevK.current = k;
    if (old === k) return;
    const s = stateRef.current;
    if (k === 1) {
      setT({ x: s.tx0, y: s.ty0 });
      return;
    }
    const cx = s.box.w / 2;
    const cy = s.box.h / 2;
    const r = k / old;
    setT((prev) => clampT(cx - (cx - prev.x) * r, cy - (cy - prev.y) * r, k));
  }, [k, clampT]);

  // Rueda: listener nativo no pasivo para poder evitar el scroll de la página
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k2 = clamp(s.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_K, MAX_K);
      if (k2 === s.k) return;
      const r = k2 / s.k;
      prevK.current = k2;
      setT(k2 === 1 ? { x: s.tx0, y: s.ty0 } : clampT(px - (px - s.t.x) * r, py - (py - s.t.y) * r, k2));
      onZoomChange(Number(k2.toFixed(2)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onZoomChange, clampT]);

  // Esc sale del modo recorte
  useEffect(() => {
    if (!modoRecorte) {
      setRectScreen(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onSalirRecorte();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [modoRecorte, onSalirRecorte]);

  const local = (e: React.PointerEvent) => {
    const rect = boxRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const toNatural = (px: number, py: number) => ({
    x: clamp((px - t.x) / k / fit, 0, nat.w),
    y: clamp((py - t.y) / k / fit, 0, nat.h),
  });
  const toScreen = (nx: number, ny: number) => ({ x: nx * fit * k + t.x, y: ny * fit * k + t.y });

  const onPointerDown = (e: React.PointerEvent) => {
    if (error || !nat.w) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { px, py } = local(e);
    if (modoRecorte) {
      drag.current = { mode: 'crop', x0: px, y0: py, tx: t.x, ty: t.y, startNat: toNatural(px, py) };
      setRectScreen(null);
    } else if (k > 1) {
      drag.current = { mode: 'pan', x0: px, y0: py, tx: t.x, ty: t.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { px, py } = local(e);
    if (d.mode === 'pan') {
      setT(clampT(d.tx + (px - d.x0), d.ty + (py - d.y0), k));
    } else if (d.startNat) {
      const a = toScreen(d.startNat.x, d.startNat.y);
      const b = toScreen(toNatural(px, py).x, toNatural(px, py).y);
      setRectScreen({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== 'crop' || !d.startNat) return;
    const { px, py } = local(e);
    const end = toNatural(px, py);
    const r: RectNat = {
      x: Math.round(Math.min(d.startNat.x, end.x)),
      y: Math.round(Math.min(d.startNat.y, end.y)),
      w: Math.round(Math.abs(end.x - d.startNat.x)),
      h: Math.round(Math.abs(end.y - d.startNat.y)),
    };
    if (r.w < 16 || r.h < 8) {
      setRectScreen(null);
      return;
    }
    onRecorte(r);
  };

  const cursor = modoRecorte ? 'crosshair' : k > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in';

  return (
    <div
      ref={boxRef}
      className={`relative select-none overflow-hidden bg-[#141012] ${className || ''}`}
      style={{ touchAction: 'none', cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => {
        if (modoRecorte) return;
        prevK.current = 1;
        onZoomChange(1);
        setT({ x: tx0, y: ty0 });
      }}
      data-testid="visor"
    >
      <div
        style={{
          transform: `translate(${t.x}px, ${t.y}px) scale(${k})`,
          transformOrigin: '0 0',
          width: fw || '100%',
          height: fh || '100%',
          willChange: 'transform',
        }}
      >
        <img
          ref={imgRef}
          src={error ? IMG_FALLBACK : src}
          alt="Captura del vehículo"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNat({ w: img.naturalWidth, h: img.naturalHeight });
            onLoadedChange?.(!error);
          }}
          onError={() => {
            setError(true);
            onLoadedChange?.(false);
          }}
          style={{ width: fw || '100%', height: fh || '100%', display: 'block', opacity: nat.w ? 1 : 0 }}
        />
      </div>
      {modoRecorte && rectScreen && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-dashed border-white"
          style={{
            left: rectScreen.x,
            top: rectScreen.y,
            width: rectScreen.w,
            height: rectScreen.h,
            boxShadow: '0 0 0 9999px rgba(0,0,0,.5)',
          }}
        />
      )}
      {modoRecorte && !rectScreen && <div className="pointer-events-none absolute inset-0 bg-black/30" />}
    </div>
  );
};

export default VisorImagen;
