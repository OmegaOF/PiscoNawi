import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IdentificationIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { usePlacasFilters } from '../hooks/usePlacasFilters';
import { useSection } from '../hooks/useSection';
import { placasApi, ResumenPlacas, VehiculoPlaca } from '../lib/placasApi';
import { errorMessage } from '../lib/reportsApi';
import { useToast } from '../components/ui/Toast';
import ProgresoPlacas from './placas/ProgresoPlacas';
import FiltrosPlacas from './placas/FiltrosPlacas';
import ColaVehiculos from './placas/ColaVehiculos';
import EstacionPlaca from './placas/EstacionPlaca';

const SIZE = 24;

const Placas: React.FC = () => {
  const f = usePlacasFilters();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const key = JSON.stringify(f.listParams);
  const lista = useSection(() => placasApi.list({ ...f.listParams, size: SIZE }), key);
  const opciones = useSection(placasApi.filtros, 'placas-filtros');
  const pinned = useSection(() => placasApi.get(f.imagenId as number), `pin-${f.imagenId}`, f.imagenId != null);

  const [items, setItems] = useState<VehiculoPlaca[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ResumenPlacas | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Copia local (actualizaciones optimistas)
  useEffect(() => {
    if (!lista.data) return;
    setItems(lista.data.items);
    setTotal(lista.data.total);
    setResumen(lista.data.resumen);
  }, [lista.data]);

  // Selección: vínculo directo (?imagen=) o primer elemento
  useEffect(() => {
    if (f.imagenId != null) {
      setSelId(f.imagenId);
      return;
    }
    if (selId == null || !items.some((i) => i.imagen_id === selId)) setSelId(items[0]?.imagen_id ?? null);
  }, [items, selId, f.imagenId]);

  const actual = useMemo(() => {
    if (f.imagenId != null && pinned.data?.imagen_id === f.imagenId) {
      return items.find((i) => i.imagen_id === f.imagenId) ?? pinned.data;
    }
    return items.find((i) => i.imagen_id === selId) ?? null;
  }, [items, selId, f.imagenId, pinned.data]);

  const idx = actual ? items.findIndex((i) => i.imagen_id === actual.imagen_id) : -1;

  const seleccionar = useCallback(
    (id: number | null) => {
      if (f.imagenId != null) f.set({ imagen: null }, false);
      setSelId(id);
    },
    [f],
  );

  const irA = useCallback(
    (delta: number) => {
      if (!items.length) return;
      const base = idx < 0 ? (delta > 0 ? -1 : items.length) : idx;
      const next = items[base + delta];
      if (next) seleccionar(next.imagen_id);
    },
    [items, idx, seleccionar],
  );

  const guardar = useCallback(
    async (placa: string | null) => {
      if (!actual) return;
      const id = actual.imagen_id;
      const pos = items.findIndex((i) => i.imagen_id === id);
      const nextId = pos >= 0 ? items[pos + 1]?.imagen_id ?? items[pos - 1]?.imagen_id ?? null : items[0]?.imagen_id ?? null;
      const teniaPlaca = !!actual.placa_manual;
      setGuardando(true);
      try {
        const res = await placasApi.update(id, placa);
        toast.success(res.placa_manual ? `Placa ${res.placa_manual} guardada` : 'Placa eliminada');
        const ahoraTiene = !!res.placa_manual;
        const sale = (f.estado === 'sin_placa' && ahoraTiene) || (f.estado === 'con_placa' && !ahoraTiene);
        if (sale) {
          setItems((xs) => xs.filter((x) => x.imagen_id !== id));
          setTotal((t) => Math.max(0, t - 1));
        } else {
          setItems((xs) => xs.map((x) => (x.imagen_id === id ? { ...x, placa_manual: res.placa_manual } : x)));
        }
        if (teniaPlaca !== ahoraTiene) {
          setResumen((r) =>
            r
              ? (() => {
                  const con = r.con_placa + (ahoraTiene ? 1 : -1);
                  return { ...r, con_placa: con, sin_placa: r.total - con, pct_completado: r.total ? Math.round((con / r.total) * 1000) / 10 : 0 };
                })()
              : r,
          );
        }
        if (f.imagenId != null) f.set({ imagen: null }, false);
        setSelId(sale || pos < 0 ? nextId : nextId ?? id);
        if (sale && items.length - 1 <= 6 && total - 1 > items.length - 1) lista.reload();
      } catch (e) {
        toast.error(errorMessage(e, 'No se pudo guardar la placa'));
      } finally {
        setGuardando(false);
      }
    },
    [actual, items, f, toast, total, lista],
  );

  // Atajos: Alt+← / Alt+→
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        irA(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        irA(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [irA]);

  const vacio = !lista.loading && items.length === 0 && !actual;
  const todoListo = vacio && f.estado === 'sin_placa' && resumen?.sin_placa === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Capturas & Análisis</p>
          <h1 className="text-3xl font-extrabold text-vino sm:text-4xl">Registro de placas</h1>
          <p className="mt-1 text-sm text-text-muted">Revisa cada vehículo detectado con smog y escribe su placa. Usa el zoom para leerla mejor.</p>
        </div>
      </header>

      <ProgresoPlacas resumen={resumen} soloSmog={f.soloSmog} loading={lista.loading && !resumen} />

      <FiltrosPlacas
        estado={f.estado}
        soloSmog={f.soloSmog}
        q={f.q}
        preset={f.preset}
        ubicacionId={f.ubicacion_id}
        dispositivoId={f.dispositivo_id}
        zonas={opciones.data?.zonas || []}
        dispositivos={opciones.data?.dispositivos || []}
        loading={lista.loading}
        onSet={f.set}
        onPreset={f.setPreset}
        onReload={lista.reload}
      />

      {lista.error && !lista.data && (
        <div className="mb-4 rounded-xl border border-smog-alto/30 bg-smog-alto/5 p-3 text-sm text-smog-alto">
          {lista.error}{' '}
          <button onClick={lista.reload} className="font-medium underline">
            Reintentar
          </button>
        </div>
      )}

      {vacio ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-neutral-border bg-white py-16 text-center">
          <img src="/art-1.png" alt="" className="h-28 w-28 object-contain" />
          {todoListo ? (
            <>
              <h2 className="text-2xl font-bold text-vino">¡Todas las placas registradas!</h2>
              <p className="max-w-md text-sm text-text-muted">No quedan vehículos con smog sin placa para los filtros elegidos.</p>
              <button onClick={() => f.set({ estado: 'todas' })} className="rounded-xl bg-rojo-tinto px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                Ver todos los vehículos
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-text-dark">Sin resultados</h2>
              <p className="text-sm text-text-muted">Ningún vehículo coincide con los filtros.</p>
              <button onClick={f.limpiar} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-rojo-tinto ring-1 ring-rojo-tinto/30 hover:bg-rojo-tinto/5">
                <FunnelIcon className="h-4 w-4" /> Limpiar filtros
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <ColaVehiculos
            className="lg:col-span-4"
            items={items}
            selId={actual?.imagen_id ?? null}
            onSelect={seleccionar}
            total={total}
            page={f.page}
            size={SIZE}
            onPage={(p) => f.set({ page: p > 1 ? p : null }, false)}
            loading={lista.loading}
          />
          <div className="min-w-0 lg:col-span-8">
            {actual ? (
              <EstacionPlaca
                className="lg:sticky lg:top-24"
                item={actual}
                posicion={idx >= 0 ? `${idx + 1 + (f.page - 1) * SIZE} de ${total}` : 'Vehículo seleccionado'}
                guardando={guardando}
                inputRef={inputRef}
                onGuardar={(p) => guardar(p)}
                onQuitar={() => guardar(null)}
                onOmitir={() => irA(1)}
                onPrev={() => irA(-1)}
                onNext={() => irA(1)}
                hasPrev={idx > 0}
                hasNext={idx < items.length - 1}
              />
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-border bg-white text-text-muted">
                <IdentificationIcon className="h-10 w-10" />
                <p className="text-sm">{lista.loading ? 'Cargando vehículos…' : 'Selecciona un vehículo de la cola.'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Placas;
