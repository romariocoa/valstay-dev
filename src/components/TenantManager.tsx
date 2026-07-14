import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Trash2, RefreshCw, X, User, Lock, Eye, EyeOff,
  CheckCircle, AlertCircle, ShieldCheck, Calendar, ChevronDown, ChevronRight,
  UserPlus, Edit2, Save, Users, Link2, Copy,
} from 'lucide-react';
import {
  getTenants, createTenant, deleteTenant, Tenant,
  getUsers, createUser, updateUser, deleteUser, AppUserRecord,
  createRegistrationInvite,
} from '../lib/auth';
import { TenantAdminPanel } from './TenantAdminPanel';

interface TenantManagerProps {
  onLogout: () => void;
}

interface EditState {
  id: string;
  displayName: string;
  role: 'admin' | 'receptionist';
  password: string;
}

const ROLE_LABEL: Record<'admin' | 'receptionist', string> = {
  admin: 'Administrador',
  receptionist: 'Recepcionista',
};

// ── Users panel for one tenant ────────────────────────────────────────────────
function TenantUsersPanel({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'receptionist'>('receptionist');
  const [newDisplay, setNewDisplay] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await getUsers(tenantId));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!newUsername.trim() || !newPassword || !newDisplay.trim()) {
      setErr('Todos los campos son obligatorios.');
      return;
    }
    setCreating(true);
    const { error } = await createUser(newUsername, newPassword, newRole, newDisplay, tenantId);
    setCreating(false);
    if (error) { setErr(error); return; }
    setNewUsername(''); setNewPassword(''); setNewDisplay(''); setNewRole('receptionist');
    setShowCreate(false);
    load();
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await updateUser(editing.id, {
      role: editing.role,
      displayName: editing.displayName,
      password: editing.password || undefined,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setEditing(null);
    load();
  };

  const handleDelete = async (user: AppUserRecord) => {
    if (!confirm(`Eliminar al usuario "${user.username}" de ${tenantName}?`)) return;
    await deleteUser(user.id);
    load();
  };

  const inputBase = 'w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-all';
  const labelBase = 'block text-xs text-zinc-500 font-medium mb-1';

  return (
    <div className="px-5 pb-5 pt-2 border-t border-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-500" />
          <span className="text-zinc-400 text-sm font-medium">
            {loading ? '...' : `${users.length} usuario${users.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <button
          onClick={() => { setShowCreate(s => !s); setErr(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Nuevo usuario
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-red-400 text-xs">{err}</span>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl space-y-3">
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Crear usuario</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelBase}>Nombre completo</label>
              <input type="text" value={newDisplay} onChange={e => setNewDisplay(e.target.value)} placeholder="Juan Garcia" className={inputBase} />
            </div>
            <div>
              <label className={labelBase}>Usuario</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="juan.garcia" className={inputBase} />
            </div>
            <div>
              <label className={labelBase}>Contrasena</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputBase} pr-8`}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelBase}>Rol</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'receptionist')} className={inputBase}>
                <option value="admin">Administrador</option>
                <option value="receptionist">Recepcionista</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Cancelar</button>
            <button type="submit" disabled={creating} className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-100 text-zinc-900 rounded-lg text-xs font-semibold hover:bg-white disabled:opacity-50 transition-colors">
              {creating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Crear
            </button>
          </div>
        </form>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex justify-center py-4">
          <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-zinc-600 text-xs text-center py-4">Sin usuarios en este tenant</p>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl overflow-hidden">
              {editing?.id === user.id ? (
                /* Edit row */
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelBase}>Nombre completo</label>
                      <input
                        type="text"
                        value={editing.displayName}
                        onChange={e => setEditing(prev => prev ? { ...prev, displayName: e.target.value } : null)}
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>Rol</label>
                      <select
                        value={editing.role}
                        onChange={e => setEditing(prev => prev ? { ...prev, role: e.target.value as 'admin' | 'receptionist' } : null)}
                        className={inputBase}
                      >
                        <option value="admin">Administrador</option>
                        <option value="receptionist">Recepcionista</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelBase}>Nueva contrasena (dejar en blanco para no cambiar)</label>
                      <div className="relative">
                        <input
                          type={showEditPass ? 'text' : 'password'}
                          value={editing.password}
                          onChange={e => setEditing(prev => prev ? { ...prev, password: e.target.value } : null)}
                          placeholder="Nueva contrasena..."
                          className={`${inputBase} pr-8`}
                        />
                        <button type="button" onClick={() => setShowEditPass(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                          {showEditPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-100 text-zinc-900 rounded-lg text-xs font-semibold hover:bg-white disabled:opacity-50 transition-colors">
                      {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                /* View row */
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${user.role === 'admin' ? 'bg-zinc-700' : 'bg-zinc-700/60'}`}>
                      {user.role === 'admin'
                        ? <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
                        : <User className="w-3.5 h-3.5 text-zinc-400" />
                      }
                    </div>
                    <div>
                      <p className="text-zinc-200 text-sm font-medium leading-none">{user.displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-zinc-500 text-xs font-mono">{user.username}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          user.role === 'admin'
                            ? 'bg-zinc-700 text-zinc-300'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {ROLE_LABEL[user.role as 'admin' | 'receptionist']}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditing({ id: user.id, displayName: user.displayName, role: user.role as 'admin' | 'receptionist', password: '' });
                        setErr('');
                        setShowEditPass(false);
                      }}
                      className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function TenantManager({ onLogout }: TenantManagerProps) {
  const [inviteUrl, setInviteUrl] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [tenantName, setTenantName] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminDisplay, setAdminDisplay] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setTenants(await getTenants());
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const resetForm = () => {
    setTenantName(''); setAdminUser(''); setAdminPass(''); setAdminDisplay('');
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !adminUser.trim() || !adminPass.trim() || !adminDisplay.trim()) {
      setFormError('Todos los campos son obligatorios.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const saved = tenantName;
    const { error } = await createTenant(tenantName, adminUser, adminPass, adminDisplay);
    setSubmitting(false);
    if (error) { setFormError(error); return; }
    resetForm();
    setShowForm(false);
    setSuccessMsg(`Tenant "${saved}" creado exitosamente.`);
    setTimeout(() => setSuccessMsg(null), 4000);
    fetchTenants();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar el tenant "${name}" y TODA su informacion (habitaciones, huespedes, estadias)? Esta accion NO se puede deshacer.`)) return;
    setDeletingId(id);
    if (expandedId === id) setExpandedId(null);
    await deleteTenant(id);
    setDeletingId(null);
    fetchTenants();
  };

  const handleInvite = async () => {
    setCreatingInvite(true);
    const result = await createRegistrationInvite();
    setCreatingInvite(false);
    if (result.error) { setSuccessMsg(result.error); return; }
    setInviteUrl(result.url || '');
  };

  const inputBase = 'w-full px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 focus:bg-zinc-800 transition-all';
  const labelBase = 'block text-xs text-zinc-400 font-medium tracking-wide mb-1.5';

  return (
    <div className="min-h-screen bg-zinc-950">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, #a0a0a0 1px, transparent 1px), linear-gradient(to bottom, #a0a0a0 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Super Administrador</h1>
              <p className="text-zinc-500 text-xs">Gestion de Tenants</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors text-sm"
          >
            <X className="w-4 h-4" />
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        {/* Page title + actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Tenants</h2>
            <p className="text-zinc-500 text-sm mt-1">
              Cada tenant es un hotel o negocio independiente con su propia data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleInvite} disabled={creatingInvite} className="flex items-center gap-2 px-4 py-2.5 border border-cyan-800 bg-cyan-950/40 text-cyan-300 rounded-xl hover:bg-cyan-900/40 text-sm font-semibold disabled:opacity-50">
              {creatingInvite ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Crear enlace
            </button>
            <button
              onClick={fetchTenants}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white transition-colors text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo Tenant
            </button>
          </div>
        </div>

        {inviteUrl && <div className="mb-6 rounded-xl border border-cyan-800/70 bg-cyan-950/30 p-4">
          <p className="text-sm font-semibold text-cyan-200">Enlace de registro · válido por 24 horas y un solo uso</p>
          <div className="mt-2 flex gap-2"><input readOnly value={inviteUrl} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"/><button onClick={() => navigator.clipboard.writeText(inviteUrl)} className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white"><Copy className="h-3.5 w-3.5"/>Copiar</button></div>
        </div>}

        {successMsg && (
          <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-800/60 rounded-xl px-4 py-3 mb-6">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 text-sm">{successMsg}</span>
          </div>
        )}

        {/* Tenants list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-zinc-600 animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
            <Building2 className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">No hay tenants creados</p>
            <p className="text-zinc-600 text-sm mt-1">Crea el primer tenant para comenzar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map(tenant => {
              const isExpanded = expandedId === tenant.id;
              return (
                <div
                  key={tenant.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition-colors hover:border-zinc-700"
                >
                  {/* Tenant row */}
                  <div className="flex items-center justify-between p-5">
                    <button
                      className="flex items-center gap-4 flex-1 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : tenant.id)}
                    >
                      <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{tenant.name}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-zinc-600 text-xs font-mono">{tenant.slug}</span>
                          <span className="text-zinc-700">·</span>
                          <div className="flex items-center gap-1 text-zinc-600 text-xs">
                            <Calendar className="w-3 h-3" />
                            {new Date(tenant.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${tenant.status === 'active' ? 'bg-emerald-950/50 border-emerald-900/50 text-emerald-400' : tenant.status === 'trial' ? 'bg-blue-950/50 border-blue-900/50 text-blue-400' : 'bg-red-950/50 border-red-900/50 text-red-400'}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="text-xs font-medium">{{ active: 'Activo', trial: 'Prueba', suspended: 'Suspendido', expired: 'Vencido' }[tenant.status]}</span>
                      </div>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : tenant.id)}
                        className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors"
                        title={isExpanded ? 'Colapsar' : 'Ver usuarios'}
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                        }
                      </button>

                      <button
                        onClick={() => handleDelete(tenant.id, tenant.name)}
                        disabled={deletingId === tenant.id}
                        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors disabled:opacity-40"
                        title="Eliminar tenant"
                      >
                        {deletingId === tenant.id
                          ? <RefreshCw className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Expandable users panel */}
                  {isExpanded && (
                    <><TenantAdminPanel tenant={tenant} onChanged={fetchTenants} /><TenantUsersPanel tenantId={tenant.id} tenantName={tenant.name} /></>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create tenant modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-zinc-300" />
                </div>
                <h3 className="text-white font-bold">Nuevo Tenant</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-3">Informacion del negocio</p>
                <div>
                  <label className={labelBase}>Nombre del hotel / negocio *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                    <input
                      type="text"
                      value={tenantName}
                      onChange={e => setTenantName(e.target.value)}
                      placeholder="Ej: Hotel Las Palmeras"
                      className={`${inputBase} pl-10`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-3">Administrador inicial</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelBase}>Nombre completo *</label>
                    <input
                      type="text"
                      value={adminDisplay}
                      onChange={e => setAdminDisplay(e.target.value)}
                      placeholder="Ej: Juan Garcia"
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <label className={labelBase}>Usuario *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                      <input
                        type="text"
                        value={adminUser}
                        onChange={e => setAdminUser(e.target.value)}
                        placeholder="nombre de usuario"
                        className={`${inputBase} pl-10`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelBase}>Contrasena *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={adminPass}
                        onChange={e => setAdminPass(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputBase} pl-10 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2.5 bg-red-950/60 border border-red-800/60 rounded-xl px-3.5 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-red-400 text-sm">{formError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-zinc-700 text-zinc-400 rounded-xl hover:bg-zinc-800 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white transition-colors text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creando...</>
                    : <><Plus className="w-4 h-4" /> Crear Tenant</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
