import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  CameraIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  MapPinIcon,
  TrashIcon,
  UserIcon,
  ViewfinderCircleIcon,
  ForwardIcon,
} from '@heroicons/react/24/outline';
import VisorImagen from './VisorImagen';
import OcrPanel from './OcrPanel';
import NivelBadge from '../../components/reports/NivelBadge';
import { useOcrPlaca } from '../../hooks/useOcrPlaca';
import { esFormatoBoliviano, normalizarPlaca, VehiculoPlaca } from '../../lib/placasApi';
import { RectNat } from '../../lib/ocrPlaca';
import { fmtDateTime, fmtPct01 } from '../../lib/format';
import { cx } from '../../lib/cx';

interface Props {
  item: VehiculoPlaca;
  posicion: string;
  guardando: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onGuardar: (placa: string) => void;
  onQuitar: () => void;
  onOmitir: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  className?: string;
}

const EstacionPlaca: React.FC<Props> = ({ item, posicion, guardando, inputRef, onGuardar, onQuitar, onOmitir, onPrev, onNext, hasPrev, hasNext, className }) => {
  const [valor, setValor] = useState(item.placa_manual || '');
  const [zoom, setZoom] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [modoRecorte, setModoRecorte] = useState(false);
  const [imagenOk, setImagenOk] = useState(true);
  const ocr = useOcrPlaca();
  const { descartar } = ocr;

  // Al cambiar de vehículo: reiniciar formulario, visor y lector
  useEffect(() => {
    setValor(item.placa_manual || '');
    setModoRecorte(false);
    setImagenOk(true);
    descartar();
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    });
  }, [item.imagen_id, item.placa_manual, descartar, inputRef]);

  const onRecorte = useCallback(
    (r: RectNat) => {
      setModoRecorte(false);
      ocr.leer(item.ruta_archivo, r);
    },
    [ocr, item.ruta_archivo],
  );

  const salirRecorte = useCallback(() => setModoRecorte(false), []);

  const valido = valor !== '' && esFormatoBoliviano(valor);
  const sinCambios = valor === (item.placa_manual || '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor || guardando) return;
    if (sinCambios) {
      onNext();
      return;
    }
    onGuardar(valor);
  };

  const usarLectura = (texto: string) => {
    setValor(normalizarPlaca(texto));
    descartar();
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const iniciarRecorte = () => {
    descartar();
    setModoRecorte(true);
  };

  return (
    <div className={cx('overflow-hidden rounded-2xl border border-neutral-border bg-white shadow-sm', className)}>
      {/* Visor */}
      <div className="relative">
        <VisorImagen
          src={item.ruta_archivo}
          zoom={zoom}
          onZoomChange={setZoom}
          resetKey={resetKey}
          modoRecorte={modoRecorte}
          onRecorte={onRecorte}
          onSalirRecorte={salirRecorte}
          onLoadedChange={setImagenOk}
          className="aspect-[16/10] w-full"
        />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{posicion}</span>
          <NivelBadge pct={item.p_smog * 100} size="sm" className="bg-white/90" />
        </div>
        {modoRecorte && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
              Dibuja un rectángulo sobre la placa · Esc para cancelar
            </span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-white backdrop-blur">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, Number((z / 1.25).toFixed(2))))} className="rounded-full p-1 hover:bg-white/20" aria-label="Alejar">
              <MagnifyingGlassMinusIcon className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={1}
              max={6}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Nivel de zoom"
              className="w-24 accent-white"
            />
            <button type="button" onClick={() => setZoom((z) => Math.min(6, Number((z * 1.25).toFixed(2))))} className="rounded-full p-1 hover:bg-white/20" aria-label="Acercar">
              <MagnifyingGlassPlusIcon className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-xs tabular-nums">{zoom.toFixed(1)}×</span>
            <button type="button" onClick={() => setResetKey((k) => k + 1)} className="rounded-full p-1 hover:bg-white/20" aria-label="Restablecer vista" title="Restablecer (doble clic)">
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={modoRecorte ? salirRecorte : iniciarRecorte}
            disabled={!imagenOk || ocr.estado === 'preparando' || ocr.estado === 'leyendo'}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-lg backdrop-blur transition disabled:opacity-40',
              modoRecorte ? 'bg-white text-rojo-tinto' : 'bg-rojo-tinto/90 text-white hover:bg-rojo-tinto',
            )}
            title="Selecciona la placa con el mouse y el lector intentará leerla"
            data-testid="btn-ocr"
          >
            <ViewfinderCircleIcon className="h-4 w-4" />
            {modoRecorte ? 'Cancelar selección' : 'Intentar leer placa'}
          </button>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Datos del vehículo */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="h-4 w-4" /> {item.ubicacion_nombre || 'Sin zona'}
          </span>
          <span className="inline-flex items-center gap-1">
            <CameraIcon className="h-4 w-4" /> {item.dispositivo_nombre || 'Sin dispositivo'}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-4 w-4" /> {fmtDateTime(item.fecha_prediccion)}
          </span>
          {item.usuario_nombre && (
            <span className="inline-flex items-center gap-1">
              <UserIcon className="h-4 w-4" /> {item.usuario_nombre}
            </span>
          )}
          <span className="ml-auto text-text-dark">
            Prob. de smog <strong>{fmtPct01(item.p_smog, 1)}</strong> · Confianza <strong>{fmtPct01(item.confianza, 1)}</strong>
          </span>
        </div>

        <OcrPanel
          estado={ocr.estado}
          progreso={ocr.progreso}
          resultado={ocr.resultado}
          error={ocr.error}
          onUsar={usarLectura}
          onDescartar={descartar}
          onReintentar={iniciarRecorte}
        />

        {/* Formulario de placa */}
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="placa-input" className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
            Placa del vehículo
          </label>
          <div className="flex items-stretch gap-2">
            <button type="button" onClick={onPrev} disabled={!hasPrev} className="rounded-xl px-2 text-text-muted ring-1 ring-neutral-border hover:bg-neutral-bg disabled:opacity-30" aria-label="Vehículo anterior" title="Anterior (Alt+←)">
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <div className="relative flex-1">
              <input
                id="placa-input"
                ref={inputRef}
                value={valor}
                onChange={(e) => setValor(normalizarPlaca(e.target.value))}
                maxLength={10}
                autoComplete="off"
                spellCheck={false}
                placeholder="1234ABC"
                data-testid="placa-input"
                className={cx(
                  'h-16 w-full rounded-xl border-2 bg-white text-center font-mono text-3xl font-bold uppercase tracking-[0.3em] text-text-dark placeholder:text-neutral-border focus:outline-none focus:ring-4',
                  valor === '' ? 'border-neutral-border focus:border-rojo-tinto focus:ring-rojo-tinto/15' : valido ? 'border-smog-bajo focus:ring-smog-bajo/20' : 'border-smog-moderado focus:ring-smog-moderado/20',
                )}
              />
              {valido && <CheckCircleIcon className="absolute right-4 top-1/2 h-7 w-7 -translate-y-1/2 text-smog-bajo" />}
            </div>
            <button type="button" onClick={onNext} disabled={!hasNext} className="rounded-xl px-2 text-text-muted ring-1 ring-neutral-border hover:bg-neutral-bg disabled:opacity-30" aria-label="Vehículo siguiente" title="Siguiente (Alt+→)">
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </div>
          {valor && !valido ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-smog-moderado/15 px-3 py-2 text-xs text-[#A86E00]">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              No parece una placa boliviana (3-4 dígitos + 3 letras). Puedes guardarla igual.
            </p>
          ) : (
            <p className="text-xs text-text-muted">Formato boliviano: 3 o 4 dígitos y 3 letras, por ejemplo 1234ABC. Presiona Enter para guardar.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!valor || guardando}
              data-testid="btn-guardar"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rojo-tinto px-5 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
            >
              {guardando ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <CheckCircleIcon className="h-5 w-5" />
              )}
              {sinCambios && valor ? 'Siguiente' : 'Guardar y siguiente'}
            </button>
            <button type="button" onClick={onOmitir} disabled={!hasNext} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium text-text-dark ring-1 ring-neutral-border hover:bg-neutral-bg disabled:opacity-30">
              <ForwardIcon className="h-4 w-4" /> Omitir
            </button>
            {item.placa_manual && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Quitar la placa ${item.placa_manual} de este vehículo?`)) onQuitar();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium text-smog-alto ring-1 ring-smog-alto/30 hover:bg-smog-alto/5"
              >
                <TrashIcon className="h-4 w-4" /> Quitar placa
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default EstacionPlaca;
