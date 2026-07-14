import { Room, StayWithDetails } from '../lib/supabase';
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
};

export function RoomCard({
  room,
  activeStay,
  onCheckIn,
  onCheckOut,
  onMarkAvailable,
  readOnly = false,
}: RoomCardProps) {
  const isOccupied = room.status === 'occupied';
  const isAvailable = room.status === 'available';
  const isCleaning = room.status === 'cleaning';
  const isMaintenance = room.status === 'maintenance';

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
                    {activeStay.empresa || 'Particular'}
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
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-red-500 text-red-500 rounded-lg font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Salida
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
    </div>
  );
}
