import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyRole, ROLE_ADMIN } from '../../lib/rbac';

interface Pais { id: number; nombre: string; codigo_iso?: string | null; }
interface Provincia { id: number; nombre: string; pais_id: number; }
interface Ciudad { id: number; nombre: string; provincia_id: number; latitud?: number | null; longitud?: number | null; }

const Catalogos: React.FC = () => {
  const { roles } = useAuth();
  const canEdit = hasAnyRole(roles, [ROLE_ADMIN]);
  const [paises, setPaises] = useState<Pais[]>([]);
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [paisId, setPaisId] = useState<number | ''>('');
  const [provinciaId, setProvinciaId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Ciudad | null>(null);
  const [form, setForm] = useState({ nombre: '', provincia_id: '', latitud: '', longitud: '' });

  useEffect(() => {
    api.get<Pais[]>('/catalogos/paises').then((r) => setPaises(r.data)).catch(() => setError('No se pudo cargar países'));
  }, []);

  useEffect(() => {
    if (!paisId) { setProvincias([]); return; }
    api.get<Provincia[]>('/catalogos/provincias', { params: { pais_id: paisId } }).then((r) => setProvincias(r.data)).catch(() => setError('No se pudo cargar provincias'));
  }, [paisId]);

  useEffect(() => {
    if (!provinciaId) { setCiudades([]); return; }
    api.get<Ciudad[]>('/catalogos/ciudades', { params: { provincia_id: provinciaId } }).then((r) => setCiudades(r.data)).catch(() => setError('No se pudo cargar ciudades'));
  }, [provinciaId]);

  const submitCiudad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: form.nombre,
        provincia_id: Number(form.provincia_id),
        latitud: form.latitud ? Number(form.latitud) : null,
        longitud: form.longitud ? Number(form.longitud) : null,
      };
      if (editing) {
        await api.put(`/catalogos/ciudades/${editing.id}`, payload);
      } else {
        await api.post('/catalogos/ciudades', payload);
      }
      setForm({ nombre: '', provincia_id: provinciaId ? String(provinciaId) : '', latitud: '', longitud: '' });
      setEditing(null);
      if (provinciaId) {
        const r = await api.get<Ciudad[]>('/catalogos/ciudades', { params: { provincia_id: provinciaId } });
        setCiudades(r.data);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo guardar ciudad');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Catálogos Geográficos</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid md:grid-cols-2 gap-3">
          <select className="border rounded px-3 py-2" value={paisId} onChange={(e) => { setPaisId(Number(e.target.value) || ''); setProvinciaId(''); }}>
            <option value="">Seleccione país</option>
            {paises.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select className="border rounded px-3 py-2" value={provinciaId} onChange={(e) => setProvinciaId(Number(e.target.value) || '')} disabled={!paisId}>
            <option value="">Seleccione provincia</option>
            {provincias.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        {canEdit && (
          <form onSubmit={submitCiudad} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid md:grid-cols-5 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Nombre ciudad" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            <input className="border rounded px-3 py-2" placeholder="Provincia ID" value={form.provincia_id} onChange={(e) => setForm({ ...form, provincia_id: e.target.value })} required />
            <input className="border rounded px-3 py-2" placeholder="Latitud" value={form.latitud} onChange={(e) => setForm({ ...form, latitud: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Longitud" value={form.longitud} onChange={(e) => setForm({ ...form, longitud: e.target.value })} />
            <button className="bg-vino text-white rounded px-4 py-2">{editing ? 'Actualizar ciudad' : 'Crear ciudad'}</button>
          </form>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">ID</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Ciudad</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Provincia</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Lat/Lng</th>
                {canEdit && <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ciudades.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm">{c.id}</td>
                  <td className="px-4 py-2 text-sm">{c.nombre}</td>
                  <td className="px-4 py-2 text-sm">{c.provincia_id}</td>
                  <td className="px-4 py-2 text-sm">{c.latitud ?? '—'} / {c.longitud ?? '—'}</td>
                  {canEdit && <td className="px-4 py-2 text-sm"><button className="border rounded px-2 py-1" onClick={() => { setEditing(c); setForm({ nombre: c.nombre, provincia_id: String(c.provincia_id), latitud: c.latitud ? String(c.latitud) : '', longitud: c.longitud ? String(c.longitud) : '' }); }}>Editar</button></td>}
                </tr>
              ))}
              {ciudades.length === 0 && <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={canEdit ? 5 : 4}>Seleccione país/provincia para ver ciudades.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Catalogos;
