import { useState } from 'react';
import { getClient, StayWithDetails } from '../lib/supabase';
import { Calendar, Bed, LogOut, Clock, AlertTriangle, Loader2, Building2, Edit2, CalendarClock, Check, ArrowLeftRight, Phone } from 'lucide-react';
import { GuestEditModal } from './GuestEditModal';
import { AppUser, canEditGuests, canChangeRoom } from '../lib/auth';

interface StayCardProps {
  stay: StayWithDetails;
  onUpdate: () => void;
  currentUser: AppUser;
}

function localDateStr(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

// For particular stays, check_out_date is stored as last night (departure - 1).
// We add 1 day to get the actual departure date for display and comparisons.
function effectiveDepartureDateStr(stay: { check_out_date: string; empresa: string | null }): string {
  if (stay.empresa) return stay.check_out_date;
  const d = new Date(stay.check_out_date + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Los celulares peruanos suelen guardarse localmente con 9 dígitos.
  return digits.length === 9 && digits.startsWith('9') ? `51${digits}` : digits;
}

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.04 3C8.86 3 3.02 8.82 3.02 15.98c0 2.29.6 4.52 1.73 6.48L2.91 29l6.7-1.76a13.02 13.02 0 0 0 6.42 1.64h.01c7.17 0 13.02-5.83 13.02-12.99C29.06 8.82 23.22 3 16.04 3Zm0 23.69h-.01a10.8 10.8 0 0 1-5.5-1.5l-.39-.23-3.98 1.04 1.06-3.87-.25-.4a10.75 10.75 0 0 1-1.66-5.75c0-5.96 4.82-10.8 10.75-10.8 5.93 0 10.75 4.84 10.75 10.8 0 5.94-4.82 10.78-10.77 10.78v-.07Zm5.9-8.08c-.32-.16-1.91-.94-2.2-1.05-.3-.11-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.36-.5-2.59-1.6a9.7 9.7 0 0 1-1.79-2.23c-.19-.32-.02-.49.14-.65.15-.14.32-.38.49-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.55-.73-.56h-.62c-.22 0-.57.08-.86.4-.3.32-1.13 1.1-1.13 2.69s1.16 3.12 1.32 3.34c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.24 1.48.21 2.03.13.62-.09 1.91-.78 2.18-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37Z" />
    </svg>
  );
}

