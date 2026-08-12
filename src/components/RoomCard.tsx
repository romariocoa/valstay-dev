import { useRef, useState } from 'react';
import { Room, StayWithDetails, getClient } from '../lib/supabase';
import {
  LogIn,
  LogOut,
  Building2,
  Wrench,
  Sparkles,
  BedSingle,
  ArrowDownToLine,
  CheckCircle,
  HardHat,
  Briefcase,
  BadgeCheck,
  Clock3,
  Banknote,
  CreditCard,
  WalletCards,
  X,
  Loader2,
  Upload,
  Camera,
  QrCode,
} from 'lucide-react';

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

interface RoomCardProps {
  room: Room;
  activeStay?: StayWithDetails;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onMarkAvailable?: () => void;
  onUpdate?: () => void;
  yapeQrUrl?: string | null;
  plinQrUrl?: string | null;
  readOnly?: boolean;
}

const typeLabels: Record<Room['type'], string> = {
  single: 'INDIVIDUAL',
  double: 'DOBLE',
  suite: 'SUITE',
  family: 'FAMILIAR',
  sala: 'SALA',
  lavanderia: 'LAVANDERÍA',
  almacen: 'ALMACÉN',
  tienda: 'TIENDA',
  departamento: 'DEPARTAMENTO',
};

