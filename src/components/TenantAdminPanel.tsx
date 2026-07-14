import { useState } from 'react';
import { Bell, LogOut, Save, Send, RefreshCw } from 'lucide-react';
import { Tenant, manageTenantAccess, revokeTenantSessions, sendTenantMessage } from '../lib/auth';

export function TenantAdminPanel({ tenant, onChanged }: { tenant: Tenant; onChanged: () => void }) {
  const [draft, setDraft] = useState(tenant);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'payment' | 'suspension'>('info');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500';

  const save = async () => {
    setBusy(true); setFeedback('');
    const result = await manageTenantAccess(draft);
    setBusy(false);
    if (result.error) return setFeedback(result.error);
    setFeedback('Configuración actualizada.'); onChanged();
  };

  const revoke = async () => {
    if (!confirm(`¿Cerrar todas las sesiones abiertas de ${tenant.name}?`)) return;
    setBusy(true); const result = await revokeTenantSessions(tenant.id); setBusy(false);
    setFeedback(result.error || 'Todas las sesiones fueron cerradas.');
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) return setFeedback('Completa el título y el mensaje.');
    setBusy(true); const result = await sendTenantMessage(tenant.id, title, body, type); setBusy(false);
    if (result.error) return setFeedback(result.error);
    setTitle(''); setBody(''); setFeedback('Mensaje enviado al hotel.');
  };

  return <div className="border-t border-zinc-800 p-5 space-y-5">
    <div className="grid gap-3 md:grid-cols-4">
      <div><label className="text-xs text-zinc-500">Estado</label><select className={input} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Tenant['status'] })}>
        <option value="trial">Prueba</option><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="expired">Vencido</option>
      </select></div>
      <div><label className="text-xs text-zinc-500">Fin de prueba</label><input className={input} type="date" value={draft.trialEndsAt?.slice(0, 10)} onChange={e => setDraft({ ...draft, trialEndsAt: `${e.target.value}T23:59:59-05:00` })} /></div>
      <div><label className="text-xs text-zinc-500">Plan</label><input className={input} value={draft.planName} onChange={e => setDraft({ ...draft, planName: e.target.value })} /></div>
      <div><label className="text-xs text-zinc-500">Motivo</label><input className={input} placeholder="Opcional" value={draft.suspensionReason || ''} onChange={e => setDraft({ ...draft, suspensionReason: e.target.value })} /></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={save} className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900"><Save className="w-3.5 h-3.5" />Guardar acceso</button>
      <button disabled={busy} onClick={revoke} className="flex items-center gap-2 rounded-lg border border-red-900 px-3 py-2 text-xs font-semibold text-red-400"><LogOut className="w-3.5 h-3.5" />Cerrar todas las sesiones</button>
      {busy && <RefreshCw className="w-4 h-4 animate-spin text-zinc-500 self-center" />}
    </div>

    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300"><Bell className="w-4 h-4" />Enviar mensaje a este hotel</div>
      <div className="grid gap-3 md:grid-cols-[150px_1fr]">
        <select className={input} value={type} onChange={e => setType(e.target.value as typeof type)}><option value="info">Información</option><option value="warning">Advertencia</option><option value="payment">Pago</option><option value="suspension">Suspensión</option></select>
        <input className={input} placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <textarea className={`${input} mt-3 min-h-20`} placeholder="Escribe el mensaje..." value={body} onChange={e => setBody(e.target.value)} />
      <button disabled={busy} onClick={send} className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Send className="w-3.5 h-3.5" />Enviar mensaje</button>
    </div>
    {feedback && <p className="text-xs text-amber-400">{feedback}</p>}
  </div>;
}
