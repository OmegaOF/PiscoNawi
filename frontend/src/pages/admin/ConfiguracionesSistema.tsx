import React, { useEffect, useState } from 'react';
import api from '../../lib/api';

interface ConfigItem {
  id: number;
  clave: string;
  valor?: string | null;
  descripcion?: string | null;
  dispositivo_captura_id?: number | null;
}

const ConfiguracionesSistema: React.FC = () => {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ConfigItem | null>(null);
  const [form, setForm] = useState({ clave: '', valor: '', descripcion: '', dispositivo_captura_id: '' });

  const load = async () => {
    try {
      const res = await api.get<ConfigItem[]>('/configuraciones');
      setItems(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar configuraciones');
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...(editing ? {} : { clave: form.clave }),
        valor: form.valor || null,
        descripcion: form.descripcion || null,
        dispositivo_captura_id: form.dispositivo_captura_id ? Number(form.dispositivo_captura_id) : null,
      };
      if (editing) {
        await api.put(`/configuraciones/${editing.id}`, payload);
      } else {
        await api.post('/configuraciones', payload);
      }
      setEditing(null);
      setForm({ clave: '', valor: '', descripcion: '', dispositivo_captura_id: '' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo guardar configuración');
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Configuraciones del Sistema</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid md:grid-cols-5 gap-3">
          {!editing && <input className="border rounded px-3 py-2" placeholder="Clave" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} required />}
          <input className="border rounded px-3 py-2" placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="ID dispositivo" value={form.dispositivo_captura_id} onChange={(e) => setForm({ ...form, dispositivo_captura_id: e.target.value })} />
          <button className="bg-vino text-white rounded px-4 py-2">{editing ? 'Actualizar' : 'Crear'}</button>
        </form>

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Clave</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Valor</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Descripción</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Dispositivo</th>
                <th className="px-4 py-2 text-xs uppercase text-left text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm font-medium">{c.clave}</td>
                  <td className="px-4 py-2 text-sm">{c.valor || '—'}</td>
                  <td className="px-4 py-2 text-sm">{c.descripcion || '—'}</td>
                  <td className="px-4 py-2 text-sm">{c.dispositivo_captura_id || '—'}</td>
                  <td className="px-4 py-2 text-sm"><button className="border rounded px-2 py-1" onClick={() => { setEditing(c); setForm({ clave: c.clave, valor: c.valor || '', descripcion: c.descripcion || '', dispositivo_captura_id: c.dispositivo_captura_id ? String(c.dispositivo_captura_id) : '' }); }}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionesSistema;
