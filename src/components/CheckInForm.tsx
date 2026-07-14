import { useState, useEffect, useRef } from 'react';
import { getClient, Room } from '../lib/supabase';
import { useGuestByDni, useCompanies, useHotelConfig } from '../hooks/useData';
import {
  User, CreditCard, Phone, MapPin, Bed, Save, X, Loader2,
  Building2, Plus, CheckCircle, Hash, Trash2, Minus, Banknote, QrCode, Upload, Camera, WalletCards,
} from 'lucide-react';

interface CheckInFormProps {
  tenantId: string;
  rooms: Room[];
  preselectedRoom?: Room | null;
  onSuccess: () => void;
  onCancel: () => void;
  isAdmin?: boolean;
  readOnly?: boolean;
  defaultCompany?: string;
}

const typeLabels: Record<Room['type'], string> = {
  single:     'Individual',
  double:     'Doble',
  suite:      'Suite',
  family:     'Familiar',
  sala:       'Sala',
  lavanderia: 'Lavandería',
  almacen:    'Almacén',
  tienda:     'Tienda',
};

function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function diffDays(from: string, to: string): number {
  return Math.max(0, Math.ceil(
    (new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) / 86400000
  ));
}

function Input({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
      <input
        {...props}
        className="w-full pl-10 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-sm placeholder-gray-400 dark:placeholder-zinc-500"
      />
    </div>
  );
}