export function RoomCard({
  room,
  activeStay,
  onCheckIn,
  onCheckOut,
  onMarkAvailable,
  onUpdate,
  yapeQrUrl,
  plinQrUrl,
  readOnly = false,
}: RoomCardProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'yape' | 'plin'>('efectivo');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState('');
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const isOccupied = room.status === 'occupied';
  const isAvailable = room.status === 'available';
  const isCleaning = room.status === 'cleaning';
  const isMaintenance = room.status === 'maintenance';
  const hasPendingPayment = Boolean(
    isOccupied && activeStay && !activeStay.empresa && activeStay.payment_method === null,
  );
  const supportsTransfer = selectedPaymentMethod === 'yape' || selectedPaymentMethod === 'plin';
  const paymentQrUrl = selectedPaymentMethod === 'yape' ? yapeQrUrl : selectedPaymentMethod === 'plin' ? plinQrUrl : null;

  const handlePaymentReceipt = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPaymentError('El comprobante debe ser una imagen.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPaymentError('El comprobante debe pesar menos de 10 MB.');
      return;
    }
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
      setPaymentError(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setPaymentError('No se pudo leer la imagen del comprobante.');
    };
    img.src = objectUrl;
  };

  const confirmPayment = async () => {
    if (!activeStay || savingPayment) return;
    setSavingPayment(true);
    setPaymentError(null);
    const { error } = await getClient()
      .from('stays')
      .update({
        payment_method: selectedPaymentMethod,
        payment_receipt_url: supportsTransfer && paymentReceipt ? paymentReceipt : null,
      })
      .eq('id', activeStay.id);
    setSavingPayment(false);
    if (error) {
      setPaymentError(error.message || 'No se pudo actualizar el pago.');
      return;
    }
    setShowPaymentModal(false);
    setPaymentReceipt('');
    onUpdate?.();
  };

  const isLeavingToday = (() => {
  if (!isOccupied || !activeStay?.check_out_date) return false;

  const todayStr = localDateStr(new Date());
  const todayNoon = new Date(`${todayStr}T12:00:00`);

  const checkOutDate = activeStay.check_out_date.slice(0, 10);
  const departureDay = new Date(`${checkOutDate}T12:00:00`);

  departureDay.setDate(departureDay.getDate() + 1);

  const days = Math.round(
    (departureDay.getTime() - todayNoon.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return days === 0;
})();

  const borderColor = isLeavingToday
    ? 'border-l-blue-400 dark:border-l-blue-400'
    : isOccupied
      ? 'border-l-red-500 dark:border-l-red-500'
      : isAvailable
        ? 'border-l-green-500 dark:border-l-green-500'
        : isCleaning
          ? 'border-l-cyan-400 dark:border-l-cyan-400'
          : 'border-l-amber-400 dark:border-l-amber-400';

  const badgeBg = isLeavingToday
    ? 'bg-blue-500'
    : isOccupied
      ? 'bg-red-500'
      : isAvailable
        ? 'bg-green-500'
        : isCleaning
          ? 'bg-cyan-500'
          : 'bg-amber-400';

  const statusLabel = isLeavingToday
    ? 'Bajan hoy'
    : isOccupied
      ? 'Ocupado'
      : isAvailable
        ? 'Libre'
        : isCleaning
          ? 'En limpieza'
          : 'Mantenimiento';

  const guestNameParts = activeStay?.guests?.name
    ?.trim()
    .split(/\s+/)
    .filter(Boolean) ?? [];

  const guestFirstNames = guestNameParts.slice(0, 2).join(' ');
  const guestLastNames = guestNameParts.slice(2).join(' ');

  const workerTypeInfo = activeStay?.worker_type === 'obrero'
    ? { label: 'Obrero', icon: HardHat }
    : activeStay?.worker_type === 'empleado'
      ? { label: 'Empleado', icon: Briefcase }
      : activeStay?.worker_type === 'staff'
        ? { label: 'Staff', icon: BadgeCheck }
        : null;

  return (
    <div
      className={`
        bg-white dark:bg-zinc-900
        rounded-xl
        border border-gray-100 dark:border-zinc-800
        border-l-4 ${borderColor}
        shadow-sm dark:shadow-none
        flex flex-col
        overflow-hidden
      `}
    >
      {/* Parte superior */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-2">
          <span className="text-4xl font-black text-gray-900 dark:text-white leading-none">
            {room.number}
          </span>

          <div className="flex items-center gap-1.5">
            {hasPendingPayment && (
              <button
                type="button"
                onClick={() => !readOnly && setShowPaymentModal(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                title="Registrar pago pendiente"
                aria-label="Falta pagar"
                disabled={readOnly}
              >
                <Clock3 className="h-4 w-4" />
              </button>
            )}
            <span
              className={`
                ${badgeBg}
                text-white text-xs font-bold
                px-3 py-1
                rounded-full
                whitespace-nowrap
              `}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <p className="w-full text-center text-gray-800 dark:text-zinc-300 font-black text-xs tracking-widest mt-1">
          {typeLabels[room.type]}
        </p>
      </div>

      {/* Información del huésped */}
      <div className="px-4 pb-3 flex-1">
        {isOccupied ? (
          activeStay ? (
            <div
              className={`
                rounded-lg
                px-3 py-2.5
                space-y-1
                border
                ${
                  isLeavingToday
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700'
                }
              `}
            >
              <div className="flex flex-col items-center text-center space-y-1">
                <div className="leading-tight break-words">
                  <p className="font-semibold text-gray-800 dark:text-zinc-100 text-sm">
                    {guestFirstNames}
                  </p>

                  {guestLastNames && (
                    <p className="font-semibold text-gray-800 dark:text-zinc-100 text-sm">
                      {guestLastNames}
                    </p>
                  )}
                </div>

                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  DNI: {activeStay.guests.dni}
                </p>

                <div className="flex items-center justify-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />

                  <span className="text-xs text-blue-700 dark:text-blue-400 font-medium text-center break-words">
                    {activeStay.empresa || 'Huésped directo'}
                  </span>

                  {workerTypeInfo && (() => {
                    const WorkerIcon = workerTypeInfo.icon;
                    return (
                      <span className="group relative ml-2 inline-flex shrink-0 text-slate-500 dark:text-zinc-400" tabIndex={0} aria-label={`Tipo de huésped: ${workerTypeInfo.label}`}>
                        <WorkerIcon className="h-4 w-4" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-white dark:text-slate-900">
                          {workerTypeInfo.label}
                        </span>
                      </span>
                    );
                  })()}
                </div>

                {hasPendingPayment && (
                  <button
                    type="button"
                    onClick={() => !readOnly && setShowPaymentModal(true)}
                    disabled={readOnly}
                    className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-default dark:text-amber-300 dark:hover:bg-amber-900/30"
                  >
                    <Clock3 className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-bold">Falta pagar</span>
                  </button>
                )}

                {isLeavingToday && (
                  <div className="flex items-center justify-center gap-1.5 pt-0.5">
                    <ArrowDownToLine className="w-3.5 h-3.5 text-blue-500 shrink-0" />

                    <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      Bajan hoy
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
  <div className="flex flex-col items-center justify-center py-2">
    <p className="text-gray-400 dark:text-zinc-500 text-sm text-center font-medium">
      Actualizando habitación...
    </p>
  </div>
)
        ) : isAvailable ? (
          <div className="flex flex-col items-center justify-center py-0.5 sm:py-1">
            <p className="text-green-600 dark:text-green-400 text-sm font-semibold">
              Disponible
            </p>

            <BedSingle className="w-9 h-9 sm:w-11 sm:h-11 mt-0.5 text-green-500 opacity-90" />
          </div>
        ) : isCleaning ? (
          <div className="flex flex-col items-center justify-center py-0.5 sm:py-1">
            <p className="text-cyan-600 dark:text-cyan-400 text-sm font-semibold">
              En limpieza
            </p>

            <Sparkles className="w-9 h-9 sm:w-11 sm:h-11 mt-0.5 text-cyan-500 opacity-90" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-0.5 sm:py-1">
            <p className="text-amber-500 dark:text-amber-400 text-sm font-semibold">
              En mantenimiento
            </p>

            <Wrench className="w-9 h-9 sm:w-11 sm:h-11 mt-0.5 text-amber-400 opacity-90" />
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="px-4 pb-4">
        {readOnly && !isAvailable && (
          <div className="w-full rounded-lg border border-dashed border-gray-300 py-2.5 text-center text-sm font-semibold text-gray-400 dark:border-zinc-700 dark:text-zinc-500">
            Vista de demostración
          </div>
        )}
        {readOnly && isAvailable && (
          <button type="button" onClick={onCheckIn} className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-green-500 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 active:bg-green-800 transition-colors">
            <LogIn className="w-4 h-4" /> Probar ingreso
          </button>
        )}
        {!readOnly && isOccupied && (
          <button
            type="button"
            onClick={onCheckOut}
            disabled={hasPendingPayment}
            title={hasPendingPayment ? 'Completa el pago antes de registrar la salida' : 'Registrar salida'}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-red-500 text-red-500 rounded-lg font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition-colors disabled:cursor-not-allowed disabled:border-amber-300 disabled:bg-amber-50 disabled:text-amber-600 dark:disabled:border-amber-800 dark:disabled:bg-amber-950/20 dark:disabled:text-amber-400"
          >
            {hasPendingPayment ? <Clock3 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
            {hasPendingPayment ? 'Pago pendiente' : 'Salida'}
          </button>
        )}

        {!readOnly && isAvailable && (
          <button
            type="button"
            onClick={onCheckIn}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Ingreso
          </button>
        )}

        {!readOnly && isCleaning && (
          <button
            type="button"
            onClick={onMarkAvailable}
            disabled={!onMarkAvailable}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-400 text-cyan-700 dark:text-cyan-400 rounded-lg font-semibold text-sm hover:bg-cyan-100 dark:hover:bg-cyan-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Marcar disponible
          </button>
        )}

        {!readOnly && isMaintenance && (
          <div className="w-full py-2.5 text-center text-gray-300 dark:text-zinc-600 text-sm border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg">
            No disponible
          </div>
        )}
      </div>

      {showPaymentModal && activeStay && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !savingPayment && setShowPaymentModal(false)}>
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-zinc-100">Registrar pago</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{activeStay.guests.name} · Hab. {room.number}</p>
              </div>
              <button type="button" onClick={() => setShowPaymentModal(false)} disabled={savingPayment} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-zinc-300">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'efectivo' as const, label: 'Efectivo', icon: Banknote },
                { value: 'tarjeta' as const, label: 'Tarjeta', icon: CreditCard },
                { value: 'yape' as const, label: 'Yape', icon: WalletCards },
                { value: 'plin' as const, label: 'Plin', icon: WalletCards },
              ]).map(option => {
                const PaymentIcon = option.icon;
                const selected = selectedPaymentMethod === option.value;
                return (
                  <button key={option.value} type="button" onClick={() => { setSelectedPaymentMethod(option.value); setPaymentReceipt(''); setPaymentError(null); }} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
                    <PaymentIcon className="h-4 w-4" />{option.label}
                  </button>
                );
              })}
            </div>

            {supportsTransfer && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                  {paymentQrUrl ? (
                    <img src={paymentQrUrl} alt={`QR de ${selectedPaymentMethod}`} className="mx-auto h-48 w-48 rounded-lg object-contain" />
                  ) : (
                    <div className="py-5 text-sm text-amber-600 dark:text-amber-400">
                      <QrCode className="mx-auto mb-2 h-9 w-9" />
                      El hotel aún no configuró el QR de {selectedPaymentMethod === 'yape' ? 'Yape' : 'Plin'}.
                    </div>
                  )}
                </div>
                <input ref={receiptFileRef} type="file" accept="image/*" className="hidden" onChange={event => { handlePaymentReceipt(event.target.files?.[0]); event.target.value = ''; }} />
                <input ref={receiptCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { handlePaymentReceipt(event.target.files?.[0]); event.target.value = ''; }} />
                <p className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Comprobante de transferencia (opcional)</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => receiptFileRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-400 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400"><Upload className="h-4 w-4" />Subir foto</button>
                  <button type="button" onClick={() => receiptCameraRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-400 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400"><Camera className="h-4 w-4" />Tomar foto</button>
                </div>
                {paymentReceipt && (
                  <div className="relative mx-auto w-fit">
                    <img src={paymentReceipt} alt="Comprobante" className="max-h-40 rounded-xl border border-gray-200 object-contain dark:border-zinc-700" />
                    <button type="button" onClick={() => setPaymentReceipt('')} className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white"><X className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            )}

            {paymentError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{paymentError}</p>}

            <button type="button" onClick={() => void confirmPayment()} disabled={savingPayment} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              {savingPayment ? 'Guardando...' : 'Confirmar pago'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
