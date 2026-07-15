import { useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { AppUser, changeInitialPassword, isValidPassword, PASSWORD_REQUIREMENTS } from '../lib/auth';

export function ChangeInitialPassword({ user, onDone }: { user: AppUser; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!isValidPassword(password)) return setError(PASSWORD_REQUIREMENTS);
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setLoading(true); const result = await changeInitialPassword(user.sessionToken, password); setLoading(false);
    if (result) return setError('No se pudo cambiar la contraseña.');
    onDone();
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7">
    <KeyRound className="h-10 w-10 text-cyan-400"/><h1 className="mt-4 text-2xl font-black">Cambia tu contraseña</h1><p className="mt-2 text-sm text-slate-400">Por seguridad debes crear una nueva contraseña antes de continuar.</p>
    <form onSubmit={submit} className="mt-6 space-y-3"><input autoFocus required minLength={5} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{5,}" title={PASSWORD_REQUIREMENTS} type="password" placeholder="Nueva contraseña" value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-500"/><p className="text-xs text-slate-500">{PASSWORD_REQUIREMENTS}</p><input required type="password" placeholder="Repite la contraseña" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-500"/>{error&&<p className="text-sm text-red-400">{error}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-bold disabled:opacity-60">{loading&&<RefreshCw className="h-4 w-4 animate-spin"/>}Guardar contraseña</button></form>
  </div></main>;
}
