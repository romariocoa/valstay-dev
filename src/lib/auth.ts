import { supabase, getClient, setSession } from './supabase';

export type UserRole = 'superuser' | 'admin' | 'receptionist' | 'demo';

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  tenantId: string | null;
  sessionToken: string;
  mustChangePassword?: boolean;
}

export interface AppUserRecord {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  tenantId: string | null;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: 'trial' | 'active' | 'suspended' | 'expired';
  trialEndsAt: string;
  planName: string;
  suspensionReason: string | null;
}

export interface TenantMessage {
  id: string; tenantId: string; title: string; body: string;
  messageType: 'info' | 'warning' | 'payment' | 'suspension';
  createdAt: string; expiresAt: string | null; readAt: string | null;
}

const SESSION_KEY = 'hotel_session';
let lastLoginError: 'credentials' | 'blocked' = 'credentials';
export function getLastLoginError() { return lastLoginError; }

export async function login(username: string, password: string): Promise<AppUser | null> {
  const { data, error } = await supabase.rpc('login_user', {
    p_username: username.toLowerCase().trim(),
    p_password: password,
  });

  if (error || !data || data.length === 0) {
    lastLoginError = error?.message?.includes('tenant_bloqueado') ? 'blocked' : 'credentials';
    return null;
  }

  const row = data[0];
  const session: AppUser = {
    id: row.user_id,
    username: row.username,
    role: row.role as UserRole,
    displayName: row.display_name,
    tenantId: row.tenant_id ?? null,
    sessionToken: row.session_token,
  };

  const passwordStatus = await supabase.rpc('needs_password_change', { p_session_token: row.session_token });
  session.mustChangePassword = passwordStatus.data === true;

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  setSession(row.session_token);
  return session;
}

export async function changeInitialPassword(sessionToken: string, password: string): Promise<string | null> {
  const { error } = await supabase.rpc('change_initial_password', { p_session_token: sessionToken, p_new_password: password });
  if (error) return error.message;
  const session = getSession();
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, mustChangePassword: false }));
  return null;
}

export async function logout(): Promise<void> {
  const session = getSession();
  if (session?.sessionToken) {
    await supabase.rpc('logout_user', { p_session_token: session.sessionToken });
  }
  setSession(null);
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AppUser;
    // Old sessions (pre-RLS) have no sessionToken — force re-login.
    if (!session?.sessionToken) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    setSession(session.sessionToken);
    return session;
  } catch {
    return null;
  }
}

export async function createRegistrationInvite(): Promise<{ url?: string; error?: string }> {
  const session = getSession();
  if (!session?.sessionToken) return { error: 'Sesión inválida.' };
  const { data, error } = await supabase.rpc('create_registration_invite', { p_session_token: session.sessionToken });
  if (error || !data) return { error: error?.message || 'No se pudo crear la invitación.' };
  return { url: `${window.location.origin}/registro?token=${data}` };
}

export function clearSession(): void {
  setSession(null);
  localStorage.removeItem(SESSION_KEY);
}

// Validates the stored session token against the DB.
// Returns the refreshed AppUser if valid.
// Returns null ONLY when the DB explicitly confirms the session is expired/invalid.
// On network or RPC errors, always keeps the existing session (never force-logout).
export async function validateSession(): Promise<AppUser | null> {
  const session = getSession();
  if (!session) return null;

  try {
    const { data, error } = await supabase.rpc('verify_session', {
      p_session_token: session.sessionToken,
    });

    if (error) {
      // RPC call failed (network issue, permission error, etc.).
      // Do NOT clear the session — keep the user logged in.
      return session;
    }

    if (!data || data.length === 0) {
      // RPC succeeded but returned no rows → session definitively expired.
      clearSession();
      return null;
    }

    const row = data[0];
    const refreshed: AppUser = {
      id: row.user_id,
      username: row.username,
      role: row.role as UserRole,
      displayName: row.display_name,
      tenantId: row.tenant_id ?? null,
      sessionToken: session.sessionToken,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
    setSession(refreshed.sessionToken);
    return refreshed;
  } catch {
    // JS exception (network totally unavailable) — keep existing session.
    return session;
  }
}

// ── Tenant management (superuser only) ──────────────────────────────────────

export async function getTenants(): Promise<Tenant[]> {
  const { data } = await getClient()
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: true });
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: r.created_at,
    status: r.status,
    trialEndsAt: r.trial_ends_at,
    planName: r.plan_name,
    suspensionReason: r.suspension_reason,
  }));
}

export async function createTenant(
  name: string,
  adminUsername: string,
  adminPassword: string,
  adminDisplayName: string,
): Promise<{ tenant?: Tenant; error?: string }> {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: existing } = await getClient()
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const { data: tenantData, error: tenantError } = await getClient()
    .from('tenants')
    .insert({ name: name.trim(), slug: finalSlug })
    .select()
    .single();

  if (tenantError || !tenantData) {
    return { error: tenantError?.message ?? 'Error al crear el tenant' };
  }

  const { error: userError } = await getClient().from('app_users').insert({
    username: adminUsername.toLowerCase().trim(),
    password: adminPassword,
    role: 'admin',
    display_name: adminDisplayName.trim(),
    tenant_id: tenantData.id,
  });

  if (userError) {
    await getClient().from('tenants').delete().eq('id', tenantData.id);
    if (userError.code === '23505') return { error: 'Ese nombre de usuario ya existe.' };
    return { error: userError.message };
  }

  await getClient().from('hotel_config').insert({
    name: name.trim(),
    tenant_id: tenantData.id,
  });

  return {
    tenant: {
      id: tenantData.id,
      name: tenantData.name,
      slug: tenantData.slug,
      createdAt: tenantData.created_at,
      status: tenantData.status,
      trialEndsAt: tenantData.trial_ends_at,
      planName: tenantData.plan_name,
      suspensionReason: tenantData.suspension_reason,
    },
  };
}

