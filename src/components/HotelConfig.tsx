import { useCallback, useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { getClient, HotelConfig as HotelConfigType } from '../lib/supabase';
import { Hotel, Save, Upload, X, CheckCircle, FileText, Camera, PenLine, QrCode, ChevronDown, ChevronUp, BellRing, Landmark, KeyRound, ShieldCheck, RefreshCw, Copy, ExternalLink, Download, Link2, LockKeyhole } from 'lucide-react';

interface HotelConfigProps {
  config: HotelConfigType;
  sessionToken: string;
  billingEnabled?: boolean;
  onSave: (updates: Partial<HotelConfigType>) => Promise<{ error?: string }>;
  notificationPermission: NotificationPermission;
  pushSubscriptionActive: boolean;
  pushSubscriptionLoading: boolean;
  pushSubscriptionError: string;
  onToggleNotifications: () => Promise<void>;
  onSendTestNotification: () => Promise<void>;
}

type SunatServiceState = { status: string; code: string; message: string };
type SunatConnectionState = { connected: boolean; overallStatus?: 'connected' | 'partial' | 'disconnected' | 'unknown'; code: string; message: string; environment?: string; certificate?: { expiresAt?: string }; services?: { invoice: SunatServiceState; consultation: SunatServiceState; summary: SunatServiceState } };
type SunatHistoryRow = { checked_at: string; overall_status: string; code: string; message: string };

export function HotelConfig({ config, sessionToken, billingEnabled = false, onSave, notificationPermission, pushSubscriptionActive, pushSubscriptionLoading, pushSubscriptionError, onToggleNotifications, onSendTestNotification }: HotelConfigProps) {
  const [name, setName]                       = useState(config.name);
  const [logoUrl, setLogoUrl]                 = useState(config.logo_url ?? '');
  const [contactPhone, setContactPhone]       = useState(config.contact_phone ?? '');
  const [razonSocial, setRazonSocial]         = useState(config.razon_social ?? '');
  const [ruc, setRuc]                         = useState(config.ruc ?? '');
  const [direccion, setDireccion]             = useState(config.direccion ?? '');
  const [cuentaBancaria, setCuentaBancaria]   = useState(config.cuenta_bancaria ?? '');
  const [cci, setCci]                         = useState(config.cci ?? '');
  const [nDetraccion, setNDetraccion]         = useState(config.n_detraccion ?? '');
  const [firmaUrl, setFirmaUrl]               = useState(config.firma_url ?? '');
  const [yapeQrUrl, setYapeQrUrl]             = useState(config.yape_qr_url ?? '');
  const [plinQrUrl, setPlinQrUrl]             = useState(config.plin_qr_url ?? '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(config.notifications_enabled ?? false);
  const [notificationTime, setNotificationTime] = useState((config.notification_time ?? '07:00').slice(0, 5));
  const [openSection, setOpenSection] = useState<'hotel' | 'valuation' | 'payments' | 'notifications' | 'sunat' | null>(null);
  const defaultTaxSettings = { enabled: false, invoice_series: 'F001', receipt_series: 'B001', igv_rate: 18, prices_include_igv: true, ubigeo: '', department: '', province: '', district: '', fiscal_email: '', fiscal_phone: '', environment: 'test' as const };
  const [taxSettings, setTaxSettings] = useState({ ...defaultTaxSettings, ...(config.tax_settings ?? {}) });
  const [saving, setSaving]                   = useState(false);
  const [success, setSuccess]                 = useState(false);
  const [error, setError]                     = useState('');
  const [solUser, setSolUser] = useState('');
  const [solPassword, setSolPassword] = useState('');
  const [certificatePassword, setCertificatePassword] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [sunatStatus, setSunatStatus] = useState({ sol_user_configured: false, sol_password_configured: false, certificate_configured: false, certificate_password_configured: false, certificate_filename: '' });
  const [savingSunat, setSavingSunat] = useState(false);
  const [sunatMessage, setSunatMessage] = useState('');
  const [checkingSunat, setCheckingSunat] = useState(false);
  const [sunatConnection, setSunatConnection] = useState<SunatConnectionState | null>(null);
  const [sunatLastCheckedAt, setSunatLastCheckedAt] = useState<Date | null>(null);
  const [sunatHistory, setSunatHistory] = useState<SunatHistoryRow[]>([]);
  const [previewError, setPreviewError]       = useState(false);
  const [registrationToken, setRegistrationToken] = useState(config.public_registration_token ?? '');
  const [registrationQr, setRegistrationQr] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const fileRef    = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const firmaFileRef   = useRef<HTMLInputElement>(null);
  const firmaCameraRef = useRef<HTMLInputElement>(null);
  const yapeQrRef = useRef<HTMLInputElement>(null);
  const plinQrRef = useRef<HTMLInputElement>(null);
  const certificateRef = useRef<HTMLInputElement>(null);
  const registrationUrl = registrationToken ? `${window.location.origin}/reservacion/${registrationToken}` : '';

  useEffect(() => {
    if (!registrationUrl) return setRegistrationQr('');
    QRCode.toDataURL(registrationUrl, { width: 320, margin: 2, errorCorrectionLevel: 'M' }).then(setRegistrationQr).catch(() => setRegistrationQr(''));
  }, [registrationUrl]);

  const copyRegistrationUrl = async () => {
    await navigator.clipboard.writeText(registrationUrl);
    setRegistrationMessage('Enlace copiado.');
  };

  const regenerateRegistrationUrl = async () => {
    if (!window.confirm('El enlace anterior dejará de funcionar. ¿Generar uno nuevo?')) return;
    const { data, error: rpcError } = await getClient().rpc('regenerate_public_registration_token', { p_session_token: sessionToken });
    if (rpcError || !data) { setRegistrationMessage(rpcError?.message ?? 'No se pudo generar el enlace.'); return; }
    setRegistrationToken(String(data));
    setRegistrationMessage('Nuevo enlace generado. El anterior ya no funciona.');
  };

  useEffect(() => {
    if (!billingEnabled) return;
    getClient().rpc('get_sunat_credentials_status', { p_session_token: sessionToken }).then(({ data }) => {
      if (data?.[0]) setSunatStatus({ ...data[0], certificate_filename: data[0].certificate_filename ?? '' });
    });
  }, [billingEnabled, sessionToken]);

  const saveSunatCredentials = async () => {
    if (!solUser && !solPassword && !certificateFile && !certificatePassword) {
      setSunatMessage('Ingresa al menos un dato nuevo para guardar.');
      return;
    }
    setSavingSunat(true);
    setSunatMessage('');
    let certificateBase64: string | null = null;
    if (certificateFile) {
      const bytes = new Uint8Array(await certificateFile.arrayBuffer());
      if (!bytes.length || bytes[0] !== 0x30) {
        setSavingSunat(false);
        setSunatMessage('El archivo seleccionado no tiene estructura PKCS#12 binaria. Exporta nuevamente el certificado como P12/PFX incluyendo la clave privada.');
        return;
      }
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      certificateBase64 = btoa(binary);
    }
    const { error: credentialsError } = await getClient().rpc('save_sunat_credentials', {
      p_session_token: sessionToken,
      p_sol_user: solUser.trim() || null,
      p_sol_password: solPassword || null,
      p_certificate_base64: certificateBase64,
      p_certificate_password: certificatePassword || null,
      p_certificate_filename: certificateFile?.name ?? null,
    });
    setSavingSunat(false);
    if (credentialsError) { setSunatMessage(credentialsError.message); return; }
    setSunatStatus(current => ({
      sol_user_configured: current.sol_user_configured || Boolean(solUser),
      sol_password_configured: current.sol_password_configured || Boolean(solPassword),
      certificate_configured: current.certificate_configured || Boolean(certificateFile),
      certificate_password_configured: current.certificate_password_configured || Boolean(certificatePassword),
      certificate_filename: certificateFile?.name ?? current.certificate_filename,
    }));
    setSolUser(''); setSolPassword(''); setCertificatePassword(''); setCertificateFile(null);
    setSunatConnection(null);
    if (certificateRef.current) certificateRef.current.value = '';
    setSunatMessage('Credenciales cifradas y guardadas correctamente.');
  };

  const loadSunatHistory = useCallback(async () => {
    const { data } = await getClient().rpc('list_sunat_connection_checks', { p_session_token: sessionToken, p_limit: 12 });
    if (data) setSunatHistory(data as SunatHistoryRow[]);
  }, [sessionToken]);

  const checkSunatConnection = useCallback(async () => {
    setCheckingSunat(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-sunat-connection`, {
        method: 'POST',
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'x-session-token': sessionToken, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const result = await response.json();
      const nextConnection: SunatConnectionState = { connected: Boolean(result.connected), overallStatus: result.overallStatus, code: result.code || 'unknown', message: result.message || 'SUNAT no devolvió un resultado reconocible.', environment: result.environment, certificate: result.certificate, services: result.services };
      setSunatConnection(nextConnection);
      if (nextConnection.connected && 'Notification' in window && Notification.permission === 'granted') new Notification('ValStay · SUNAT conectado', { body: nextConnection.message, icon: '/valstay.png', tag: 'valstay-sunat-test' });
    } catch {
      const message = 'No fue posible ejecutar la comprobación de SUNAT.';
      setSunatConnection({ connected: false, code: 'network_error', message });
    } finally { setCheckingSunat(false); setSunatLastCheckedAt(new Date()); await loadSunatHistory(); }
  }, [loadSunatHistory, sessionToken]);

  useEffect(() => {
    if (!billingEnabled || openSection !== 'sunat') return;
    void loadSunatHistory();
  }, [billingEnabled, loadSunatHistory, openSection]);

  const [lastConfigId, setLastConfigId] = useState(config.updated_at);
  if (config.updated_at !== lastConfigId) {
    setName(config.name);
    setLogoUrl(config.logo_url ?? '');
    setContactPhone(config.contact_phone ?? '');
    setRazonSocial(config.razon_social ?? '');
    setRuc(config.ruc ?? '');
    setDireccion(config.direccion ?? '');
    setCuentaBancaria(config.cuenta_bancaria ?? '');
    setCci(config.cci ?? '');
    setNDetraccion(config.n_detraccion ?? '');
    setFirmaUrl(config.firma_url ?? '');
    setYapeQrUrl(config.yape_qr_url ?? '');
    setPlinQrUrl(config.plin_qr_url ?? '');
    setNotificationsEnabled(config.notifications_enabled ?? false);
    setNotificationTime((config.notification_time ?? '07:00').slice(0, 5));
    setTaxSettings({ ...defaultTaxSettings, ...(config.tax_settings ?? {}) });
    setRegistrationToken(config.public_registration_token ?? '');
    setLastConfigId(config.updated_at);
  }

  const compressImage = (file: File, maxPx = 300, quality = 0.85): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      const blobUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round((height / width) * maxPx); width = maxPx; }
          else                 { width  = Math.round((width / height) * maxPx); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        // WebP not supported on all devices — fall back to JPEG
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (!dataUrl || dataUrl === 'data:,') { reject(new Error('encode')); return; }
        resolve(dataUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        // Last resort: just read raw base64
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      };
      img.src = blobUrl;
    });

  const processFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('El archivo debe pesar menos de 10 MB.'); return; }
    setError('');
    try {
      const compressed = await compressImage(file);
      setLogoUrl(compressed);
      setPreviewError(false);
    } catch {
      // Very last resort: read raw
      try {
        const raw = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload  = e => res(e.target?.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        setLogoUrl(raw);
        setPreviewError(false);
      } catch {
        setError('No se pudo leer la imagen. Prueba con un archivo PNG o JPG.');
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  const processFirmaFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('El archivo debe pesar menos de 10 MB.'); return; }
    setError('');
    try {
      const compressed = await compressImage(file, 800, 0.88);
      setFirmaUrl(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = e => setFirmaUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFirmaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFirmaFile(file);
    e.target.value = '';
  };

  const handleQrFile = async (e: React.ChangeEvent<HTMLInputElement>, method: 'yape' | 'plin') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('El archivo debe pesar menos de 10 MB.'); return; }
    try {
      const image = await compressImage(file, 700, 0.9);
      if (method === 'yape') setYapeQrUrl(image); else setPlinQrUrl(image);
    } catch { setError('No se pudo leer la imagen del QR.'); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre no puede estar vacío.'); return; }
    if (taxSettings.enabled && (!/^\d{11}$/.test(ruc) || !razonSocial.trim() || !direccion.trim() || !/^\d{6}$/.test(taxSettings.ubigeo) || !taxSettings.department.trim() || !taxSettings.province.trim() || !taxSettings.district.trim())) { setError('Para activar SUNAT completa RUC, razón social, dirección, UBIGEO, departamento, provincia y distrito.'); setOpenSection('sunat'); return; }
    if (!/^F[A-Z0-9]{3}$/.test(taxSettings.invoice_series.toUpperCase()) || !/^B[A-Z0-9]{3}$/.test(taxSettings.receipt_series.toUpperCase())) { setError('Usa series válidas, por ejemplo F001 y B001.'); setOpenSection('sunat'); return; }
    setError('');
    setSaving(true);
    setSuccess(false);
    const { error: err } = await onSave({
      name: name.trim(),
      logo_url: logoUrl.trim() || null,
      contact_phone: contactPhone.trim() || null,
      razon_social: razonSocial.trim() || null,
      ruc: ruc.trim() || null,
      direccion: direccion.trim() || null,
      cuenta_bancaria: cuentaBancaria.trim() || null,
      cci: cci.trim() || null,
      n_detraccion: nDetraccion.trim() || null,
      firma_url: firmaUrl || null,
      yape_qr_url: yapeQrUrl || null,
      plin_qr_url: plinQrUrl || null,
      notifications_enabled: notificationsEnabled,
      notification_time: notificationTime,
      tax_settings: { ...taxSettings, invoice_series: taxSettings.invoice_series.toUpperCase(), receipt_series: taxSettings.receipt_series.toUpperCase() },
    });
    setSaving(false);
    if (err) { setError(err); return; }
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const toggleSunatEnvironment = () => {
    const nextEnvironment = taxSettings.environment === 'production' ? 'test' : 'production';
    const message = nextEnvironment === 'production'
      ? '¿Cambiar a SUNAT PRODUCCIÓN? Las próximas boletas y facturas que envíes serán comprobantes tributarios reales y consumirán correlativo.'
      : '¿Volver a SUNAT PRUEBAS? No uses este entorno para emitir comprobantes reales.';
    if (!window.confirm(message)) return;
    setTaxSettings(current => ({ ...current, environment: nextEnvironment }));
  };

  const disableNotificationsForAll = async () => {
    setError('');
    setSaving(true);
    setSuccess(false);
    const { error: saveError } = await onSave({
      notifications_enabled: false,
      notification_time: notificationTime,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setNotificationsEnabled(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const clearLogo = () => {
    setLogoUrl('');
    setPreviewError(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const hasLogo = logoUrl.trim() !== '';

  const inputCls = 'w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500';
  const labelCls = 'block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1.5';

  return (
    <div className="flex w-full max-w-none flex-col gap-6">
      {/* Live preview */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-white/20">
          {hasLogo && !previewError ? (
            <img src={logoUrl} alt={name} className="w-full h-full object-contain p-1"
              onError={() => setPreviewError(true)} />
          ) : (
            <Hotel className="w-8 h-8 text-white/60" />
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Vista previa en tiempo real</p>
          <p className="text-white font-bold text-xl">{name || 'Nombre del hotel'}</p>
          <p className="text-slate-400 text-sm">Sistema de Gestion Hotelera</p>
        </div>
      </div>

      <section className="order-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
        <button type="button" onClick={() => setOpenSection(current => current === 'notifications' ? null : 'notifications')}
          aria-expanded={openSection === 'notifications'}
          className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
          <BellRing className="w-5 h-5 text-gray-600 dark:text-zinc-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100">Notificaciones</h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              {notificationsEnabled ? `Avisos programados a las ${notificationTime}` : 'Avisos automáticos desactivados'}
            </p>
          </div>
          {openSection === 'notifications' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {openSection === 'notifications' && <div className="px-4 py-4 border-t border-gray-100 dark:border-zinc-800 space-y-4">
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-zinc-100">Permiso del navegador</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              {notificationPermission === 'granted' && 'Las notificaciones están permitidas en este navegador.'}
              {notificationPermission === 'default' && 'Actívalas para recibir avisos de salidas.'}
              {notificationPermission === 'denied' && 'Están bloqueadas. Habilítalas desde los permisos del sitio.'}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Guarda los cambios para aplicar la hora seleccionada.</p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-3 py-3 dark:border-zinc-700">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Notificaciones en este dispositivo</p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-zinc-500">
                {pushSubscriptionLoading ? 'Actualizando…' : pushSubscriptionActive ? 'Activadas' : 'Desactivadas'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pushSubscriptionActive}
              aria-label="Notificaciones en este dispositivo"
              onClick={onToggleNotifications}
              disabled={pushSubscriptionLoading || (!pushSubscriptionActive && notificationPermission === 'denied')}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pushSubscriptionActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${pushSubscriptionActive ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          {pushSubscriptionError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{pushSubscriptionError}</p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
              <input type="checkbox" checked={notificationsEnabled} onChange={e => setNotificationsEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Activar avisos</span>
            </label>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Hora del aviso</label>
              <input type="time" value={notificationTime} onChange={e => setNotificationTime(e.target.value)} disabled={!notificationsEnabled}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-800 dark:text-zinc-200 disabled:opacity-40" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSendTestNotification} disabled={!pushSubscriptionActive || notificationPermission !== 'granted'}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Enviar notificación de prueba
            </button>
            <button type="button" onClick={disableNotificationsForAll} disabled={saving || !notificationsEnabled}
              className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Desactivar avisos para todos
            </button>
          </div>
        </div>}
      </section>

      <form onSubmit={handleSave} className="contents">

        {/* ── Identidad visual ── */}
        <section className="order-1 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
          <button type="button" onClick={() => setOpenSection(current => current === 'hotel' ? null : 'hotel')}
            aria-expanded={openSection === 'hotel'}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            <Hotel className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100">Datos del hospedaje</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Nombre, teléfono, identidad visual y logo</p>
            </div>
            {openSection === 'hotel' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          {openSection === 'hotel' && <div className="space-y-4 px-4 pb-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <div>
              <label className={labelCls}>Nombre del hotel</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Hotel Gran Bolivar"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Aparece en la barra lateral y en la pantalla de inicio de sesion.</p>
            </div>

            <div>
              <label className={labelCls}>Teléfono de contacto (WhatsApp)</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value.replace(/[^\d+\s()-]/g, '').slice(0, 25))}
                placeholder="Ej: 987 654 321"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Aquí llegan los avisos de asignaciones de personal por WhatsApp (ValStay Empresa).</p>
            </div>

            <div>
              <label className={labelCls}>Logo</label>
              {/* Gallery picker */}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              {/* Camera capture */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl text-sm text-gray-600 dark:text-zinc-400 hover:border-gray-500 dark:hover:border-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                  <Upload className="w-4 h-4" />
                  Galeria / archivo
                </button>
                <button type="button" onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl text-sm text-blue-600 dark:text-blue-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <Camera className="w-4 h-4" />
                  Tomar foto
                </button>
                {hasLogo && (
                  <button type="button" onClick={clearLogo}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <X className="w-3 h-3" /> Quitar logo
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1.5">PNG, JPG, WebP, SVG — hasta 10 MB (se comprime automaticamente)</p>

              {hasLogo && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                    <img src={logoUrl} alt="Vista previa" className="w-full h-full object-contain"
                      onError={() => setPreviewError(true)} />
                  </div>
                  {previewError
                    ? <p className="text-sm text-red-500">No se pudo cargar la imagen. Verifica la URL.</p>
                    : <p className="text-sm text-gray-500 dark:text-zinc-400">Vista previa del logo</p>
                  }
                </div>
              )}

              {hasLogo && (
                <button type="button" onClick={clearLogo}
                  className="mt-2 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 underline">
                  Usar icono predeterminado (sin logo)
                </button>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
              <div className="flex items-start gap-3"><Link2 className="mt-0.5 h-5 w-5 shrink-0 text-gray-700 dark:text-zinc-200" /><div><p className="text-sm font-black text-gray-900 dark:text-white">Enlace público de reservaciones</p><p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">El huésped completa sus datos y recepción recibe una solicitud para asignarle una habitación.</p></div></div>
              {registrationUrl && <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0"><input readOnly value={registrationUrl} onFocus={event => event.currentTarget.select()} className={`${inputCls} font-mono text-xs`} /><div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={copyRegistrationUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white dark:bg-white dark:text-black"><Copy className="h-4 w-4" />Copiar</button>
                  <a href={registrationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 dark:border-zinc-600 dark:text-zinc-200"><ExternalLink className="h-4 w-4" />Abrir formulario</a>
                  {registrationQr && <a href={registrationQr} download={`qr-reservaciones-${name.replace(/\s+/g, '-').toLowerCase()}.png`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 dark:border-zinc-600 dark:text-zinc-200"><Download className="h-4 w-4" />Descargar QR</a>}
                  <button type="button" onClick={regenerateRegistrationUrl} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"><RefreshCw className="h-4 w-4" />Regenerar</button>
                </div></div>{registrationQr && <img src={registrationQr} alt="QR de reservaciones" className="mx-auto h-32 w-32 rounded-lg border border-gray-200 bg-white p-1 dark:border-zinc-600" />}
              </div>}
              {registrationMessage && <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{registrationMessage}</p>}
            </div>
          </div>}
        </section>

        {/* ── Datos fiscales / Valorización ── */}
        <section className="order-2 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
          <button type="button" onClick={() => setOpenSection(current => current === 'valuation' ? null : 'valuation')}
            aria-expanded={openSection === 'valuation'}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            <FileText className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100">Datos para valorización</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Datos fiscales, bancarios y firma</p>
            </div>
            {openSection === 'valuation' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          {openSection === 'valuation' && <div className="px-4 pb-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">Estos datos aparecen al exportar una valorización.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Razon Social</label>
              <input
                type="text"
                value={razonSocial}
                onChange={e => setRazonSocial(e.target.value)}
                placeholder="Ej: JUAN PEREZ GARCIA"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>RUC</label>
              <input
                type="text"
                value={ruc}
                onChange={e => setRuc(e.target.value)}
                placeholder="Ej: 20123456789"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Direccion</label>
              <input
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Ej: AV. PRINCIPAL 123, PISO 2"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>N° Cuenta Bancaria</label>
              <input
                type="text"
                value={cuentaBancaria}
                onChange={e => setCuentaBancaria(e.target.value)}
                placeholder="Ej: 000-123456789-0 - Banco XYZ"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>CCI</label>
              <input
                type="text"
                value={cci}
                onChange={e => setCci(e.target.value)}
                placeholder="Ej: 000-123-000000000000-00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>N° de Detraccion</label>
              <input
                type="text"
                value={nDetraccion}
                onChange={e => setNDetraccion(e.target.value)}
                placeholder="Ej: 00-000-000000"
                className={inputCls}
              />
            </div>
            </div>
          </div>}
        </section>

        {/* ── Facturación electrónica ── */}
        <section className={`order-3 overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700 ${billingEnabled ? '' : 'opacity-50'}`}>
          <button type="button" disabled={!billingEnabled} onClick={() => setOpenSection(current => current === 'sunat' ? null : 'sunat')}
            aria-expanded={openSection === 'sunat'}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 disabled:cursor-not-allowed dark:hover:bg-zinc-800 transition-colors">
            <Landmark className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100">Facturación electrónica / SUNAT</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{billingEnabled ? (taxSettings.enabled ? `${taxSettings.environment === 'production' ? 'Producción' : 'Pruebas'} · Conexión directa SUNAT` : 'Sin activar') : 'Actualiza tu plan para habilitar esta configuración'}</p>
            </div>
            {!billingEnabled ? <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"><LockKeyhole className="h-3 w-3" />Plan</span> : openSection === 'sunat' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          {billingEnabled && openSection === 'sunat' && <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-4 dark:border-zinc-800">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
              Conexión directa con SUNAT mediante XML UBL 2.1 y certificado digital. Las claves privadas se guardan cifradas y nunca se muestran nuevamente.
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <span><span className="block text-sm font-bold text-gray-800 dark:text-zinc-100">Activar facturación electrónica</span><span className="text-xs text-gray-500 dark:text-zinc-400">Primero valida una factura y una boleta en pruebas SUNAT</span></span>
              <input type="checkbox" checked={taxSettings.enabled} onChange={e => setTaxSettings(current => ({ ...current, enabled: e.target.checked }))} className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500" />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>RUC del emisor *</label><input value={ruc} onChange={e => setRuc(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="11 dígitos" className={inputCls} /></div>
              <div><label className={labelCls}>Razón social *</label><input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Dirección fiscal *</label><input value={direccion} onChange={e => setDireccion(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Serie de factura</label><input value={taxSettings.invoice_series} onChange={e => setTaxSettings(current => ({ ...current, invoice_series: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) }))} placeholder="F001" className={inputCls} /></div>
              <div><label className={labelCls}>Serie de boleta</label><input value={taxSettings.receipt_series} onChange={e => setTaxSettings(current => ({ ...current, receipt_series: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) }))} placeholder="B001" className={inputCls} /></div>
              <div><label className={labelCls}>IGV (%)</label><input type="number" min="0" max="100" step="0.01" value={taxSettings.igv_rate} onChange={e => setTaxSettings(current => ({ ...current, igv_rate: Number(e.target.value) }))} className={inputCls} /></div>
              <div>
                <label className={labelCls}>Entorno SUNAT</label>
                <button type="button" role="switch" aria-checked={taxSettings.environment === 'production'} onClick={toggleSunatEnvironment} className={`flex h-[42px] w-full items-center justify-between rounded-xl border px-3 transition-colors ${taxSettings.environment === 'production' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'}`}>
                  <span className="text-sm font-bold">{taxSettings.environment === 'production' ? 'Producción real' : 'Modo de pruebas'}</span>
                  <span className={`relative h-6 w-11 rounded-full transition-colors ${taxSettings.environment === 'production' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${taxSettings.environment === 'production' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </span>
                </button>
              </div>
              <div><label className={labelCls}>UBIGEO fiscal *</label><input value={taxSettings.ubigeo} onChange={e => setTaxSettings(current => ({ ...current, ubigeo: e.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" placeholder="6 dígitos" className={inputCls} /></div>
              <div><label className={labelCls}>Departamento *</label><input value={taxSettings.department} onChange={e => setTaxSettings(current => ({ ...current, department: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Provincia *</label><input value={taxSettings.province} onChange={e => setTaxSettings(current => ({ ...current, province: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Distrito *</label><input value={taxSettings.district} onChange={e => setTaxSettings(current => ({ ...current, district: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Correo de facturación</label><input type="email" value={taxSettings.fiscal_email} onChange={e => setTaxSettings(current => ({ ...current, fiscal_email: e.target.value }))} placeholder="facturacion@hospedaje.com" className={inputCls} /></div>
              <div><label className={labelCls}>Teléfono de facturación</label><input type="tel" value={taxSettings.fiscal_phone} onChange={e => setTaxSettings(current => ({ ...current, fiscal_phone: e.target.value.replace(/[^\d+\s()-]/g, '').slice(0, 25) }))} placeholder="Ej: 987 654 321" className={inputCls} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300"><input type="checkbox" checked={taxSettings.prices_include_igv} onChange={e => setTaxSettings(current => ({ ...current, prices_include_igv: e.target.checked }))} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />Las tarifas registradas ya incluyen IGV</label>
            {taxSettings.environment === 'production' && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Producción debe activarse únicamente después de que SUNAT acepte una factura y una boleta en el entorno de pruebas.</p>}
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="h-4 w-4" />}{saving ? 'Guardando…' : 'Guardar configuración SUNAT'}</button>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"><ShieldCheck className="h-5 w-5" /></div>
                <div><p className="text-sm font-bold text-gray-800 dark:text-zinc-100">Credenciales para conexión directa</p><p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">Los campos quedan vacíos después de guardarse. ValStay nunca vuelve a mostrar las claves.</p></div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Usuario SOL', sunatStatus.sol_user_configured], ['Clave SOL', sunatStatus.sol_password_configured],
                  ['Certificado', sunatStatus.certificate_configured], ['Clave del certificado', sunatStatus.certificate_password_configured],
                ].map(([label, ready]) => <div key={String(label)} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 dark:bg-zinc-900"><span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'}`} /><span className="text-gray-600 dark:text-zinc-300">{label}</span></div>)}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelCls}>Usuario SOL</label><div className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={solUser} onChange={e => setSolUser(e.target.value)} autoComplete="off" placeholder={sunatStatus.sol_user_configured ? 'Configurado · ingresa para reemplazar' : 'Usuario secundario SOL'} className={`${inputCls} pl-10`} /></div></div>
                <div><label className={labelCls}>Clave SOL</label><input type="password" value={solPassword} onChange={e => setSolPassword(e.target.value)} autoComplete="new-password" placeholder={sunatStatus.sol_password_configured ? 'Configurada · ingresa para reemplazar' : 'Clave SOL'} className={inputCls} /></div>
                <div><label className={labelCls}>Certificado digital</label><input ref={certificateRef} type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={e => setCertificateFile(e.target.files?.[0] ?? null)} className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-bold dark:file:bg-zinc-700`} /><p className="mt-1 text-[11px] text-gray-400">{certificateFile?.name || sunatStatus.certificate_filename || 'Archivo .pfx o .p12'}</p></div>
                <div><label className={labelCls}>Contraseña del certificado</label><input type="password" value={certificatePassword} onChange={e => setCertificatePassword(e.target.value)} autoComplete="new-password" placeholder={sunatStatus.certificate_password_configured ? 'Configurada · ingresa para reemplazar' : 'Contraseña del certificado'} className={inputCls} /></div>
              </div>
              {sunatMessage && <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${sunatMessage.includes('correctamente') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'}`}>{sunatMessage}</p>}
              <button type="button" onClick={() => void saveSunatCredentials()} disabled={savingSunat} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{savingSunat ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ShieldCheck className="h-4 w-4" />}{savingSunat ? 'Cifrando y guardando…' : 'Guardar credenciales seguras'}</button>
              <div className="mt-4 border-t border-gray-200 pt-4 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-bold text-gray-800 dark:text-zinc-100">Servicios SUNAT</p><p className="text-xs text-gray-500 dark:text-zinc-400">Consulta cada servicio por separado sin emitir documentos.</p></div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${sunatConnection?.overallStatus === 'connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : sunatConnection?.overallStatus === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : sunatConnection ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'}`}><span className={`h-2 w-2 rounded-full ${sunatConnection?.overallStatus === 'connected' ? 'bg-emerald-500' : sunatConnection?.overallStatus === 'partial' ? 'bg-amber-500' : sunatConnection ? 'bg-red-500' : 'bg-gray-400'}`} />{sunatConnection?.overallStatus === 'connected' ? 'Conectado' : sunatConnection?.overallStatus === 'partial' ? 'Conexión parcial' : sunatConnection ? 'No verificado' : 'Sin comprobar'}</span>
                </div>
                {sunatConnection && <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${sunatConnection.overallStatus === 'connected' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : sunatConnection.overallStatus === 'partial' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'}`}><p className="font-bold">{sunatConnection.overallStatus === 'connected' ? 'Servicios conectados' : sunatConnection.overallStatus === 'partial' ? 'Conexión parcial con SUNAT' : 'Servicios no verificados'}</p><p className="mt-1">{sunatConnection.message}</p>{sunatConnection.certificate?.expiresAt && <p className="mt-1 opacity-80">Certificado vigente hasta: {new Date(sunatConnection.certificate.expiresAt).toLocaleDateString('es-PE')}</p>}</div>}
                {sunatConnection?.services && <div className="mt-3 grid gap-2 sm:grid-cols-3">{[
                  ['Facturas', sunatConnection.services.invoice], ['Consulta CDR', sunatConnection.services.consultation], ['Resumen de boletas', sunatConnection.services.summary],
                ].map(([serviceLabel, service]) => { const state = service as SunatServiceState; const good = ['connected','last_accepted'].includes(state.status); const warning = state.status === 'unknown'; return <div key={String(serviceLabel)} className={`rounded-lg border p-2 text-[11px] ${good ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300' : warning ? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300'}`}><p className="font-black">{serviceLabel as string}</p><p className="mt-1 leading-relaxed">{state.message}</p><p className="mt-1 opacity-70">Código: {state.code}</p></div>; })}</div>}
                {sunatLastCheckedAt && <p className="mt-2 text-right text-[11px] text-gray-400">Última comprobación: {sunatLastCheckedAt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · prueba automática cada 5 min</p>}
                <button type="button" onClick={() => void checkSunatConnection()} disabled={checkingSunat || savingSunat} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"><RefreshCw className={`h-4 w-4 ${checkingSunat ? 'animate-spin' : ''}`} />{checkingSunat ? 'Comprobando con SUNAT…' : 'Comprobar conexión con SUNAT'}</button>
                {sunatHistory.length > 0 && <details className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-zinc-700"><summary className="cursor-pointer text-xs font-bold text-gray-600 dark:text-zinc-300">Historial del servidor ({sunatHistory.length})</summary><div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{sunatHistory.map((entry, index) => <div key={`${entry.checked_at}-${index}`} className="flex items-start justify-between gap-3 border-t border-gray-100 py-2 text-[11px] first:border-0 dark:border-zinc-800"><div><p className="font-bold text-gray-700 dark:text-zinc-200">{entry.overall_status === 'connected' ? 'Conectado' : entry.overall_status === 'partial' ? 'Parcial' : 'No verificado'}</p><p className="text-gray-400">{entry.message}</p></div><time className="shrink-0 text-gray-400">{new Date(entry.checked_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></div>)}</div></details>}
              </div>
            </div>
          </div>}
        </section>

        <section className="order-3 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSection(current => current === 'payments' ? null : 'payments')}
            aria-expanded={openSection === 'payments'}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <QrCode className="w-5 h-5 text-gray-600 dark:text-zinc-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100">Datos para tipos de pago</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                Yape: {yapeQrUrl ? 'configurado' : 'sin configurar'} · Plin: {plinQrUrl ? 'configurado' : 'sin configurar'}
              </p>
            </div>
            {openSection === 'payments'
              ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
              : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
          </button>

          {openSection === 'payments' && <div className="px-4 pb-4 border-t border-gray-100 dark:border-zinc-800 pt-4">
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">Se mostrarán al registrar un huésped directo que pague por Yape o Plin.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { method: 'yape' as const, label: 'Yape', value: yapeQrUrl, ref: yapeQrRef, clear: () => setYapeQrUrl('') },
              { method: 'plin' as const, label: 'Plin', value: plinQrUrl, ref: plinQrRef, clear: () => setPlinQrUrl('') },
            ]).map(item => (
              <div key={item.method} className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200 mb-3">QR de {item.label}</p>
                <input ref={item.ref} type="file" accept="image/*" className="hidden" onChange={e => handleQrFile(e, item.method)} />
                {item.value ? <img src={item.value} alt={`QR de ${item.label}`} className="w-40 h-40 object-contain mx-auto mb-3 rounded-lg" /> : <div className="w-40 h-40 mx-auto mb-3 rounded-lg bg-gray-50 dark:bg-zinc-800 flex items-center justify-center"><QrCode className="w-12 h-12 text-gray-300 dark:text-zinc-600" /></div>}
                <div className="flex justify-center gap-2">
                  <button type="button" onClick={() => item.ref.current?.click()} className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-blue-400 rounded-lg text-xs text-blue-600 dark:text-blue-400"><Upload className="w-3.5 h-3.5" />{item.value ? 'Cambiar' : 'Subir QR'}</button>
                  {item.value && <button type="button" onClick={item.clear} className="p-2 text-red-500 border border-red-200 dark:border-red-800 rounded-lg"><X className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            ))}
            </div>
          </div>
          }
        </section>

        {/* ── Firma ── */}
        {openSection === 'valuation' && <section className="order-2 -mt-4 rounded-b-xl border border-t-0 border-gray-200 dark:border-zinc-700 px-4 pb-4">
          <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100 mb-1 flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            Firma
          </h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Aparece centrada al pie de cada PDF de valorización.
          </p>

          <input ref={firmaFileRef} type="file" accept="image/*" onChange={handleFirmaFileChange} className="hidden" />
          <input ref={firmaCameraRef} type="file" accept="image/*" capture="environment" onChange={handleFirmaFileChange} className="hidden" />

          <div className="flex flex-wrap gap-2 items-center mb-2">
            <button type="button" onClick={() => firmaFileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl text-sm text-gray-600 dark:text-zinc-400 hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
              <Upload className="w-4 h-4" />
              Subir imagen
            </button>
            <button type="button" onClick={() => firmaCameraRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl text-sm text-blue-600 dark:text-blue-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Camera className="w-4 h-4" />
              Tomar foto
            </button>
            {firmaUrl && (
              <button type="button" onClick={() => setFirmaUrl('')}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <X className="w-3 h-3" /> Quitar firma
              </button>
            )}
          </div>
          {firmaUrl && (
            <div className="flex justify-center border border-gray-200 dark:border-zinc-700 rounded-xl p-3 bg-gray-50 dark:bg-zinc-800">
              <img src={firmaUrl} alt="Firma" className="max-h-24 max-w-xs object-contain" />
            </div>
          )}
        </section>}

        {error && (
          <p className="order-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800">{error}</p>
        )}

        {success && (
          <div className="order-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-2.5 rounded-xl border border-green-200 dark:border-green-800">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Cambios guardados correctamente.
          </div>
        )}

        <button type="submit" disabled={saving}
          style={{ order: 5 }}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-zinc-700 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-600 text-sm font-semibold transition-colors disabled:opacity-60">
          {saving
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
            : <><Save className="w-4 h-4" /> Guardar cambios</>
          }
        </button>
      </form>
    </div>
  );
}
