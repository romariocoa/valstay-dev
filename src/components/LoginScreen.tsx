import { useEffect, useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { login, AppUser, getLastLoginError } from '../lib/auth';

const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP || '51950336798';

interface LoginScreenProps {
  onLogin: (user: AppUser) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [puchiBlinking, setPuchiBlinking] = useState(false);
 const [username, setUsername] = useState(() => {
  return localStorage.getItem('valstay_remembered_username') ?? '';
});
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [loading, setLoading]   = useState(false);
 const [rememberUser, setRememberUser] = useState(() => {

  return Boolean(localStorage.getItem('valstay_remembered_username'));

});
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
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  setError('');
  setAccessBlocked(false);
  setLoading(true);

  const user = await login(username, password);

  setLoading(false);

  if (!user) {
    const blocked = getLastLoginError() === 'blocked';
    setAccessBlocked(blocked);
    setError(blocked
      ? 'El acceso de este hotel está vencido o suspendido. Comunícate con soporte.'
      : 'Usuario o contraseña incorrectos');
    return;
  }

  if (rememberUser) {
    localStorage.setItem(
      'valstay_remembered_username',
      username.toLowerCase().trim()
    );
  } else {
    localStorage.removeItem('valstay_remembered_username');
  }

  onLogin(user);
};

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between py-10 px-4 overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 16% 12%, #082f3a 0%, transparent 30%), radial-gradient(circle at 84% 82%, #062d1d 0%, transparent 28%), linear-gradient(145deg, #050708 0%, #020405 52%, #000101 100%)',
      }}>

      <div className="pointer-events-none absolute -left-24 top-[18%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-[12%] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm">

        {/* Logo — transparent PNG, marca de agua sobre fondo oscuro */}
        <div className="relative -mb-4"
          style={{
            maskImage: 'radial-gradient(ellipse 80% 75% at 50% 48%, black 35%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 75% at 50% 48%, black 35%, transparent 100%)',
            opacity: 1,
          }}>
          <img
            src="/logovalstay.png"
            alt="Valstay"
            className="w-72 h-72 object-contain"
            style={{ filter: 'brightness(0.72) contrast(1.4) saturate(1.25) drop-shadow(0 12px 24px rgba(0, 0, 0, 0.55))' }}
          />
          <img
            src={puchiBlinking ? '/puchi-cerrado.png' : '/puchi-abierto.png'}
            alt="Puchi"
            className="pointer-events-none absolute left-1/2 top-[6.6rem] z-10 w-40 -translate-x-1/2 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]"
          />
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-white/10 bg-black/85 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <h2 className="text-2xl font-bold text-white text-center mb-1">Bienvenido</h2>
            <p className="text-zinc-500 text-sm text-center mb-7">Inicia sesión para continuar</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Usuario</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Nombre de usuario"
                    autoComplete="username"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm bg-zinc-950/90 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-800 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl text-sm bg-zinc-950/90 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-800 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
{/* Recordar usuario */}
<div className="flex items-center justify-between">
  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
    <input
      type="checkbox"
      checked={rememberUser}
      onChange={e => setRememberUser(e.target.checked)}
      className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-green-600"
    />

    Recordar mi usuario
  </label>
</div>
              {/* Error */}
              {error && (
                <div className="bg-red-950/50 border border-red-800/60 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-red-400 text-sm">{error}</span>
                  </div>
                  {accessBlocked && (
                    <a
                      href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hola, necesito ayuda con el acceso vencido o suspendido de mi hotel en ValStay. Mi usuario es: ${username.trim() || 'sin indicar'}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
                    >
                      Contactar a soporte por WhatsApp
                    </a>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-1 rounded-xl font-bold text-base text-white transition-all disabled:opacity-60 hover:brightness-110 hover:shadow-lg hover:shadow-emerald-950/40 active:scale-[0.99]"
                style={{ background: 'linear-gradient(135deg, #0891b2 0%, #059669 100%)', border: '1px solid rgba(255,255,255,.18)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                    Verificando...
                  </span>
                ) : (
                  'Ingresar'
                )}
              </button>

            </form>

            {/* Footer links */}
            <div className="mt-6 pt-5 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/60 animate-pulse" />
                <span className="text-sm text-zinc-500">Sistema en línea</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom copyright */}
      <p className="relative z-10 text-slate-400/70 text-sm">
        © {new Date().getFullYear()} ValStay &nbsp;|&nbsp; By Rch
      </p>
    </div>
  );
}
