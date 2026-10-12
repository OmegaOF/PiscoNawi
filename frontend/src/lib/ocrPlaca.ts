/**
 * Asistente opcional de lectura de placas con Tesseract.js (se ejecuta en el navegador).
 * Los archivos del lector se sirven localmente desde /public/tesseract (funciona sin internet).
 * El resultado solo pre-llena el campo: el usuario siempre confirma antes de guardar.
 */
import type Tesseract from 'tesseract.js';
import { PLACA_MAX, PLACA_REGEX } from './placasApi';

export interface RectNat {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LecturaPlaca {
  texto: string;
  confianza: number;
  previewDataUrl: string;
  formatoOk: boolean;
}

export type OcrProgress = (status: string, progress: number) => void;

const ASSETS = `${process.env.PUBLIC_URL || ''}/tesseract`;
const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

let workerP: Promise<Tesseract.Worker> | null = null;
let progressCb: OcrProgress | undefined;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function getOcrWorker(onProgress?: OcrProgress): Promise<Tesseract.Worker> {
  progressCb = onProgress;
  if (!workerP) {
    workerP = (async () => {
      const T = await import('tesseract.js');
      const w = await T.createWorker('eng', T.OEM.LSTM_ONLY, {
        workerPath: `${ASSETS}/worker.min.js`,
        corePath: ASSETS,
        langPath: ASSETS,
        gzip: true,
        cacheMethod: 'write',
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => progressCb?.(m.status, m.progress),
      });
      await w.setParameters({
        tessedit_char_whitelist: WHITELIST,
        tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
      });
      return w;
    })().catch((e) => {
      workerP = null;
      throw e;
    });
  }
  return workerP;
}

export async function terminarOcrWorker(): Promise<void> {
  const p = workerP;
  workerP = null;
  if (!p) return;
  try {
    (await p).terminate();
  } catch {
    /* ignorar */
  }
}

async function cargarBitmap(url: string): Promise<ImageBitmap | HTMLImageElement> {
  // Se descarga como Blob para evitar un canvas "contaminado" (imagen de otro origen).
  // cache: 'no-store' evita reutilizar la copia del <img> (descargada sin cabecera CORS).
  const resp = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
  if (!resp.ok) throw new Error('No se pudo descargar la imagen');
  const blob = await resp.blob();
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const objUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = objUrl;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  }
}

/** Recorta la zona elegida y la devuelve en escala de grises con altura fija. */
async function recorteGris(url: string, r: RectNat, altura = 150): Promise<{ g: Uint8ClampedArray; W: number; H: number }> {
  const bmp = await cargarBitmap(url);
  const H = altura;
  const W = Math.max(1, Math.round((r.w * H) / r.h));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, W, H);
  if ('close' in bmp) bmp.close();
  const d = ctx.getImageData(0, 0, W, H).data;
  const g = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return { g, W, H };
}

function umbralOtsu(g: Uint8ClampedArray): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < g.length; i++) hist[g[i]]++;
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0;
  let wB = 0;
  let best = -1;
  let thr = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (!wB) continue;
    const wF = g.length - wB;
    if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = v;
    }
  }
  return thr;
}

interface Componente { id: number; x0: number; y0: number; x1: number; y1: number }

/** Etiqueta componentes conectados (4-vecindad) de la máscara de tinta. */
function componentes(ink: Uint8Array, W: number, H: number): { lab: Int32Array; comps: Componente[] } {
  const lab = new Int32Array(W * H).fill(-1);
  const comps: Componente[] = [];
  const stack = new Int32Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (!ink[start] || lab[start] >= 0) continue;
    const id = comps.length;
    const c: Componente = { id, x0: W, y0: H, x1: 0, y1: 0 };
    let top = 0;
    stack[top++] = start;
    lab[start] = id;
    while (top) {
      const p = stack[--top];
      const x = p % W;
      const y = (p - x) / W;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      const vecinos = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of vecinos) {
        if (q >= 0 && ink[q] && lab[q] < 0) {
          lab[q] = id;
          stack[top++] = q;
        }
      }
    }
    comps.push(c);
  }
  return { lab, comps };
}

/**
 * Deja solo los caracteres grandes de la placa (quita marco, carrocería, texto "BOLIVIA")
 * y devuelve un canvas negro sobre blanco recortado a esos caracteres.
 */
function aislarCaracteres(g: Uint8ClampedArray, W: number, H: number): { canvas: HTMLCanvasElement; n: number } | null {
  const thr = umbralOtsu(g);
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) ink[i] = g[i] < thr ? 1 : 0;
  // Si el centro de la selección es mayormente oscuro, la placa tiene texto claro: invertir.
  let dark = 0;
  let tot = 0;
  for (let y = Math.floor(H / 4); y < (3 * H) / 4; y++)
    for (let x = Math.floor(W / 4); x < (3 * W) / 4; x++) {
      dark += ink[y * W + x];
      tot++;
    }
  if (tot && dark / tot > 0.5) for (let i = 0; i < ink.length; i++) ink[i] = 1 - ink[i];

  const { lab, comps } = componentes(ink, W, H);
  const cand = comps.filter((c) => {
    const w = c.x1 - c.x0;
    const h = c.y1 - c.y0;
    const tocaBorde = c.x0 === 0 || c.y0 === 0 || c.x1 === W - 1 || c.y1 === H - 1;
    return !tocaBorde && w < W * 0.4 && h > H * 0.15 && h >= w * 0.8;
  });
  if (!cand.length) return null;
  const hmax = Math.max(...cand.map((c) => c.y1 - c.y0));
  const keep = cand.filter((c) => c.y1 - c.y0 >= 0.6 * hmax);
  const ids = new Set(keep.map((c) => c.id));
  const x0 = Math.min(...keep.map((c) => c.x0));
  const x1 = Math.max(...keep.map((c) => c.x1));
  const y0 = Math.min(...keep.map((c) => c.y0));
  const y1 = Math.max(...keep.map((c) => c.y1));
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const out = ctx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const v = ids.has(lab[(y + y0) * W + (x + x0)]) ? 0 : 255;
      const o = (y * cw + x) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
      out.data[o + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
  return { canvas, n: keep.length };
}

