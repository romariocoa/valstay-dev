import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getTenantMessages, TenantMessage } from '../lib/auth';
import { getSession } from '../lib/auth';
import { getClient } from '../lib/supabase';

export function TenantMessages({ tenantId }: { tenantId: string }) {
  const [messages, setMessages] = useState<TenantMessage[]>([]);
  const [puchiBlinking, setPuchiBlinking] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialVisible, setTrialVisible] = useState(false);
  useEffect(() => { getTenantMessages(tenantId).then(setMessages); }, [tenantId]);
  useEffect(() => {
    const loadTrial = () => {
      const session = getSession();
      if (!session) return;
      getClient().rpc('get_tenant_access_info', { p_session_token: session.sessionToken }).then(({ data }) => {
        const info = data?.[0];
        if (!info || info.status !== 'trial') { setTrialVisible(false); return; }
        const today = new Date().toLocaleDateString('en-CA');
        const dismissedKey = `trial_notice_dismissed:${session.sessionToken}:${today}`;
        setTrialEndsAt(info.trial_ends_at);
        setTrialVisible(localStorage.getItem(dismissedKey) !== '1');
      });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') loadTrial(); };
    loadTrial();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadTrial);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadTrial);
    };
  }, [tenantId]);
  useEffect(() => {
    let blinkTimeout: number | undefined;
    const blinkInterval = window.setInterval(() => {
      setPuchiBlinking(true);
      blinkTimeout = window.setTimeout(() => setPuchiBlinking(false), 180);
    }, 3000);
    return () => {
      window.clearInterval(blinkInterval);
      if (blinkTimeout) window.clearTimeout(blinkTimeout);
    };
  }, []);
  if (!messages.length && !trialVisible) return null;
  const closeTrial = () => {
    const session = getSession();
    if (session) {
      const today = new Date().toLocaleDateString('en-CA');
      localStorage.setItem(`trial_notice_dismissed:${session.sessionToken}:${today}`, '1');
    }
    setTrialVisible(false);
  };
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;
  const close = async (message: TenantMessage) => {
    const session = getSession();
    if (!session) return;
    await getClient().rpc('mark_tenant_message_read', { p_session_token: session.sessionToken, p_message_id: message.id });
    setMessages(current => current.filter(item => item.id !== message.id));
  };
  const colors = {
    info: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-200',
    warning: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/35 dark:text-orange-200',
    payment: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200',
    suspension: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-200',
  };
  return <div className="mb-6 space-y-2">
    {trialVisible && <div className="relative rounded-xl border border-cyan-300 bg-cyan-50 px-5 py-4 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/35 dark:text-cyan-100">
      <button onClick={closeTrial} title="Cerrar aviso" className="absolute right-3 top-3 rounded-lg p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      <p className="pr-8 font-bold">Periodo de prueba gratuito</p>
      <p className="mt-1 text-sm opacity-85">Tu hotel está usando el periodo de prueba. Te quedan {trialDaysLeft} día{trialDaysLeft === 1 ? '' : 's'}.</p>
      {trialEndsAt && <p className="mt-1 text-xs opacity-70">Vence el {new Date(trialEndsAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}
    </div>}
    {messages.filter(message => !message.readAt).map(message => {
      return <div key={message.id} className={`relative flex flex-col items-center rounded-2xl border px-5 pb-5 pt-3 text-center ${colors[message.messageType]}`}>
        <button onClick={() => close(message)} title="Marcar como leído" className="absolute right-3 top-3 rounded-lg p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        <img src={puchiBlinking ? '/puchi-cerrado.png' : '/puchi-abierto.png'} alt="Puchi" className="h-20 w-20 object-contain" />
        <div className="-mt-3"><p className="font-bold">{message.title}</p><p className="mt-1 whitespace-pre-wrap text-sm opacity-85">{message.body}</p></div>
      </div>;
    })}
  </div>;
}
