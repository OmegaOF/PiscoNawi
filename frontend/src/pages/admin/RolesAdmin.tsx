import React, { useEffect, useState } from 'react';
import api from '../../lib/api';

interface RoleItem { id: number; nombre: string; descripcion?: string | null; }
interface UserRoleAssignmentItem { id: number; usuario_id: number; rol_id: number; }
interface UsuarioItem { id: number; nombre: string; username: string; }

const RolesAdmin: React.FC = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [asignaciones, setAsignaciones] = useState<UserRoleAssignmentItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [usuarioId, setUsuarioId] = useState<number | ''>('');
  const [rolId, setRolId] = useState<number | ''>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setError(null);
    try {
      const [r, a, u] = await Promise.all([
        api.get<RoleItem[]>('/roles'),
        api.get<UserRoleAssignmentItem[]>('/roles/asignaciones'),
        api.get<UsuarioItem[]>('/usuarios'),
      ]);
      setRoles(r.data);
      setAsignaciones(a.data);
      setUsuarios(u.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar roles/asignaciones');
    }
  };

  useEffect(() => { loadAll(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioId || !rolId) return;
    try {
      if (editingId) {
        await api.put(`/roles/asignaciones/${editingId}`, { rol_id: rolId });
      } else {
        await api.post('/roles/asignaciones', { usuario_id: usuarioId, rol_id: rolId });
      }
      setUsuarioId('');
      setRolId('');
      setEditingId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo guardar asignación');
    }
  };

  const deleteAssignment = async (id: number) => {
    if (!window.confirm('¿Eliminar asignación?')) return;
    try {
      await api.delete(`/roles/asignaciones/${id}`);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo eliminar asignación');
    }
  };

  const usuarioLabel = (id: number) => usuarios.find((u) => u.id === id)?.username || `Usuario ${id}`;
  const rolLabel = (id: number) => roles.find((r) => r.id === id)?.nombre || `Rol ${id}`;

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-vino mb-6">Roles y Asignaciones</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-vino mb-3">Asignar rol a usuario</h2>
          <form onSubmit={submit} className="grid md:grid-cols-4 gap-3">
            <select className="border rounded px-3 py-2" value={usuarioId} onChange={(e) => setUsuarioId(Number(e.target.value) || '')} required>
              <option value="">Seleccione usuario</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>)}
            </select>
            <select className="border rounded px-3 py-2" value={rolId} onChange={(e) => setRolId(Number(e.target.value) || '')} required>
              <option value="">Seleccione rol</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
            <button className="bg-vino text-white rounded px-4 py-2" type="submit">{editingId ? 'Actualizar' : 'Asignar'}</button>
            {editingId ? <button type="button" className="border rounded px-4 py-2" onClick={() => { setEditingId(null); setUsuarioId(''); setRolId(''); }}>Cancelar</button> : <div />}
          </form>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <h3 className="font-semibold text-vino p-4 border-b">Roles disponibles</h3>
            <table className="min-w-full">
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 text-sm">{r.id}</td>
                    <td className="px-4 py-2 text-sm font-medium">{r.nombre}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{r.descripcion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <h3 className="font-semibold text-vino p-4 border-b">Asignaciones</h3>
            <table className="min-w-full">
              <tbody>
                {asignaciones.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2 text-sm">#{a.id}</td>
                    <td className="px-4 py-2 text-sm">{usuarioLabel(a.usuario_id)}</td>
                    <td className="px-4 py-2 text-sm">{rolLabel(a.rol_id)}</td>
                    <td className="px-4 py-2 text-sm flex gap-2">
                      <button className="border rounded px-2 py-1" onClick={() => { setEditingId(a.id); setUsuarioId(a.usuario_id); setRolId(a.rol_id); }}>Editar</button>
                      <button className="bg-red-600 text-white rounded px-2 py-1" onClick={() => deleteAssignment(a.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesAdmin;