export function StayCard({ stay, onUpdate, currentUser }: StayCardProps) {
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEditDate, setShowEditDate] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editDateLoading, setEditDateLoading] = useState(false);
  const [showChangeRoom, setShowChangeRoom] = useState(false);
  const [newRoomId, setNewRoomId] = useState('');
  const [changeRoomLoading, setChangeRoomLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<{ id: string; number: string; type: string; floor: number }[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Use local date noon-to-noon to avoid UTC/timezone drift
  const todayStr = localDateStr(new Date());
  const todayNoon = new Date(todayStr + 'T12:00:00');
  // For particulares, departure = check_out_date + 1 (stored as last night)
  const departureDateStr = effectiveDepartureDateStr(stay);
  const departureDay = new Date(departureDateStr + 'T12:00:00');
  const daysRemaining = Math.round((departureDay.getTime() - todayNoon.getTime()) / (1000 * 60 * 60 * 24));

  // Separate states: departing today vs overdue vs active
  const isTodayDeparture = daysRemaining === 0;
  const isOverdue = daysRemaining < 0;
  const needsAction = isTodayDeparture || isOverdue;

  const borderColor = isOverdue
    ? 'border-l-red-500'
    : isTodayDeparture
    ? 'border-l-blue-500'
    : 'border-l-green-500';

  const dotColor = isOverdue ? 'bg-red-500' : isTodayDeparture ? 'bg-blue-500' : 'bg-green-500';

  const badgeClass = isOverdue
    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
    : isTodayDeparture
    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
    : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';

  const badgeLabel = isOverdue ? 'Pendiente' : isTodayDeparture ? 'Sale hoy' : 'Activo';

  const handleCheckOut = async () => {
    try {
      setLoading(true);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const lastNightStr = localDateStr(yesterday);

      const isSameDay = lastNightStr < stay.check_in_date;

      if (isSameDay) {
        if (!confirm(
          'Confirmar salida del huesped?\n\n' +
          'Esta salida no se registrará en el historial. ¿Deseas continuar?'
        )) return;
        await getClient().from('stays').delete().eq('id', stay.id);
        await getClient().from('rooms').update({ status: 'available' }).eq('id', stay.room_id);
        onUpdate();
        return;
      }

      if (!confirm('Confirmar salida del huesped?')) return;

      const updates: Record<string, unknown> = { status: 'completed' };

      if (lastNightStr !== stay.check_out_date) {
        updates.check_out_date = lastNightStr;

        if (lastNightStr < stay.check_out_date && stay.total_amount != null) {
          const actualNights = Math.round(
            (new Date(lastNightStr + 'T12:00:00').getTime() -
             new Date(stay.check_in_date + 'T12:00:00').getTime()) /
            (1000 * 60 * 60 * 24)
          ) + 1;

          const scheduledNights = Math.round(
            (new Date(stay.check_out_date + 'T12:00:00').getTime() -
             new Date(stay.check_in_date + 'T12:00:00').getTime()) /
            (1000 * 60 * 60 * 24)
          ) + 1;

          if (scheduledNights > 0) {
            const ratePerNight = stay.total_amount / scheduledNights;
            updates.total_amount = actualNights > 0
              ? Math.round(actualNights * ratePerNight * 100) / 100
              : 0;
          }
        }
      }

      await getClient().from('stays').update(updates).eq('id', stay.id);
      await getClient().from('rooms').update({ status: 'cleaning' }).eq('id', stay.room_id);
      onUpdate();
    } catch (err) {
      console.error('Error checking out:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDate = async () => {
    if (!editDate || editDate === stay.check_out_date) return;
    setEditDateLoading(true);
    try {
      const updates: Record<string, unknown> = { check_out_date: editDate };
      if (stay.total_amount != null) {
        const oldNights = Math.round(
          (new Date(stay.check_out_date + 'T12:00:00').getTime() -
           new Date(stay.check_in_date + 'T12:00:00').getTime()) / 86400000
        ) + 1;
        const newNights = Math.round(
          (new Date(editDate + 'T12:00:00').getTime() -
           new Date(stay.check_in_date + 'T12:00:00').getTime()) / 86400000
        ) + 1;
        if (oldNights > 0) {
          updates.total_amount = Math.round((stay.total_amount / oldNights) * newNights * 100) / 100;
        }
      }
      await getClient().from('stays').update(updates).eq('id', stay.id);
      setShowEditDate(false);
      setEditDate('');
      onUpdate();
    } catch (err) {
      console.error('Error editando fecha:', err);
    } finally {
      setEditDateLoading(false);
    }
  };

  const SPACE_TYPES = ['sala', 'tienda', 'lavanderia', 'almacen'];

  const handleOpenChangeRoom = async () => {
    setLoadingRooms(true);
    setNewRoomId('');
    const { data } = await getClient()
      .from('rooms')
      .select('id, number, type, floor')
      .eq('status', 'available');
    setAvailableRooms((data ?? []).filter((r: { type: string }) => !SPACE_TYPES.includes(r.type)));
    setLoadingRooms(false);
    setShowChangeRoom(true);
  };

  const handleChangeRoom = async () => {
    if (!newRoomId) return;
    const newRoom = availableRooms.find(r => r.id === newRoomId);
    if (!newRoom) return;
    if (!confirm(
      `¿Seguro que deseas cambiar al huésped de la habitación ${stay.rooms?.number ?? '?'} a la habitación ${newRoom.number}?`
    )) return;
    setChangeRoomLoading(true);
    try {
      await getClient().from('stays').update({ room_id: newRoomId }).eq('id', stay.id);
      await getClient().from('rooms').update({ status: 'available' }).eq('id', stay.room_id);
      await getClient().from('rooms').update({ status: 'occupied' }).eq('id', newRoomId);
      setShowChangeRoom(false);
      setNewRoomId('');
      onUpdate();
    } catch (err) {
      console.error('Error cambiando habitacion:', err);
    } finally {
      setChangeRoomLoading(false);
    }
  };

  return (
    <>
      <div className={`bg-white dark:bg-zinc-900 rounded-xl border-2 border-l-4 border-gray-100 dark:border-zinc-800 ${borderColor} p-4 w-full min-w-0`}>
        {/* Header */}
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
            <span className="font-semibold text-gray-800 dark:text-zinc-100 truncate">{stay.guests.name}</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0 hidden sm:inline">DNI: {stay.guests.dni}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${badgeClass}`}>
              {badgeLabel}
            </span>
            {canChangeRoom(currentUser) && (
              <button
                onClick={handleOpenChangeRoom}
                className="p-1.5 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                title="Cambiar habitación"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
              </button>
            )}
            {canEditGuests(currentUser) && (
              <button
                onClick={() => setShowEdit(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="Editar huesped"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* DNI on mobile */}
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2 sm:hidden">DNI: {stay.guests.dni}</p>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm text-gray-600 dark:text-zinc-400">
          <div className="flex items-center gap-2 min-w-0">
            <Bed className="w-4 h-4 shrink-0" />
            <span className="truncate">Hab. {stay.rooms?.number || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
  {stay.guests.phone ? (
    <div className="flex items-center gap-2 min-w-0">
      <a
        href={`tel:${stay.guests.phone.replace(/\s+/g, '')}`}
        title={`Llamar a ${stay.guests.name}`}
        aria-label={`Llamar a ${stay.guests.name}`}
        className="shrink-0 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
      >
        <Phone className="w-4 h-4" />
      </a>
      <a
        href={`https://wa.me/${whatsappNumber(stay.guests.phone)}`}
        target="_blank"
        rel="noreferrer"
        title={`Escribir por WhatsApp a ${stay.guests.name}`}
        aria-label={`Escribir por WhatsApp a ${stay.guests.name}`}
        className="shrink-0 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
      >
        <WhatsAppIcon className="w-4 h-4" />
      </a>
      <span className="truncate text-gray-700 dark:text-zinc-300 font-medium">
        {stay.guests.phone}
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-2 min-w-0">
      <Phone className="w-4 h-4 shrink-0 text-gray-400 dark:text-zinc-500" />
      <span className="truncate">Sin teléfono</span>
    </div>
  )}
</div>
          {stay.empresa && (
            <div className="col-span-2 flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 shrink-0 text-blue-500" />
              <span className="text-blue-700 dark:text-blue-400 font-medium truncate">{stay.empresa}</span>
            </div>
          )}
          <div className="col-span-2 flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {new Date(stay.check_in_date + 'T12:00:00').toLocaleDateString('es-ES')} — {new Date(departureDateStr + 'T12:00:00').toLocaleDateString('es-ES')}
            </span>
          </div>
          {!stay.empresa && (
            <div className="col-span-2 font-semibold text-gray-800 dark:text-zinc-100">
              S/ {stay.total_amount?.toFixed(2) || '0.00'}
            </div>
          )}
        </div>

        {/* Editar fecha fin inline panel */}
        {showEditDate && (
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg space-y-2">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Nueva fecha de salida</p>
            <input
              type="date"
              value={editDate}
              min={stay.check_in_date}
              onChange={e => setEditDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleEditDate}
                disabled={!editDate || editDate === stay.check_out_date || editDateLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {editDateLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirmar
              </button>
              <button
                onClick={() => { setShowEditDate(false); setEditDate(''); }}
                className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Cambiar habitación inline panel */}
        {showChangeRoom && (
          <div className="mb-3 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg space-y-2">
            <p className="text-xs font-medium text-violet-700 dark:text-violet-400">Seleccionar nueva habitación</p>
            {loadingRooms ? (
              <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando habitaciones...
              </div>
            ) : availableRooms.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-zinc-400">No hay habitaciones disponibles.</p>
            ) : (
              <select
                value={newRoomId}
                onChange={e => setNewRoomId(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-violet-300 dark:border-violet-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
                autoFocus
              >
                <option value="">-- Seleccionar habitación --</option>
                {availableRooms.map(r => (
                  <option key={r.id} value={r.id}>Hab. {r.number} — Piso {r.floor}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleChangeRoom}
                disabled={!newRoomId || changeRoomLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {changeRoomLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirmar cambio
              </button>
              <button
                onClick={() => { setShowChangeRoom(false); setNewRoomId(''); }}
                className="px-3 py-1.5 text-sm text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-800/40 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-zinc-800 pt-3">
          <div className="flex items-center gap-1.5 min-w-0">
            {daysRemaining > 0 ? (
              <>
                <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm text-gray-600 dark:text-zinc-400 truncate">
                  <span className="font-bold text-blue-600 dark:text-blue-400">{daysRemaining}</span> {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                </span>
              </>
            ) : daysRemaining === 0 ? (
              <>
                <LogOut className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Sale hoy</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">Salida pendiente</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!showEditDate && !showChangeRoom && (
              <button
                onClick={() => { setShowEditDate(true); setEditDate(stay.check_out_date); }}
                className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-blue-400 text-blue-600 dark:text-blue-400 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-semibold whitespace-nowrap"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Fecha fin
              </button>
            )}
            <button
              onClick={handleCheckOut}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-red-500 text-red-500 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <><LogOut className="w-3.5 h-3.5" /> Salida</>
              }
            </button>
          </div>
        </div>
      </div>

      {showEdit && (
        <GuestEditModal
          guest={stay.guests}
          onClose={() => setShowEdit(false)}
          onSave={onUpdate}
        />
      )}
    </>
  );
}
