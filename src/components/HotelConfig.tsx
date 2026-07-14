import { useState, useRef } from 'react';
import { HotelConfig as HotelConfigType } from '../lib/supabase';
import { Hotel, Save, Upload, X, CheckCircle, FileText, Camera, PenLine, QrCode, ChevronDown, ChevronUp, BellRing } from 'lucide-react';

interface HotelConfigProps {
  config: HotelConfigType;
  onSave: (updates: Partial<HotelConfigType>) => Promise<{ error?: string }>;
  notificationPermission: NotificationPermission;
  onRequestNotifications: () => Promise<void>;
  onSendTestNotification: () => Promise<void>;
}

export function HotelConfig({ config, onSave, notificationPermission, onRequestNotifications, onSendTestNotification }: HotelConfigProps) {
  const [name, setName]                       = useState(config.name);
  const [logoUrl, setLogoUrl]                 = useState(config.logo_url ?? '');
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
  const [openSection, setOpenSection] = useState<'hotel' | 'valuation' | 'payments' | 'notifications' | null>(null);
  const [saving, setSaving]                   = useState(false);
  const [success, setSuccess]                 = useState(false);
  const [error, setError]                     = useState('');
  const [previewError, setPreviewError]       = useState(false);
  const fileRef    = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const firmaFileRef   = useRef<HTMLInputElement>(null);
  const firmaCameraRef = useRef<HTMLInputElement>(null);
  const yapeQrRef = useRef<HTMLInputElement>(null);
  const plinQrRef = useRef<HTMLInputElement>(null);

  const [lastConfigId, setLastConfigId] = useState(config.updated_at);
  if (config.updated_at !== lastConfigId) {
    setName(config.name);
    setLogoUrl(config.logo_url ?? '');
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
    setError('');
    setSaving(true);
    setSuccess(false);
    const { error: err } = await onSave({
      name: name.trim(),
      logo_url: logoUrl.trim() || null,
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
    });
    setSaving(false);
    if (err) { setError(err); return; }
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
    <div className="max-w-2xl flex flex-col gap-6">
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
            {notificationPermission === 'default' && (
              <button type="button" onClick={onRequestNotifications}
                className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-zinc-700 text-white text-xs font-semibold hover:bg-gray-800 dark:hover:bg-zinc-600 transition-colors">
                Activar notificaciones
              </button>
            )}
            <button type="button" onClick={onSendTestNotification} disabled={notificationPermission !== 'granted'}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Enviar notificación de prueba
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
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Nombre, identidad visual y logo</p>
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
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">Se mostrarán al registrar un huésped particular que pague por Yape o Plin.</p>
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
