import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyRole, ROLE_ADMIN, ROLE_DEV } from '../../lib/rbac';

interface DispositivoItem {
  id: number;
  nombre_dispositivo: string;
  tipo_dispositivo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  resolucion?: string | null;
  fps?: number | null;
  interfaz?: string | null;
  ubicacion_fisica?: string | null;
  fecha_instalacion?: string | null;
  activo?: boolean | null;
}
interface HistorialItem {
  id: number;
  dispositivo_id: number;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  observaciones?: string | null;
}

const DispositivosAdmin: React.FC = () => {
  const { roles } = useAuth();
  const canAdmin = hasAnyRole(roles, [ROLE_ADMIN, ROLE_DEV]);
  const canCreate = hasAnyRole(roles, [ROLE_ADMIN]);

  const [items, setItems] = useState<DispositivoItem[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ nombre_dispositivo: '', activo: true });
  const [editing, setEditing] = useState<number | null>(null);
  const [historialForm, setHistorialForm] = useState({ fecha_inicio: '', fecha_fin: '', observaciones: '' });

  const load = async () => {
    try {
      const res = await api.get<DispositivoItem[]>('/dispositivos');
      setItems(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar dispositivos');
    }
  };

  const loadHistorial = async (id: number) => {
    setSelectedId(id);
    try {
      const res = await api.get<HistorialItem[]>(`/dispositivos/${id}/historial`);
      setHistorial(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar historial');
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/dispositivos/${editing}`, form);
      } else {
        await api.post('/dispositivos', form);
      }
      setForm({ nombre_dispositivo: '', activo: true });
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo guardar dispositivo');
    }
  };

  const desactivar = async (id: number) => {
    if (!window.confirm('¿Desactivar dispositivo?')) return;
    try {
      await api.post(`/dispositivos/${id}/desactivar`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo desactivar');
    }
  };

  const addHistorial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await api.post(`/dispositivos/${selectedId}/historial`, historialForm);
      setHistorialForm({ fecha_inicio: '', fecha_fin: '', observaciones: '' });
      await loadHistorial(selectedId);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo registrar historial');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Dispositivos</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

        {(canCreate || (canAdmin && editing)) && (
          <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid md:grid-cols-4 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Nombre dispositivo" value={form.nombre_dispositivo || ''} onChange={(e) => setForm({ ...form, nombre_dispositivo: e.target.value })} required />
            <input className="border rounded px-3 py-2" placeholder="Tipo" value={form.tipo_dispositivo || ''} onChange={(e) => setForm({ ...form, tipo_dispositivo: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Marca" value={form.marca || ''} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Modelo" value={form.modelo || ''} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Resolución" value={form.resolucion || ''} onChange={(e) => setForm({ ...form, resolucion: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="FPS" type="number" value={form.fps || ''} onChange={(e) => setForm({ ...form, fps: Number(e.target.value) || null })} />
            <input className="border rounded px-3 py-2" placeholder="Interfaz" value={form.interfaz || ''} onChange={(e) => setForm({ ...form, interfaz: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Ubicación física" value={form.ubicacion_fisica || ''} onChange={(e) => setForm({ ...form, ubicacion_fisica: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Fecha instalación (ISO)" value={form.fecha_instalacion || ''} onChange={(e) => setForm({ ...form, fecha_instalacion: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
            <button className="bg-vino text-white rounded px-4 py-2" type="submit">{editing ? 'Guardar cambios' : 'Crear'}</button>
            {editing && <button className="border rounded px-4 py-2" type="button" onClick={() => { setEditing(null); setForm({ nombre_dispositivo: '', activo: true }); }}>Cancelar</button>}
          </form>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">ID</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Nombre</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Estado</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 text-sm">{d.id}</td>
                  <td className="px-4 py-2 text-sm">{d.nombre_dispositivo}</td>
                  <td className="px-4 py-2 text-sm">{d.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-4 py-2 text-sm flex gap-2">
                    {canAdmin && <button className="border rounded px-2 py-1" onClick={() => { setEditing(d.id); setForm(d); }}>Editar</button>}
                    {hasAnyRole(roles, [ROLE_ADMIN]) && <button className="bg-red-600 text-white rounded px-2 py-1" onClick={() => desactivar(d.id)}>Desactivar</button>}
                    {canAdmin && <button className="border rounded px-2 py-1" onClick={() => loadHistorial(d.id)}>Historial</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canAdmin && selectedId && (
          <div className="grid md:grid-cols-2 gap-6">
            <form onSubmit={addHistorial} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-vino">Registrar historial dispositivo #{selectedId}</h2>
              <input className="border rounded px-3 py-2 w-full" placeholder="fecha_inicio ISO" value={historialForm.fecha_inicio} onChange={(e) => setHistorialForm({ ...historialForm, fecha_inicio: e.target.value })} />
              <input className="border rounded px-3 py-2 w-full" placeholder="fecha_fin ISO" value={historialForm.fecha_fin} onChange={(e) => setHistorialForm({ ...historialForm, fecha_fin: e.target.value })} />
              <input className="border rounded px-3 py-2 w-full" placeholder="observaciones" value={historialForm.observaciones} onChange={(e) => setHistorialForm({ ...historialForm, observaciones: e.target.value })} />
              <button className="bg-vino text-white rounded px-4 py-2">Guardar historial</button>
            </form>

            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <h2 className="font-semibold text-vino p-4 border-b">Historial</h2>
              <table className="min-w-full">
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="px-4 py-2 text-sm">#{h.id}</td>
                      <td className="px-4 py-2 text-sm">{h.fecha_inicio || '—'} - {h.fecha_fin || '—'}</td>
                      <td className="px-4 py-2 text-sm">{h.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DispositivosAdmin;
