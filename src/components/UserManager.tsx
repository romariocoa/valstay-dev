import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Trash2, RefreshCw, ShieldCheck, UserCircle,
  Eye, EyeOff, Save, X, Users, KeyRound,
} from 'lucide-react';
import {
  AppUser, AppUserRecord, ManagedUserRole, UserRole,
  getUsers, createUser, updateUser, deleteUser,
  isValidPassword, PASSWORD_REQUIREMENTS,
} from '../lib/auth';

interface Props {
  currentUser: AppUser;
  tenantId: string;
  readOnly?: boolean;
}

interface EditState {
  id: string;
  displayName: string;
  role: ManagedUserRole;
  password: string;
}

const ROLE_LABEL: Record<UserRole, string> = {
  superuser: 'Super Administrador',
  admin: 'Administrador',
  receptionist: 'Recepcionista',
  demo: 'Demostración',
};

export function UserManager({ currentUser, tenantId, readOnly = false }: Props) {
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [showPass, setShowPass] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<ManagedUserRole>('receptionist');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [createErr, setCreateErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [globalErr, setGlobalErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await getUsers(tenantId));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr('');
    if (!newUsername.trim() || !newPassword || !newDisplayName.trim()) {
      setCreateErr('Todos los campos son obligatorios.');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setCreateErr(PASSWORD_REQUIREMENTS);
      return;
    }
    setCreating(true);
    const { error } = await createUser(newUsername, newPassword, newRole, newDisplayName, tenantId);
    setCreating(false);
    if (error) { setCreateErr(error); return; }
    setNewUsername(''); setNewPassword(''); setNewDisplayName(''); setNewRole('receptionist');
    setShowCreate(false);
    load();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (editing.password && !isValidPassword(editing.password)) {
      setGlobalErr(PASSWORD_REQUIREMENTS);
      return;
    }
    setSaving(true);
    setGlobalErr('');
    const { error } = await updateUser(editing.id, {
      role: editing.role,
      displayName: editing.displayName,
      password: editing.password || undefined,
    });
    setSaving(false);
    if (error) { setGlobalErr(error); return; }
    setEditing(null);
    load();
  };

  const handleDelete = async (user: AppUserRecord) => {
    if (user.id === currentUser.id) {
      setGlobalErr('No puedes eliminar tu propio usuario.');
      return;
    }
    if (!confirm(`Eliminar al usuario "${user.username}"? Esta accion no se puede deshacer.`)) return;
    setGlobalErr('');
    const { error } = await deleteUser(user.id);
    if (error) { setGlobalErr(error); return; }
    load();
  };

  const inputBase = 'w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500';
  const labelBase = 'block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-zinc-100">Usuarios del sistema</h3>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 rounded-full text-xs font-semibold">
            {users.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && <button
            onClick={load}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-gray-500 dark:text-zinc-400"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>}
          <button
            onClick={() => { setShowCreate(true); setCreateErr(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-zinc-700 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-600 text-sm font-semibold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo usuario
          </button>
        </div>
      </div>

      {globalErr && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {globalErr}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-800 dark:text-zinc-100">Crear nuevo usuario</h4>
            <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
              <X className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Nombre completo</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  placeholder="Ej: Juan Garcia"
                  className={inputBase}
                />
              </div>
              <div>
                <label className={labelBase}>Usuario</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="Ej: juan.garcia"
                  className={inputBase}
                />
              </div>
              <div>
                <label className={labelBase}>Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Contraseña segura"
                    className={`${inputBase} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelBase}>Rol</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as ManagedUserRole)}
                  className={inputBase}
                >
                  <option value="receptionist">Recepcionista</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            {createErr && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-200 dark:border-red-800">
                {createErr}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                Cancelar
              </button>
              <button type="submit" disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-zinc-700 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 dark:hover:bg-zinc-600 disabled:opacity-60">
                {creating
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />}
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 dark:text-zinc-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => {
            const isMe = user.id === currentUser.id;
            const isEditing = editing?.id === user.id;

            return (
              <div key={user.id}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`p-2 rounded-xl shrink-0 ${user.role === 'admin' ? 'bg-gray-100 dark:bg-zinc-800' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    {user.role === 'admin'
                      ? <ShieldCheck className="w-5 h-5 text-gray-700 dark:text-zinc-300" />
                      : <UserCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 dark:text-zinc-100">{user.displayName}</span>
                      {isMe && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                          Tu cuenta
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        user.role === 'admin'
                          ? 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {ROLE_LABEL[user.role]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5 font-mono">@{user.username}</p>
                  </div>
                  {!readOnly && <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditing(isEditing ? null : {
                        id: user.id,
                        displayName: user.displayName,
                        role: user.role as ManagedUserRole,
                        password: '',
                      })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                        isEditing
                          ? 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      {isEditing ? 'Cerrar' : 'Editar'}
                    </button>
                    {!isMe && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 text-gray-400 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>}
                </div>

                {isEditing && editing && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 space-y-4">
                    <p className="text-xs text-gray-400 dark:text-zinc-500 pt-4 font-medium uppercase tracking-wide">Editar usuario</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Nombre completo</label>
                        <input
                          type="text"
                          value={editing.displayName}
                          onChange={e => setEditing(prev => prev ? { ...prev, displayName: e.target.value } : null)}
                          className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">
                          Nueva contraseña <span className="text-gray-400 dark:text-zinc-500">(dejar vacío para no cambiar)</span>
                        </label>
                        <input
                          type="password"
                          value={editing.password}
                          onChange={e => setEditing(prev => prev ? { ...prev, password: e.target.value } : null)}
                          placeholder="Nueva contraseña"
                          className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Rol</label>
                        <select
                          value={editing.role}
                          onChange={e => setEditing(prev => prev ? { ...prev, role: e.target.value as ManagedUserRole } : null)}
                          disabled={isMe}
                          className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 disabled:opacity-50"
                        >
                          <option value="receptionist">Recepcionista</option>
                          <option value="admin">Administrador</option>
                        </select>
                        {isMe && (
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">No puedes cambiar tu propio rol.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setEditing(null)}
                        className="px-4 py-2 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800">
                        Cancelar
                      </button>
                      <button onClick={handleSaveEdit} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-zinc-700 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 dark:hover:bg-zinc-600 disabled:opacity-60">
                        {saving
                          ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Save className="w-3.5 h-3.5" />}
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
