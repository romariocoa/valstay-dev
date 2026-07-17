import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, History, Pencil, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { StayWithDetails, getClient } from '../lib/supabase';

interface Props {
  stays: StayWithDetails[];
  sessionToken: string;
  onUpdated: () => Promise<void> | void;
}

const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-PE');
const shiftDate = (value: string, days: number) => {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const yesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const rangesOverlap = (startA: string, endA: string, startB: string, endB: string) =>
  startA <= endB && startB <= endA;
const nightsBetween = (start: string, end: string) => {
  const startDate = new Date(`${start.slice(0, 10)}T12:00:00`);
  const endDate = new Date(`${end.slice(0, 10)}T12:00:00`);
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
};

function friendlyError(message: string): string {
  if (message.includes('contrasena_incorrecta')) return 'La contraseña es incorrecta.';
  if (message.includes('sin_permisos')) return 'Tu sesión no tiene permisos para editar estancias.';
  if (message.includes('fecha_ingreso_invalida')) return 'La fecha de ingreso no puede ser futura.';
  if (message.includes('fecha_salida_invalida')) return 'Revisa la fecha de salida. Debe ser posterior al ingreso y no puede ser futura.';
  if (message.includes('cargo_invalido')) return 'Selecciona un cargo válido para la empresa.';
  if (message.includes('estancia_huesped_superpuesta')) return 'El cambio se cruza con otra estancia del mismo huésped.';
  if (message.includes('sin_cambios')) return 'No realizaste ningún cambio en las fechas.';
  if (message.includes('estancia_no_encontrada')) return 'La estancia ya no existe o pertenece a otro hotel.';
  return 'No se pudo guardar la modificación.';
}

export function StayDateEditor({ stays, sessionToken, onUpdated }: Props) {
  const [dni, setDni] = useState('');
  const [searchedDni, setSearchedDni] = useState('');
  const [selected, setSelected] = useState<StayWithDetails | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [workerType, setWorkerType] = useState('');
  const [password, setPasswordValue] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StayWithDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const setPassword = (value: string) => {
    if (value || !unlocked) setPasswordValue(value);
  };

  const unlockEditor = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setUnlocking(true);
    setMessage(null);
    const { error } = await getClient().rpc('verify_stay_editor_access', {
      p_session_token: sessionToken,
      p_password: password,
    });
    setUnlocking(false);
    if (error) {
      setPasswordValue('');
      setMessage({ type: 'error', text: friendlyError(error.message) });
      return;
    }
    setUnlocked(true);
  };

  const results = useMemo(() => {
    if (!searchedDni) return [];
    return stays
      .filter(stay => stay.guests?.dni?.trim() === searchedDni)
      .sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));
  }, [searchedDni, stays]);
  const empresas = useMemo(() => [...new Set(stays.map(stay => stay.empresa).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'es')), [stays]);
  const activeSelected = selected?.status === 'active' || selected?.status === 'baja';
  const invalidCheckIn = !activeSelected && Boolean(checkIn && checkOut && checkIn >= checkOut);
  const checkInMax = !activeSelected && checkOut ? shiftDate(checkOut, -1) : today();
  const blockedStays = useMemo(() => {
    if (!selected) return [];
    return stays
      .filter(stay => stay.id !== selected.id && stay.guest_id === selected.guest_id)
      .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
  }, [selected, stays]);
  const proposedEnd = activeSelected && selected
    ? selected.check_out_date.slice(0, 10)
    : checkOut ? shiftDate(checkOut, -1) : '';
  const editedNights = checkIn && (activeSelected || checkOut)
    ? nightsBetween(checkIn, activeSelected ? yesterday() : shiftDate(checkOut, -1))
    : 0;
  const conflictingStays = useMemo(() => {
    if (!checkIn || !proposedEnd) return [];
    return blockedStays.filter(stay => rangesOverlap(
      checkIn,
      proposedEnd,
      stay.check_in_date.slice(0, 10),
      stay.check_out_date.slice(0, 10),
    ));
  }, [blockedStays, checkIn, proposedEnd]);
  const hasDateConflict = conflictingStays.length > 0;
  const openEditor = (stay: StayWithDetails) => {
    setSelected(stay);
    setCheckIn(stay.check_in_date.slice(0, 10));
    setCheckOut(shiftDate(stay.check_out_date, 1));
    setEmpresa(stay.empresa ?? '');
    setWorkerType(stay.worker_type ?? '');
    setMessage(null);
  };

  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!checkIn || (!activeSelected && !checkOut)) return setMessage({ type: 'error', text: 'Completa las fechas requeridas.' });
    if (invalidCheckIn) return setMessage({ type: 'error', text: 'La fecha de ingreso debe ser anterior a la fecha de checkout.' });
    if (empresa && !workerType) return setMessage({ type: 'error', text: 'Selecciona el cargo del huésped.' });
    if (hasDateConflict) return setMessage({ type: 'error', text: 'El rango seleccionado ocupa fechas de otra estancia. Elige un periodo disponible.' });
    setMessage(null);
    setConfirming(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !password) return;
    setSaving(true);
    setMessage(null);
    const { error } = await getClient().rpc('edit_stay_details', {
      p_session_token: sessionToken,
      p_stay_id: selected.id,
      p_check_in_date: checkIn,
      p_check_out_date: activeSelected ? selected.check_out_date.slice(0, 10) : shiftDate(checkOut, -1),
      p_empresa: empresa || null,
      p_worker_type: empresa ? workerType : null,
      p_password: password,
    });
    setSaving(false);
    if (error) return setMessage({ type: 'error', text: friendlyError(error.message) });
    setConfirming(false);
    setSelected(null);
    setMessage({ type: 'success', text: 'La estancia fue actualizada correctamente.' });
    await onUpdated();
  };

  const removeStay = async (event: FormEvent) => {
    event.preventDefault();
    if (!deleteTarget || !password) return;
    setSaving(true);
    setMessage(null);
    const { error } = await getClient().rpc('delete_stay_confirmed', {
      p_session_token: sessionToken,
      p_stay_id: deleteTarget.id,
      p_password: password,
    });
    setSaving(false);
    if (error) return setMessage({ type: 'error', text: friendlyError(error.message) });
    setDeleteTarget(null);
    setSelected(null);
    setMessage({ type: 'success', text: 'La estancia fue eliminada y quedó registrada en la auditoría.' });
    await onUpdated();
  };

  if (!unlocked) return (
    <section className="stay-date-editor overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><ShieldCheck className="h-5 w-5" /></div><div><h3 className="font-bold text-gray-900 dark:text-zinc-100">Acceso a editar estancias</h3><p className="text-xs text-gray-500 dark:text-zinc-400">Ingresa tu contraseña una sola vez para acceder a esta sección.</p></div></div>
      </div>
      <form onSubmit={unlockEditor} className="mx-auto max-w-md space-y-4 p-6">
        <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Contraseña actual<div className="relative mt-1"><input autoFocus required type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
        {message?.type === 'error' && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{message.text}</div>}
        <button disabled={unlocking || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white disabled:opacity-50">{unlocking && <RefreshCw className="h-4 w-4 animate-spin" />}Ingresar a editar estancias</button>
      </form>
    </section>
  );

  return (
    <section className="stay-date-editor overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><History className="h-5 w-5" /></div>
          <div><h3 className="font-bold text-gray-900 dark:text-zinc-100">Editar historial de estancias</h3><p className="text-xs text-gray-500 dark:text-zinc-400">Busca por DNI al huésped cuya estancia deseas corregir.</p></div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <form onSubmit={event => { event.preventDefault(); setSelected(null); setMessage(null); setSearchedDni(dni.trim()); }} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={dni} onChange={event => setDni(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" placeholder="DNI del huésped" className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" /></div>
          <button disabled={!dni.trim()} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">Buscar personal</button>
        </form>

        {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'}`}>{message.text}</div>}

        {searchedDni && results.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">No se encontraron estancias para el DNI {searchedDni}.</div>}

        {results.length > 0 && <div className="space-y-3"><div><p className="font-bold text-gray-900 dark:text-zinc-100">{results[0].guests.name}</p><p className="text-xs text-gray-500 dark:text-zinc-400">DNI {searchedDni} · {results.length} estancia{results.length !== 1 ? 's' : ''}</p></div>{results.map((stay, index) => {
          const isActive = stay.status === 'active' || stay.status === 'baja';
          const nightEnd = isActive && stay.check_out_date.slice(0, 10) > yesterday()
            ? yesterday()
            : stay.check_out_date.slice(0, 10);
          const nights = nightsBetween(stay.check_in_date, nightEnd);
          return <div key={stay.id} className={`flex w-full items-center gap-2 rounded-xl border p-2 transition ${selected?.id === stay.id ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600'}`}><button type="button" onClick={() => openEditor(stay)} className="flex min-w-0 flex-1 items-center justify-between gap-4 p-2 text-left"><div><p className="text-sm font-bold text-gray-900 dark:text-zinc-100">Estancia {results.length - index}: {dateLabel(stay.check_in_date)} – {isActive ? 'Actualmente' : dateLabel(shiftDate(stay.check_out_date, 1))}</p><p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Hab. {stay.rooms?.number ?? 'Sin habitación'}{stay.empresa ? ` · ${stay.empresa}` : ' · Particular'} · {nights} noche{nights !== 1 ? 's' : ''} · {isActive ? 'Activa' : 'Finalizada'}</p></div><Pencil className="h-4 w-4 shrink-0 text-gray-400" /></button><button type="button" title="Eliminar estancia" onClick={() => { setPassword(''); setMessage(null); setDeleteTarget(stay); }} className="rounded-lg p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button></div>;
        })}</div>}

        {selected && <form onSubmit={requestConfirmation} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-900/10"><div className="mb-4 flex items-center justify-between"><div><p className="font-bold text-gray-900 dark:text-zinc-100">Corregir estancia seleccionada</p><p className="text-xs text-gray-500">{activeSelected ? 'Al estar activa, solo puede modificarse la fecha de ingreso.' : 'Puedes corregir las fechas de ingreso y salida.'}</p></div><button type="button" onClick={() => setSelected(null)}><X className="h-5 w-5 text-gray-400" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Fecha de ingreso<input required type="date" value={checkIn} max={checkInMax} onChange={event => setCheckIn(event.target.value)} className={`mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-zinc-800 ${invalidCheckIn ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-zinc-700'}`} />{invalidCheckIn && <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">El ingreso debe ser anterior al checkout.</span>}</label><label className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Fecha de salida (checkout)<input required={!activeSelected} disabled={activeSelected} type="date" value={checkOut} min={checkIn ? shiftDate(checkIn, 1) : undefined} max={today()} onChange={event => setCheckOut(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800" /></label></div>

        {!activeSelected && <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>La fecha de salida es el día real del checkout y no se cuenta como noche. Por ejemplo: ingreso el 1, checkout el 16 = 15 noches.</span></div>}

        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Empresa<select value={empresa} onChange={event => { setEmpresa(event.target.value); if (!event.target.value) setWorkerType(''); }} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"><option value="">Particular / sin empresa</option>{empresas.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Cargo<select value={workerType} disabled={!empresa} required={Boolean(empresa)} onChange={event => setWorkerType(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"><option value="">Selecciona un cargo</option><option value="obrero">Obrero</option><option value="empleado">Empleado</option><option value="staff">Staff</option></select></label></div>

        <p className="mt-3 text-sm font-bold text-amber-800 dark:text-amber-300">{editedNights} noche{editedNights !== 1 ? 's' : ''}</p>

        {blockedStays.length > 0 && <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"><p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Periodos no disponibles</p><div className="mt-2 flex flex-wrap gap-2">{blockedStays.map(stay => {
          const conflicts = conflictingStays.some(item => item.id === stay.id);
          return <span key={stay.id} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${conflicts ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400' : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>{dateLabel(stay.check_in_date)} – {dateLabel(shiftDate(stay.check_out_date, 1))} · Mismo huésped</span>;
        })}</div></div>}

        {hasDateConflict && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Las fechas seleccionadas se cruzan con {conflictingStays.length === 1 ? 'una estancia registrada' : `${conflictingStays.length} estancias registradas`}. Debes elegir un rango disponible.</span></div>}

        <button disabled={hasDateConflict || invalidCheckIn} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck className="h-4 w-4" />Guardar cambios</button></form>}
      </div>

      {confirming && selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><form onSubmit={save} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"><div className="mb-4 flex items-start justify-between"><div><h3 className="font-bold text-gray-900 dark:text-zinc-100">Confirmar modificación</h3><p className="mt-1 text-sm text-gray-500">Ingresa tu contraseña actual para guardar.</p></div><button type="button" onClick={() => setConfirming(false)}><X className="h-5 w-5 text-gray-400" /></button></div><div className="mb-4 rounded-xl bg-gray-50 p-3 text-sm dark:bg-zinc-800"><p>Ingreso: <strong>{dateLabel(selected.check_in_date)}</strong> → <strong>{dateLabel(checkIn)}</strong></p>{!activeSelected && <p className="mt-1">Salida (checkout): <strong>{dateLabel(shiftDate(selected.check_out_date, 1))}</strong> → <strong>{dateLabel(checkOut)}</strong></p>}<p className="mt-1">Empresa: <strong>{selected.empresa ?? 'Particular'}</strong> → <strong>{empresa || 'Particular'}</strong></p><p className="mt-1">Cargo: <strong>{selected.worker_type ?? 'Sin cargo'}</strong> → <strong>{empresa ? workerType : 'Sin cargo'}</strong></p></div><label className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Contraseña actual<div className="relative mt-1"><input autoFocus required type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-800" /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>{message?.type === 'error' && <p className="mt-3 text-sm text-red-600">{message.text}</p>}<div className="mt-5 flex gap-3"><button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold dark:border-zinc-700">Cancelar</button><button disabled={saving || !password} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving && <RefreshCw className="h-4 w-4 animate-spin" />}Confirmar</button></div></form></div>}

      {deleteTarget && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><form onSubmit={removeStay} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"><div className="mb-4 flex items-start justify-between"><div><h3 className="font-bold text-red-600">Eliminar estancia</h3><p className="mt-1 text-sm text-gray-500">Esta acción retirará la estancia de reportes y valorizaciones.</p></div><button type="button" onClick={() => setDeleteTarget(null)}><X className="h-5 w-5 text-gray-400" /></button></div><div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"><p className="font-bold">{deleteTarget.guests.name}</p><p className="mt-1">DNI {deleteTarget.guests.dni} · Hab. {deleteTarget.rooms?.number ?? 'Sin habitación'}</p><p>{dateLabel(deleteTarget.check_in_date)} – {(deleteTarget.status === 'active' || deleteTarget.status === 'baja') ? 'Actualmente' : dateLabel(shiftDate(deleteTarget.check_out_date, 1))}</p></div><label className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Contraseña actual<div className="relative mt-1"><input autoFocus required type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-800" /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>{message?.type === 'error' && <p className="mt-3 text-sm text-red-600">{message.text}</p>}<div className="mt-5 flex gap-3"><button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold dark:border-zinc-700">Cancelar</button><button disabled={saving || !password} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving && <RefreshCw className="h-4 w-4 animate-spin" />}Eliminar</button></div></form></div>}
    </section>
  );
}