export function CheckInForm({ tenantId, rooms, preselectedRoom, onSuccess, onCancel, isAdmin = false, readOnly = false, defaultCompany = '' }: CheckInFormProps) {
  const today = localDateStr();

  const [dni, setDni]                         = useState('');
  const [name, setName]                       = useState('');
  const [phone, setPhone]                     = useState('');
  const [address, setAddress]                 = useState('');
  const [empresa, setEmpresa]                 = useState(defaultCompany);
  const [workerType, setWorkerType] = useState<'obrero' | 'empleado' | 'staff' | ''>('');
  const [newEmpresaName, setNewEmpresaName]   = useState('');
  const [showNewEmpresa, setShowNewEmpresa]   = useState(false);
  const [addingEmpresa, setAddingEmpresa]     = useState(false);
  const [empresaError, setEmpresaError]       = useState<string | null>(null);
  const [roomId, setRoomId]                   = useState(preselectedRoom?.id || '');
  const [checkInDate, setCheckInDate]         = useState(today);
  const [checkOutDate, setCheckOutDate]       = useState('');
  const [empresaDays, setEmpresaDays]         = useState(14);
  const [customPrice, setCustomPrice]         = useState<string>('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'yape' | 'plin'>('efectivo');
  const [paymentReceipt, setPaymentReceipt] = useState('');
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  const { guest: existingGuest, loading: searchingDni } = useGuestByDni(dni, tenantId);
  const [showManageCompanies, setShowManageCompanies] = useState(false);
  const { companies, addCompany, deleteCompany } = useCompanies(tenantId);
  const { config: hotelConfig } = useHotelConfig(tenantId);

  // '' = sin seleccionar (bloquea campos), '__particular__' = Particular, 'Nombre' = empresa
  const empresaSelected = empresa !== '';
  const hasEmpresa = empresa !== '' && empresa !== '__particular__';
  const fieldDisabled = !empresaSelected;

  const selectedRoom = preselectedRoom ?? rooms.find(r => r.id === roomId);
  const SPACE_TYPES = new Set<Room['type']>(['sala', 'tienda', 'lavanderia', 'almacen']);
  const availableRooms = rooms.filter(r => r.status === 'available' && !SPACE_TYPES.has(r.type));

  useEffect(() => {
    if (existingGuest) {
      setName(existingGuest.name);
      setPhone(existingGuest.phone || '');
      setAddress(existingGuest.address || '');
    } else if (dni.length >= 3) {
      setName('');
      setPhone('');
      setAddress('');
    }
  }, [existingGuest, dni]);

  useEffect(() => {
  if (hasEmpresa) {
    setWorkerType('obrero');
    setAddress('');

    const days = 14;
    setEmpresaDays(days);

    if (checkInDate) {
      setCheckOutDate(addDays(checkInDate, days));
    }
  } else {
    const days = 1;
    setEmpresaDays(days);

    if (checkInDate) {
      setCheckOutDate(addDays(checkInDate, days));
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [hasEmpresa]);

  useEffect(() => {
    if (selectedRoom) {
      setCustomPrice(String(selectedRoom.price_per_night));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id]);

  const handleCheckInChange = (val: string) => {
    setCheckInDate(val);
    // checkOutDate is departure day; nights = empresaDays
    if (val) setCheckOutDate(addDays(val, empresaDays));
  };

  const handleCheckOutChange = (val: string) => {
    setCheckOutDate(val);
    // nights = departure - checkin (no +1; departure is not a night slept)
    if (val && checkInDate) {
      setEmpresaDays(Math.max(1, diffDays(checkInDate, val)));
    }
  };

  const handleDaysChange = (val: string) => {
    const n = Math.max(1, parseInt(val) || 1);
    setEmpresaDays(n);
    if (checkInDate) setCheckOutDate(addDays(checkInDate, n));
  };

  const formatCheckoutLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleAddEmpresa = async () => {
    if (readOnly) return;
    if (!newEmpresaName.trim()) return;
    setAddingEmpresa(true);
    setEmpresaError(null);
    const created = await addCompany(newEmpresaName.trim());
    setAddingEmpresa(false);
    if (created) {
      setEmpresa(created.name);
      setNewEmpresaName('');
      setShowNewEmpresa(false);
    } else {
      setEmpresaError('No se pudo guardar la empresa. Intenta de nuevo.');
    }
  };

  const nights = checkInDate && checkOutDate ? diffDays(checkInDate, checkOutDate) : 0;

  const effectivePrice = (() => {
    if (!hasEmpresa) {
      const n = parseFloat(customPrice);
      return isNaN(n) || n < 0 ? 0 : n;
    }
    return selectedRoom?.price_per_night ?? 0;
  })();

  const totalAmount = selectedRoom && nights > 0 ? effectivePrice * nights : null;

  const qrUrl = paymentMethod === 'yape' ? hotelConfig.yape_qr_url : paymentMethod === 'plin' ? hotelConfig.plin_qr_url : null;
  const supportsReceipt = paymentMethod === 'yape' || paymentMethod === 'plin';

  const handleReceipt = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('El comprobante debe ser una imagen.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('El comprobante debe pesar menos de 10 MB.'); return; }
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const max = 1200;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPaymentReceipt(canvas.toDataURL('image/jpeg', 0.82));
      setError(null);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); setError('No se pudo leer la imagen del comprobante.'); };
    img.src = objectUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (readOnly) {
      setError('Esta es una simulación. Puedes completar el formulario, pero los datos no se guardarán.');
      return;
    }

    if (!empresaSelected) {
      setError('Selecciona "Particular" o una empresa para continuar.');
      return;
    if (hasEmpresa && !workerType) {

      setError('Selecciona si el huésped es Obrero, Empleado o Staff.');

  return;

}
    }
    if (!dni || !name || !roomId || !checkInDate || !checkOutDate) {
      setError('Por favor complete todos los campos obligatorios');
      return;
    }
    if (checkOutDate <= checkInDate) {
      setError('La fecha de salida debe ser posterior a la de entrada (minimo 1 noche)');
      return;
    }
    if (submitting.current) return;
    submitting.current = true;

    try {
      setLoading(true);

      const { data: existingStays } = await getClient()
        .from('stays')
        .select('id')
        .eq('room_id', roomId)
        .in('status', ['active', 'baja'])
        .limit(1);

      if (existingStays && existingStays.length > 0) {
        setError('Esta habitacion ya tiene una estancia activa. Verifique el estado de la habitacion.');
        return;
      }

      const { data: savedGuest, error: guestLookupError } = await getClient()
        .from('guests')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('dni', dni)
        .maybeSingle();

      if (guestLookupError) throw guestLookupError;

      let guestId: string;
      if (savedGuest) {
        guestId = savedGuest.id;
        const { error: guestUpdateError } = await getClient()
          .from('guests')
          .update({ name, phone: phone || null, address: hasEmpresa ? null : (address || null) })
          .eq('id', savedGuest.id);
        if (guestUpdateError) throw guestUpdateError;
      } else {
        const { data: newGuest, error: guestError } = await getClient()
          .from('guests')
          .insert({ dni, name, phone: phone || null, address: hasEmpresa ? null : (address || null), tenant_id: tenantId })
          .select()
          .single();
        if (guestError) throw guestError;
        guestId = newGuest.id;
      }

      if (!hasEmpresa && selectedRoom && effectivePrice !== selectedRoom.price_per_night) {
        await getClient().from('rooms').update({ price_per_night: effectivePrice }).eq('id', roomId);
      }

      const { error: stayError } = await getClient().from('stays').insert({
        guest_id: guestId,
        room_id: roomId,
        check_in_date: checkInDate,
        check_out_date: addDays(checkOutDate, -1), // store last night (departure - 1)
        status: 'active',
        total_amount: totalAmount,
        empresa: hasEmpresa ? empresa : null,
        worker_type: hasEmpresa ? workerType : null,
        payment_method: hasEmpresa ? null : paymentMethod,
        payment_receipt_url: !hasEmpresa && supportsReceipt && paymentReceipt ? paymentReceipt : null,
        tenant_id: tenantId,
      });
      if (stayError) throw stayError;

      await getClient().from('rooms').update({ status: 'occupied' }).eq('id', roomId);
      onSuccess();
    } catch (err) {
      const supabaseError = err as { message?: string; details?: string; hint?: string; code?: string };
      const message = supabaseError?.message || (err instanceof Error ? err.message : 'Error al registrar');
      const extra = [supabaseError?.details, supabaseError?.hint, supabaseError?.code]
        .filter(Boolean)
        .join(' · ');
      setError(extra ? `${message} (${extra})` : message);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const inputBase = 'w-full py-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-sm';
  const labelBase = 'block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Registrar Huesped</h2>
            {preselectedRoom && (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-0.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Habitacion {preselectedRoom.number} — {typeLabels[preselectedRoom.type]}
              </p>
            )}
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {readOnly && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">
              Formulario de demostración: explora todos los campos. Ningún dato será guardado.
            </div>
          )}

          {/* Empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">Empresa</label>
            {!showNewEmpresa ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
                  <select
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className={`${inputBase} pl-10 appearance-none ${!empresaSelected ? 'text-gray-400 dark:text-zinc-500' : ''}`}
                  >
                    <option value="" disabled>-- Selecciona tipo --</option>
                    <option value="__particular__">Particular</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.name} className="text-gray-900 dark:text-zinc-100">{c.name}</option>
                    ))}
                  </select>
                </div>
                {!readOnly && <button
                  type="button"
                  onClick={() => { setShowNewEmpresa(true); setEmpresaError(null); }}
                  className="px-3 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center gap-1 text-sm font-medium shrink-0 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nueva
                </button>}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newEmpresaName}
                    onChange={(e) => setNewEmpresaName(e.target.value)}
                    placeholder="Nombre de la empresa"
                    className={`flex-1 px-3 ${inputBase}`}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmpresa(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddEmpresa}
                    disabled={!newEmpresaName.trim() || addingEmpresa}
                    className="px-4 py-2.5 bg-gray-900 dark:bg-zinc-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-600 font-medium disabled:opacity-50 flex items-center gap-2 transition-colors text-sm"
                  >
                    {addingEmpresa ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewEmpresa(false); setNewEmpresaName(''); setEmpresaError(null); }}
                    className="px-3 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {empresaError && <p className="text-xs text-red-600 dark:text-red-400">{empresaError}</p>}
              </div>
            )}

            {/* Admin: manage (delete) companies */}
            {isAdmin && !readOnly && companies.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowManageCompanies(p => !p)}
                  className="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors underline underline-offset-2"
                >
                  {showManageCompanies ? 'Ocultar' : 'Gestionar empresas'}
                </button>
                {showManageCompanies && (
                  <div className="mt-2 rounded-xl border border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 divide-y divide-gray-100 dark:divide-zinc-700">
                    {companies.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-gray-700 dark:text-zinc-300 truncate">{c.name}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Eliminar empresa "${c.name}"?`)) return;
                            if (empresa === c.name) setEmpresa('');
                            await deleteCompany(c.id);
                          }}
                          className="ml-3 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                          title="Eliminar empresa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Guest data */}
          {hasEmpresa && (
  <div>
    <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-2">
      Cargo del huésped *
    </label>

    <div className="grid grid-cols-3 gap-2">
      {[
        { value: 'obrero', label: 'Obrero' },
        { value: 'empleado', label: 'Empleado' },
        { value: 'staff', label: 'Staff' },
      ].map((option) => {
        const selected = workerType === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              setWorkerType(option.value as 'obrero' | 'empleado' | 'staff')
            }
            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
              selected
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-green-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  </div>
)}
          <div className={`bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-4 space-y-3 transition-opacity ${fieldDisabled ? 'opacity-40 pointer-events-none select-none' : ''}`}>
            <h3 className="font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              Datos del Huesped
              {fieldDisabled && <span className="ml-auto text-xs font-normal text-gray-400 dark:text-zinc-500">Selecciona tipo primero</span>}
            </h3>

            <div>
              <label className={labelBase}>DNI *</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className={`${inputBase} pl-10 pr-10`}
                  placeholder="Ingrese DNI"
                  disabled={fieldDisabled}
                />
                {searchingDni && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 animate-spin" />
                )}
              </div>
              {existingGuest && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Huesped encontrado — datos cargados
                </p>
              )}
            </div>

            <div>
              <label className={labelBase}>Nombre completo *</label>
              <Input icon={User} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del huesped" />
            </div>

            {!hasEmpresa && (
              <div>
                <label className={labelBase}>Procedencia</label>
                <Input icon={MapPin} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ciudad / localidad de origen" />
              </div>
            )}

            <div>
              <label className={labelBase}>Telefono</label>
              <Input icon={Phone} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono" />
            </div>
          </div>

          {/* Stay data */}
          <div className={`bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-4 space-y-3 transition-opacity ${fieldDisabled ? 'opacity-40 pointer-events-none select-none' : ''}`}>
            <h3 className="font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
              <Bed className="w-4 h-4" />
              Datos de la Estancia
            </h3>

            {!preselectedRoom && (
              <div>
                <label className={labelBase}>Habitacion *</label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={`${inputBase} px-3`}
                >
                  <option value="">Seleccione habitacion</option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Hab. {room.number} — {typeLabels[room.type]} (S/ {room.price_per_night}/noche)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!hasEmpresa && selectedRoom && (
              <div>
                <label className={`${labelBase}`}>
                  Tarifa por noche (S/) *
                  <span className="ml-1 text-gray-400 dark:text-zinc-500 font-normal">
                    — precio base: S/ {selectedRoom.price_per_night}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-zinc-500 pointer-events-none select-none">S/</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="w-full pl-9 py-2.5 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 dark:bg-blue-900/20 text-sm font-semibold text-blue-900 dark:text-blue-300"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelBase}>Fecha entrada *</label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => handleCheckInChange(e.target.value)}
                  className={`${inputBase} px-3`}
                />
              </div>

              <div>
                <label className={`${labelBase} flex items-center gap-1`}>
                  <Hash className="w-3 h-3" />
                  {hasEmpresa ? 'Días' : 'Noches'}
                </label>
                <div className={`flex items-center border rounded-lg overflow-hidden ${
                  hasEmpresa
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                }`}>
                  <button
                    type="button"
                    onClick={() => handleDaysChange(String(Math.max(1, empresaDays - 1)))}
                    className={`px-2.5 py-2.5 flex items-center justify-center transition-colors shrink-0 ${
                      hasEmpresa
                        ? 'text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40'
                        : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700'
                    }`}
                    disabled={empresaDays <= 1}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={empresaDays}
                    onChange={(e) => handleDaysChange(e.target.value)}
                    className={`flex-1 py-2.5 text-sm font-semibold text-center bg-transparent border-0 focus:ring-0 focus:outline-none min-w-0 ${
                      hasEmpresa
                        ? 'text-amber-900 dark:text-amber-300'
                        : 'text-gray-900 dark:text-zinc-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleDaysChange(String(empresaDays + 1))}
                    className={`px-2.5 py-2.5 flex items-center justify-center transition-colors shrink-0 ${
                      hasEmpresa
                        ? 'text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40'
                        : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className={labelBase}>Fecha salida *</label>
                <input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate ? addDays(checkInDate, 1) : addDays(today, 1)}
                  onChange={(e) => handleCheckOutChange(e.target.value)}
                  className={`${inputBase} px-3 ${
                    hasEmpresa
                      ? 'border-amber-300 dark:border-amber-700 focus:ring-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300 font-semibold'
                      : ''
                  }`}
                />
                {checkOutDate && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                    {formatCheckoutLabel(checkOutDate)}
                  </p>
                )}
              </div>
            </div>

            {selectedRoom && nights > 0 && effectivePrice > 0 && !hasEmpresa && empresaSelected && (
              <div className="bg-white dark:bg-zinc-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-zinc-700 flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-zinc-400">
                  {nights} {nights === 1 ? 'noche' : 'noches'} × S/ {effectivePrice.toFixed(2)}/noche
                </span>
                <span className="font-black text-lg text-gray-900 dark:text-zinc-100">S/ {totalAmount!.toFixed(2)}</span>
              </div>
            )}
          </div>

          {!hasEmpresa && empresaSelected && (
            <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
                <Banknote className="w-4 h-4" /> Tipo de pago
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { method: 'efectivo' as const, label: 'Efectivo', icon: Banknote, active: 'border-emerald-600 bg-emerald-600 text-white', logo: 'text-emerald-600 bg-emerald-100' },
                  { method: 'tarjeta' as const, label: 'Tarjeta', icon: WalletCards, active: 'border-blue-600 bg-blue-600 text-white', logo: 'text-blue-600 bg-blue-100' },
                  { method: 'yape' as const, label: 'Yape', icon: null, active: 'border-purple-600 bg-purple-600 text-white', logo: 'text-purple-700 bg-purple-100' },
                  { method: 'plin' as const, label: 'Plin', icon: null, active: 'border-cyan-500 bg-cyan-500 text-white', logo: 'text-cyan-700 bg-cyan-100' },
                ]).map(option => {
                  const selected = paymentMethod === option.method;
                  const Icon = option.icon;
                  return <button key={option.method} type="button" onClick={() => { setPaymentMethod(option.method); setPaymentReceipt(''); }}
                    className={`rounded-xl border px-2 py-3 text-sm font-semibold transition-all flex flex-col items-center gap-2 ${selected ? `${option.active} shadow-md scale-[1.02]` : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:-translate-y-0.5 hover:shadow-sm'}`}>
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs ${selected ? 'bg-white/20 text-white' : option.logo}`}>
                      {Icon ? <Icon className="w-5 h-5" /> : option.label.toUpperCase().slice(0, 2)}
                    </span>
                    {option.label}
                  </button>;
                })}
              </div>
              {supportsReceipt && (
                <div className="space-y-3">
                  <div className="text-center rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
                    {qrUrl ? <img src={qrUrl} alt={`QR de ${paymentMethod}`} className="mx-auto w-52 h-52 object-contain rounded-lg" /> : (
                      <div className="py-6 text-sm text-amber-600 dark:text-amber-400"><QrCode className="w-10 h-10 mx-auto mb-2" />El hotel aún no configuró el QR de {paymentMethod === 'yape' ? 'Yape' : 'Plin'}.</div>
                    )}
                  </div>
                  <input ref={receiptFileRef} type="file" accept="image/*" className="hidden" onChange={e => { handleReceipt(e.target.files?.[0]); e.target.value = ''; }} />
                  <input ref={receiptCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { handleReceipt(e.target.files?.[0]); e.target.value = ''; }} />
                  <p className="text-xs font-medium text-gray-600 dark:text-zinc-300">Comprobante de transferencia (opcional)</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => receiptFileRef.current?.click()} className="flex-1 flex justify-center items-center gap-2 py-2.5 border border-dashed border-blue-400 rounded-xl text-sm text-blue-600 dark:text-blue-400"><Upload className="w-4 h-4" />Subir foto</button>
                    <button type="button" onClick={() => receiptCameraRef.current?.click()} className="flex-1 flex justify-center items-center gap-2 py-2.5 border border-dashed border-blue-400 rounded-xl text-sm text-blue-600 dark:text-blue-400"><Camera className="w-4 h-4" />Tomar foto</button>
                  </div>
                  {paymentReceipt && <div className="relative w-fit mx-auto"><img src={paymentReceipt} alt="Comprobante" className="max-h-48 rounded-xl border border-gray-200 dark:border-zinc-700" /><button type="button" onClick={() => setPaymentReceipt('')} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full"><X className="w-3 h-3" /></button></div>}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
  loading ||
  !empresaSelected ||
  !roomId ||
  !dni ||
  !name ||
  !checkInDate ||
  !checkOutDate ||
  (hasEmpresa && !workerType)
}
              className="flex-1 py-3 bg-gray-900 dark:bg-zinc-700 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-600 transition-colors font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : <><Save className="w-4 h-4" /> {readOnly ? 'Probar registro' : 'Registrar Huesped'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