/** Variante para Tesseract: altura fija, estiramiento horizontal y margen blanco. */
function variante(base: HTMLCanvasElement, altura: number, sx: number, pad = 20): HTMLCanvasElement {
  const w = Math.max(1, Math.round((base.width * altura * sx) / base.height));
  const c = document.createElement('canvas');
  c.width = w + 2 * pad;
  c.height = altura + 2 * pad;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(base, pad, pad, w, altura);
  return c;
}

/** Recorte en grises con contraste estirado (respaldo si no se aíslan caracteres). */
function grisCanvas(g: Uint8ClampedArray, W: number, H: number, pad = 12): HTMLCanvasElement {
  const sorted = Array.from(g).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const span = Math.max(1, hi - lo);
  const c = document.createElement('canvas');
  c.width = W + 2 * pad;
  c.height = H + 2 * pad;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = clamp(((g[i] - lo) * 255) / span, 0, 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, pad, pad);
  return c;
}

const A_DIGITO: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };
const A_LETRA: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '4': 'A', '7': 'T' };

/** Corrige confusiones típicas para ajustar el texto al formato boliviano. Devuelve null si no encaja. */
export function ajustarFormato(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const len of [7, 6]) {
    for (let i = 0; i + len <= s.length; i++) {
      const w = s.slice(i, i + len);
      const nd = len - 3;
      const fixed =
        Array.from(w.slice(0, nd))
          .map((ch) => A_DIGITO[ch] ?? ch)
          .join('') +
        Array.from(w.slice(nd))
          .map((ch) => A_LETRA[ch] ?? ch)
          .join('');
      if (PLACA_REGEX.test(fixed)) return fixed;
    }
  }
  return null;
}

export function postprocesarTexto(raw: string): string {
  return ajustarFormato(raw) ?? raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PLACA_MAX);
}

/** Elige la lectura más repetida; en empate, vota carácter por carácter. */
function elegirPorVotos(cands: string[]): { texto: string; votos: number } {
  const cuenta = new Map<string, number>();
  cands.forEach((c) => cuenta.set(c, (cuenta.get(c) || 0) + 1));
  const max = Math.max(...Array.from(cuenta.values()));
  const top = Array.from(cuenta.entries()).filter(([, v]) => v === max).map(([k]) => k);
  if (top.length === 1) return { texto: top[0], votos: max };
  const len = top[0].length;
  const mismos = cands.filter((c) => c.length === len);
  let texto = '';
  for (let i = 0; i < len; i++) {
    const m = new Map<string, number>();
    mismos.forEach((c) => m.set(c[i], (m.get(c[i]) || 0) + 1));
    texto += Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }
  return { texto, votos: cands.filter((c) => c === texto).length || max };
}

const ALTURAS = [60, 100, 130];
const ESTIRAMIENTOS = [1.0, 1.25, 1.5];

/**
 * Lee la placa dentro del rectángulo elegido por el usuario:
 * aísla los caracteres, prueba varias versiones con Tesseract, corrige al formato
 * boliviano y elige la lectura más repetida. `confianza` = % de versiones que coinciden.
 */
export async function leerPlaca(url: string, rect: RectNat, onProgress?: OcrProgress): Promise<LecturaPlaca> {
  const worker = await getOcrWorker(onProgress);
  const { g, W, H } = await recorteGris(url, rect);
  const aislado = aislarCaracteres(g, W, H);
  const opciones = { text: true, blocks: false, hocr: false, tsv: false };

  if (aislado) {
    const cands: string[] = [];
    let i = 0;
    const total = ALTURAS.length * ESTIRAMIENTOS.length;
    for (const h of ALTURAS) {
      for (const sx of ESTIRAMIENTOS) {
        const { data } = await worker.recognize(variante(aislado.canvas, h, sx), {}, opciones);
        const ok = ajustarFormato(data.text || '');
        if (ok) cands.push(ok);
        onProgress?.('recognizing text', ++i / total);
      }
    }
    const preview = variante(aislado.canvas, 80, 1.0).toDataURL('image/png');
    if (cands.length) {
      const { texto, votos } = elegirPorVotos(cands);
      return { texto, confianza: Math.round((votos / total) * 100), previewDataUrl: preview, formatoOk: true };
    }
  }

  // Respaldo: lectura directa del recorte en grises
  const gris = grisCanvas(g, W, H);
  const { data } = await worker.recognize(gris, {}, opciones);
  const texto = postprocesarTexto(data.text || '');
  return {
    texto: texto.length >= 5 ? texto : '',
    confianza: Math.round(data.confidence || 0),
    previewDataUrl: (aislado ? variante(aislado.canvas, 80, 1.0) : gris).toDataURL('image/png'),
    formatoOk: PLACA_REGEX.test(texto),
  };
}
