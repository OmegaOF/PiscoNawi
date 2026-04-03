import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_ADMIN, ROLE_ANALISTA, ROLE_DEV, hasAnyRole } from '../../lib/rbac';

interface UsuarioItem {
  id: number;
  nombre: string;
  username: string;
  creado_en: string | null;
}

const emptyForm = { nombre: '', username: '', password: '' };

const UsuariosAdmin: React.FC = () => {
  const { roles } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<UsuarioItem | null>(null);

  const canCreate = hasAnyRole(roles, [ROLE_ADMIN]);
  const canEdit = hasAnyRole(roles, [ROLE_ADMIN, ROLE_DEV]);
  const canDeactivate = hasAnyRole(roles, [ROLE_ADMIN]);
  const canRead = hasAnyRole(roles, [ROLE_ADMIN, ROLE_DEV, ROLE_ANALISTA]);

  const loadUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<UsuarioItem[]>('/usuarios');
      setUsuarios(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) loadUsuarios();
  }, [canRead]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/usuarios', form);
      setForm(emptyForm);
      await loadUsuarios();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo crear usuario');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const payload: any = { nombre: form.nombre, username: form.username };
    if (form.password) payload.password = form.password;
    try {
      await api.put(`/usuarios/id/${editing.id}`, payload);
      setEditing(null);
      setForm(emptyForm);
      await loadUsuarios();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo actualizar usuario');
    }
  };

  const handleDesactivar = async (id: number) => {
    if (!window.confirm('¿Desactivar este usuario?')) return;
    try {
      await api.post(`/usuarios/id/${id}/desactivar`);
      await loadUsuarios();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo desactivar usuario');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Administración de Usuarios</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

        {(canCreate || (canEdit && editing)) && (
          <form onSubmit={editing ? handleUpdate : handleCreate} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid md:grid-cols-4 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            <input className="border rounded px-3 py-2" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <input className="border rounded px-3 py-2" placeholder={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
            <div className="flex gap-2">
              <button className="bg-vino text-white rounded px-4 py-2" type="submit">{editing ? 'Guardar cambios' : 'Crear usuario'}</button>
              {editing && <button className="border rounded px-4 py-2" type="button" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancelar</button>}
            </div>
          </form>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          {loading ? <p className="p-4 text-gray-500">Cargando usuarios...</p> : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Username</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Creado</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-sm">{u.id}</td>
                    <td className="px-4 py-3 text-sm">{u.nombre}</td>
                    <td className="px-4 py-3 text-sm">{u.username}</td>
                    <td className="px-4 py-3 text-sm">{u.creado_en || '—'}</td>
                    <td className="px-4 py-3 text-sm flex gap-2">
                      {canEdit && <button className="px-3 py-1 rounded border" onClick={() => { setEditing(u); setForm({ nombre: u.nombre, username: u.username, password: '' }); }}>Editar</button>}
                      {canDeactivate && <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => handleDesactivar(u.id)}>Desactivar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsuariosAdmin;
