import { Clock3, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface SameDayCheckoutModalProps {
  guestName: string;
  roomNumber?: string;
  loading?: boolean;
  onRegister: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function SameDayCheckoutModal({
  guestName,
  roomNumber,
  loading = false,
  onRegister,
  onDiscard,
  onCancel,
}: SameDayCheckoutModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="same-day-checkout-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
      >
        <div className="relative border-b border-gray-100 p-5 text-center dark:border-zinc-800">
          <div className="flex flex-col items-center">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Clock3 className="h-6 w-6" />
            </div>
            <div className="mt-3">
              <h2 id="same-day-checkout-title" className="font-bold text-gray-900 dark:text-zinc-100">
                Salida el mismo día
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                El huésped se quedó por horas. ¿Deseas registrarlo como una estancia?
              </p>
            </div>
          </div>
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
          <div className="rounded-xl bg-gray-50 p-3 text-center text-sm dark:bg-zinc-800">
            <p className="font-bold text-gray-900 dark:text-zinc-100">{guestName}</p>
            {roomNumber && <p className="mt-1 text-gray-500 dark:text-zinc-400">Habitación {roomNumber}</p>}
          </div>
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-zinc-400">
            Si eliges “No”, la salida se realizará sin guardar la estancia en el historial.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={onRegister}
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Sí, registrar
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={loading}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-900/20"
            >
              No registrar
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
