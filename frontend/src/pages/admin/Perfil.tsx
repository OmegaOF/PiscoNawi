import React, { useEffect, useState } from 'react';
import api from '../../lib/api';

interface PerfilItem {
  id: number;
  nombre: string;
  username: string;
  creado_en?: string | null;
}

const Perfil: React.FC = () => {
  const [perfil, setPerfil] = useState<PerfilItem | null>(null);
  const [form, setForm] = useState({ nombre: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<PerfilItem>('/usuarios/me/perfil');
      setPerfil(res.data);
      setForm((f) => ({ ...f, nombre: res.data.nombre }));
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar perfil');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api.put('/usuarios/me/perfil', {
        nombre: form.nombre,
        ...(form.password ? { password: form.password } : {}),
      });
      setOk('Perfil actualizado correctamente');
      setForm((f) => ({ ...f, password: '' }));
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo actualizar perfil');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Mi Perfil</h1>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
        {ok && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">{ok}</div>}

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <p><strong>ID:</strong> {perfil?.id || '—'}</p>
          <p><strong>Usuario:</strong> {perfil?.username || '—'}</p>
          <p><strong>Creado:</strong> {perfil?.creado_en || '—'}</p>
        </div>

        <form onSubmit={save} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <input className="border rounded px-3 py-2 w-full" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          <input className="border rounded px-3 py-2 w-full" placeholder="Nueva contraseña (opcional)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button className="bg-vino text-white rounded px-4 py-2">Guardar cambios</button>
        </form>
      </div>
    </div>
  );
};

export default Perfil;
