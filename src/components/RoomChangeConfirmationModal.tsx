import { ArrowRight, BedDouble, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface RoomChangeConfirmationModalProps {
  guestName: string;
  currentRoom: string;
  availableRooms: { id: string; number: string; floor: number }[];
  selectedRoomId: string;
  loadingRooms?: boolean;
  loading?: boolean;
  onRoomChange: (roomId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RoomChangeConfirmationModal({
  guestName,
  currentRoom,
  availableRooms,
  selectedRoomId,
  loadingRooms = false,
  loading = false,
  onRoomChange,
  onConfirm,
  onCancel,
}: RoomChangeConfirmationModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-change-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-center shadow-2xl dark:bg-zinc-900"
      >
        <div className="relative border-b border-gray-100 p-5 dark:border-zinc-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
            <BedDouble className="h-6 w-6" />
          </div>
          <h2 id="room-change-title" className="mt-3 font-bold text-gray-900 dark:text-zinc-100">
            Cambiar de habitación
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Confirma la nueva habitación asignada al huésped.
          </p>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="font-bold text-gray-900 dark:text-zinc-100">{guestName}</p>

          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-zinc-800">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-zinc-400">Habitación actual</p>
              <p className="mt-1 text-xl font-black text-gray-900 dark:text-zinc-100">{currentRoom}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-zinc-400">Nueva habitación</p>
              {loadingRooms ? (
                <p className="mt-2 text-sm font-bold text-violet-700 dark:text-violet-400">Cargando…</p>
              ) : availableRooms.length === 0 ? (
                <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">No hay disponibles</p>
              ) : (
                <select
                  autoFocus
                  value={selectedRoomId}
                  onChange={event => onRoomChange(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-violet-300 bg-white px-2 py-2 text-sm font-bold text-violet-700 outline-none focus:ring-2 focus:ring-violet-400 dark:border-violet-700 dark:bg-zinc-900 dark:text-violet-400"
                >
                  <option value="">Seleccionar</option>
                  {availableRooms.map(room => (
                    <option key={room.id} value={room.id}>
                      Hab. {room.number} · Piso {room.floor}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">
            La habitación actual quedará disponible y la nueva aparecerá como ocupada.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || loadingRooms || !selectedRoomId}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Cambiando…' : 'Confirmar cambio'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