export async function manageTenantAccess(tenant: Tenant): Promise<{ error?: string }> {
  const session = getSession();
  if (!session) return { error: 'Sesion invalida' };
  const { error } = await getClient().rpc('manage_tenant_access', {
    p_session_token: session.sessionToken, p_tenant_id: tenant.id,
    p_status: tenant.status, p_trial_ends_at: tenant.trialEndsAt,
    p_plan_name: tenant.planName, p_reason: tenant.suspensionReason,
  });
  return error ? { error: error.message } : {};
}

export async function revokeTenantSessions(tenantId: string): Promise<{ error?: string }> {
  const session = getSession();
  if (!session) return { error: 'Sesion invalida' };
  const { error } = await getClient().rpc('revoke_tenant_sessions', {
    p_session_token: session.sessionToken, p_tenant_id: tenantId,
  });
  return error ? { error: error.message } : {};
}

export async function sendTenantMessage(tenantId: string, title: string, body: string, messageType: TenantMessage['messageType']): Promise<{ error?: string }> {
  const { error } = await getClient().from('tenant_messages').insert({
    tenant_id: tenantId, title: title.trim(), body: body.trim(), message_type: messageType,
  });
  return error ? { error: error.message } : {};
}

export async function getTenantMessages(tenantId: string): Promise<TenantMessage[]> {
  const { data } = await getClient().from('tenant_messages').select('*')
    .eq('tenant_id', tenantId).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });
  return (data ?? []).map(r => ({ id: r.id, tenantId: r.tenant_id, title: r.title,
    body: r.body, messageType: r.message_type, createdAt: r.created_at,
    expiresAt: r.expires_at, readAt: r.read_at }));
}

export async function deleteTenant(id: string): Promise<{ error?: string }> {
  const { error } = await getClient().from('tenants').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ── User management ──────────────────────────────────────────────────────────

export async function getUsers(tenantId: string): Promise<AppUserRecord[]> {
  const { data } = await getClient()
    .from('app_users')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(r => ({
    id: r.id,
    username: r.username,
    role: r.role as UserRole,
    displayName: r.display_name,
    tenantId: r.tenant_id,
    createdAt: r.created_at,
  }));
}

export async function createUser(
  username: string,
  password: string,
  role: Exclude<UserRole, 'superuser'>,
  displayName: string,
  tenantId: string,
): Promise<{ error?: string }> {
  const { error } = await getClient().from('app_users').insert({
    username: username.toLowerCase().trim(),
    password,
    role,
    display_name: displayName.trim(),
    tenant_id: tenantId,
  });
  if (error) {
    if (error.code === '23505') return { error: 'Ese nombre de usuario ya existe.' };
    return { error: error.message };
  }
  return {};
}

export async function updateUser(
  id: string,
  fields: { password?: string; role?: Exclude<UserRole, 'superuser'>; displayName?: string },
): Promise<{ error?: string }> {
  const updates: Record<string, string> = {};
  if (fields.password) updates.password = fields.password;
  if (fields.role) updates.role = fields.role;
  if (fields.displayName) updates.display_name = fields.displayName;

  if (Object.keys(updates).length === 0) return {};

  const { error } = await getClient().from('app_users').update(updates).eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteUser(id: string): Promise<{ error?: string }> {
  const { error } = await getClient().from('app_users').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ── Permission helpers ───────────────────────────────────────────────────────

export function isSuperuser(user: AppUser): boolean {
  return user.role === 'superuser';
}

export function isAdmin(user: AppUser): boolean {
  return user.role === 'admin' || user.role === 'superuser';
}

export function canManageRooms(user: AppUser): boolean {
  return user.role === 'admin';
}

export function canEditFloorPlan(user: AppUser): boolean {
  return user.role === 'admin';
}

export function canEditGuests(user: AppUser): boolean {
  return user.role === 'admin';
}

export function canChangeRoom(user: AppUser): boolean {
  return user.role === 'admin' || user.role === 'receptionist';
}

export function canDeleteHistory(user: AppUser): boolean {
  return user.role === 'admin';
}

export function canManageUsers(user: AppUser): boolean {
  return user.role === 'admin';
}

export function canViewStays(user: AppUser): boolean {
  return user.role === 'admin' || user.role === 'receptionist' || user.role === 'demo';
}

export function canAccessSection(user: AppUser, section: string): boolean {
  if (user.role === 'admin' || user.role === 'demo') return true;
  return section === 'dashboard' || section === 'stays';
}

export function canExportValorizacion(user: AppUser): boolean {
  return user.role === 'admin';
}
