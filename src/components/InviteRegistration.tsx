import { useState } from 'react';
import { Building2, CheckCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { clearSession, isValidPassword, PASSWORD_REQUIREMENTS } from '../lib/auth';

export function InviteRegistration() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [form, setForm] = useState({ hotel: '', name: '', phone: '', username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    if (!token) { setError('Este enlace no es válido.'); setLoading(false); return; }
    if (!/^\d{9}$/.test(form.phone)) {
      setError('Ingresa un número celular de 9 dígitos.');
      setLoading(false);
      return;
    }
    if (!isValidPassword(form.password)) {
      setError(PASSWORD_REQUIREMENTS);
      setLoading(false);
      return;
    }
    const result = await supabase.rpc('register_from_invite', { p_token: token, p_hotel_name: form.hotel, p_display_name: form.name, p_phone: form.phone, p_username: form.username, p_password: form.password });
    setLoading(false);
    if (result.error) {
      const message = result.error.message;
      if (message.includes('invitacion_invalida')) setError('El enlace ya fue utilizado o venció.');
      else if (message.includes('hotel_invalido')) setError('El nombre del hotel debe tener al menos 3 caracteres.');
      else if (message.includes('nombre_invalido')) setError('El nombre del administrador debe tener al menos 3 caracteres.');
      else if (message.includes('telefono_invalido')) setError('Ingresa un número celular de 9 dígitos.');
      else if (message.includes('usuario_invalido')) setError('El usuario debe tener al menos 3 caracteres.');
      else if (message.includes('usuario_clave_duplicados')) setError('Esa combinación de usuario y contraseña ya está en uso. Elige otra contraseña.');
      else if (message.includes('password_invalida')) setError(PASSWORD_REQUIREMENTS);
      else setError('No se pudo completar el registro. Inténtalo nuevamente.');
      return;
    }
    clearSession();
    setDone(true);
  };
  const input = 'w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-500';
  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-white flex items-center justify-center">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl">
      {done ? <div className="text-center"><CheckCircle className="mx-auto h-14 w-14 text-emerald-400" /><h1 className="mt-4 text-2xl font-black">Registro completado</h1><p className="mt-2 text-slate-400">Tu hotel tiene 14 días de prueba.</p><a href="/" className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-bold">Ir a iniciar sesión</a></div> : <>
        <Building2 className="h-10 w-10 text-cyan-400" /><h1 className="mt-4 text-2xl font-black">Registra tu hotel</h1><p className="mt-2 text-sm text-slate-400">Esta invitación funciona una sola vez.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input required className={input} placeholder="Nombre del hotel" value={form.hotel} onChange={e => setForm({...form, hotel:e.target.value})}/>
          <input required className={input} placeholder="Nombre del administrador" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
          <input required type="tel" inputMode="numeric" pattern="[0-9]{9}" maxLength={9} className={input} placeholder="Celular (9 dígitos)" value={form.phone} onChange={e => setForm({...form, phone:e.target.value.replace(/\D/g, '').slice(0, 9)})}/>
          <input required className={input} placeholder="Usuario" value={form.username} onChange={e => setForm({...form, username:e.target.value})}/>
          <div className="relative">
            <input required minLength={5} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{5,}" title="Mínimo 5 caracteres, una mayúscula, una minúscula y un número. Se permiten signos." type={showPassword ? 'text' : 'password'} className={`${input} pr-12`} placeholder="Contraseña" value={form.password} onChange={e => setForm({...form, password:e.target.value})}/>
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition-colors hover:text-white"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-xs text-slate-500">Mínimo 5 caracteres, con mayúscula, minúscula y número. Se permiten signos.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 py-3.5 font-bold disabled:opacity-60">{loading && <RefreshCw className="h-4 w-4 animate-spin"/>}Crear cuenta</button>
        </form></>}
    </div>
  </main>;
}
