import { CalendarDays, LogOut, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface CheckoutConfirmationModalProps {
  guestName: string;
  roomNumber?: string;
  checkInDate: string;
  totalDays: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function dateLabel(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function CheckoutConfirmationModal({
  guestName,
  roomNumber,
  checkInDate,
  totalDays,
  loading = false,
  onConfirm,
  onCancel,
}: CheckoutConfirmationModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-confirmation-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
      >
        <div className="relative border-b border-gray-100 p-5 text-center dark:border-zinc-800">
          <div className="flex flex-col items-center">
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <LogOut className="h-6 w-6" />
            </div>
            <div className="mt-3">
              <h2 id="checkout-confirmation-title" className="font-bold text-gray-900 dark:text-zinc-100">
                Confirmar salida
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                Revisa los datos antes de finalizar la estancia.
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
          <div className="rounded-xl bg-gray-50 p-4 text-center dark:bg-zinc-800">
            <p className="font-bold text-gray-900 dark:text-zinc-100">{guestName}</p>
            {roomNumber && <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Habitación {roomNumber}</p>}
            <div className="mt-4 flex flex-col items-center border-t border-gray-200 pt-4 dark:border-zinc-700">
              <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="text-sm">
                <p className="text-gray-500 dark:text-zinc-400">Fecha de ingreso</p>
                <p className="font-bold text-gray-900 dark:text-zinc-100">{dateLabel(checkInDate)}</p>
                <p className="mt-2 text-gray-500 dark:text-zinc-400">Tiempo total de estancia</p>
                <p className="font-bold text-blue-700 dark:text-blue-400">
                  {totalDays} {totalDays === 1 ? 'día' : 'días'} ({totalDays} {totalDays === 1 ? 'noche' : 'noches'})
                </p>
              </div>
            </div>
          </div>

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
              disabled={loading}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Procesando…' : 'Confirmar salida'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
