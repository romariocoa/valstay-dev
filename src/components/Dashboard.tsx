import { useState, useEffect } from 'react';
import { Room, StayWithDetails, getClient } from '../lib/supabase';
import { RoomCard } from './RoomCard';
import { ChevronDown, Building2, LayoutGrid, Map } from 'lucide-react';
import { FloorPlan } from './FloorPlan';


function localDateStr(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function effectiveDepartureDateStr(stay: { check_out_date: string }): string {
  const d = new Date(stay.check_out_date + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

function isLeavingToday(stay: StayWithDetails | undefined): boolean {
  if (!stay?.check_out_date) return false;
  return effectiveDepartureDateStr(stay) === localDateStr(new Date());
}

interface DashboardProps {
  tenantId?: string;
  sessionToken?: string;
  rooms: Room[];
  stays: StayWithDetails[];
  onCheckIn: (room: Room) => void;
  onCheckOut: (room: Room, stay: StayWithDetails | undefined) => void;
  onUpdate: () => void;
  canEditFloorPlan?: boolean;
  canManageRooms?: boolean;
  onGoToRooms?: () => void;
  logoUrl?: string;
  readOnly?: boolean;
}

type FilterStatus = 'all' | 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'leaving_today';
type ViewMode = 'grid' | 'plan';

export function Dashboard({
  tenantId = '',
  sessionToken = '',
  rooms,
  stays,
  onCheckIn,
  onCheckOut,
  onUpdate,
  canEditFloorPlan = true,
  canManageRooms = false,
  onGoToRooms,
  logoUrl,
  readOnly = false,
}: DashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [empresaFilter, setEmpresaFilter] = useState<string>('all');
  const [puchiBlinking, setPuchiBlinking] = useState(false);
  useEffect(() => {
  let blinkTimeout: number | undefined;

  const blinkInterval = window.setInterval(() => {
    setPuchiBlinking(true);

    blinkTimeout = window.setTimeout(() => {
      setPuchiBlinking(false);
    }, 180);
  }, 3000);

  return () => {
    window.clearInterval(blinkInterval);

    if (blinkTimeout) {
      window.clearTimeout(blinkTimeout);
    }
  };
}, []);

  const handleMarkAvailable = async (roomId: string) => {
    await getClient().from('rooms').update({ status: 'available' }).eq('id', roomId);
    onUpdate();
  };

  const activeStays = stays.filter(s => s.status === 'active');
  const stayByRoomId = Object.fromEntries(activeStays.map(s => [s.room_id, s]));

  // If a room has an active stay, treat it as occupied regardless of rooms.status
  // (guards against desync between the two tables)
  const effectiveRoom = (r: Room): Room =>
    stayByRoomId[r.id] ? { ...r, status: 'occupied' } : r;

  const empresas = [...new Set(
    activeStays.map(s => s.empresa).filter(Boolean) as string[]
  )].sort();

  // If the selected empresa no longer has any active stays, reset the filter
  useEffect(() => {
    if (empresaFilter !== 'all' && !empresas.includes(empresaFilter)) {
      setEmpresaFilter('all');
    }
  }, [empresas, empresaFilter]);

  const SPACE_TYPES = new Set<Room['type']>(['sala', 'lavanderia', 'almacen', 'tienda']);

  // Only real guest rooms — excludes internal spaces from all counts
  const guestRooms = rooms.filter(r => !SPACE_TYPES.has(r.type));
// Habitaciones consideradas en los indicadores.
// Al seleccionar una empresa, los contadores muestran solo sus habitaciones.
const countableRooms = guestRooms.filter(room => {
  if (empresaFilter === 'all') return true;

  return stayByRoomId[room.id]?.empresa === empresaFilter;
});

const totalRoomsCount = countableRooms.length;

const availableCount = countableRooms.filter(
  room => effectiveRoom(room).status === 'available'
).length;

const occupiedCount = countableRooms.filter(
  room => effectiveRoom(room).status === 'occupied'
).length;

const maintenanceCount = countableRooms.filter(
  room => effectiveRoom(room).status === 'maintenance'
).length;

const cleaningCount = countableRooms.filter(
  room => effectiveRoom(room).status === 'cleaning'
).length;

const leavingTodayCount = countableRooms.filter(
  room => isLeavingToday(stayByRoomId[room.id])
).length;
  const filteredRooms = rooms.filter(r => {
    if (SPACE_TYPES.has(r.type)) return false;
    const matchEmpresa = empresaFilter === 'all'
      ? true
      : stayByRoomId[r.id]?.empresa === empresaFilter;
    if (!matchEmpresa) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'leaving_today') return isLeavingToday(stayByRoomId[r.id]);
    return effectiveRoom(r).status === statusFilter;
  });

  const floors = [...new Set(filteredRooms.map(r => r.floor))].sort((a, b) => a - b);

 
  const viewToggle = (
  <div className="inline-grid grid-cols-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
    <button
      type="button"
      onClick={() => setViewMode('grid')}
      className={`flex min-w-[105px] items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
        viewMode === 'grid'
          ? 'bg-gray-900 text-white dark:bg-zinc-600'
          : 'text-gray-500 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-700'
      }`}
    >
      <LayoutGrid className="h-4 w-4 shrink-0" />
      <span>Cuadrícula</span>
    </button>

    <button
      type="button"
      onClick={() => setViewMode('plan')}
      className={`flex min-w-[105px] items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
        viewMode === 'plan'
          ? 'bg-gray-900 text-white dark:bg-zinc-600'
          : 'text-gray-500 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-700'
      }`}
    >
      <Map className="h-4 w-4 shrink-0" />
      <span>Plano</span>
    </button>
  </div>
);

  if (viewMode === 'plan') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{viewToggle}</div>
        <FloorPlan
          tenantId={tenantId}
          sessionToken={sessionToken}
          rooms={rooms}
          stays={stays}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onUpdate={onUpdate}
          canEdit={canEditFloorPlan}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {viewToggle}
        {empresas.length > 0 && (
          <div className="relative">
            <Building2
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: empresaFilter !== 'all' ? 'white' : undefined }}
            />
            <select
              value={empresaFilter}
              onChange={e => setEmpresaFilter(e.target.value)}
              className={`pl-8 pr-7 py-1.5 rounded-full text-sm font-medium border appearance-none transition-all cursor-pointer ${
                empresaFilter !== 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
              }`}
            >
              <option value="all">Todas las empresas</option>
              {empresas.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            {empresaFilter !== 'all' && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        )}

       

       <div className="w-full lg:w-auto lg:ml-auto overflow-x-auto scrollbar-none">
  <div className="flex items-center gap-2 text-sm min-w-max pb-1 lg:pb-0 lg:justify-end">

   <button
  type="button"
  onClick={() => setStatusFilter('all')}
  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border font-semibold transition-all ${
    statusFilter === 'all'
      ? 'bg-gray-800 dark:bg-zinc-600 border-gray-800 dark:border-zinc-600'
      : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
  }`}
>
  <span className="w-2 h-2 rounded-full bg-gray-400" />

  <span
    className={
      statusFilter === 'all'
        ? 'text-white'
        : 'text-gray-600 dark:text-zinc-300'
    }
  >
    Todas
  </span>

  <span className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-200">
    {totalRoomsCount}
  </span>
</button>

    {leavingTodayCount > 0 && (
  <button
    type="button"
    onClick={() => setStatusFilter('leaving_today')}
    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border font-semibold transition-all ${
      statusFilter === 'leaving_today'
        ? 'bg-blue-500 border-blue-500'
        : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
    }`}
  >
    <span className="w-2 h-2 rounded-full bg-blue-500" />

    <span
      className={
        statusFilter === 'leaving_today'
          ? 'text-white'
          : 'text-blue-600 dark:text-blue-400'
      }
    >
      {leavingTodayCount === 1 ? 'Sale hoy' : 'Salen hoy'}
    </span>

    <span className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black bg-blue-50 text-blue-700 dark:bg-zinc-700 dark:text-blue-300">
      {leavingTodayCount}
    </span>
  </button>
)}

   {availableCount > 0 && (
  <button
    type="button"
    onClick={() => setStatusFilter('available')}
    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border font-semibold transition-all ${
      statusFilter === 'available'
        ? 'bg-green-600 border-green-600'
        : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
    }`}
  >
    <span className="w-2 h-2 rounded-full bg-green-500" />

    <span
      className={
        statusFilter === 'available'
          ? 'text-white'
          : 'text-green-700 dark:text-green-400'
      }
    >
      Libres
    </span>

    <span className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black bg-green-50 text-green-700 dark:bg-zinc-700 dark:text-green-300">
      {availableCount}
    </span>
  </button>
)}

    {occupiedCount > 0 && (
  <button
    type="button"
    onClick={() => setStatusFilter('occupied')}
    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border font-semibold transition-all ${
      statusFilter === 'occupied'
        ? 'bg-red-500 border-red-500'
        : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
    }`}
  >
    <span className="w-2 h-2 rounded-full bg-red-500" />

    <span
      className={
        statusFilter === 'occupied'
          ? 'text-white'
          : 'text-red-700 dark:text-red-400'
      }
    >
      Ocupadas
    </span>

    <span className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black bg-red-50 text-red-700 dark:bg-zinc-700 dark:text-red-300">
      {occupiedCount}
    </span>
  </button>
)}
   

  {cleaningCount > 0 && (
  <button
    type="button"
    onClick={() => setStatusFilter('cleaning')}
    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border font-semibold transition-all ${
      statusFilter === 'cleaning'
        ? 'bg-cyan-500 border-cyan-500'
        : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
    }`}
  >
    <span className="w-2 h-2 rounded-full bg-cyan-400" />

    <span
      className={
        statusFilter === 'cleaning'
          ? 'text-white'
          : 'text-cyan-700 dark:text-cyan-400'
      }
    >
      En limpieza
    </span>

    <span className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black bg-cyan-50 text-cyan-700 dark:bg-zinc-700 dark:text-cyan-300">
      {cleaningCount}
    </span>
  </button>
)}

    {maintenanceCount > 0 && (
  <button
    type="button"
    onClick={() => setStatusFilter('maintenance')}
    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border font-semibold transition-all ${
      statusFilter === 'maintenance'
        ? 'bg-amber-400 border-amber-400'
        : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
    }`}
  >
    <span className="w-2 h-2 rounded-full bg-amber-400" />

    <span
      className={
        statusFilter === 'maintenance'
          ? 'text-gray-900'
          : 'text-amber-700 dark:text-amber-400'
      }
    >
      Mantenimiento
    </span>

    <span className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black bg-amber-50 text-amber-700 dark:bg-zinc-700 dark:text-amber-300">
      {maintenanceCount}
    </span>
  </button>
)}

  </div>
</div></div>

      {/* Floors */}
    {guestRooms.length === 0 ? (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center">

  <div className="flex flex-col items-center gap-0">

  <img

    src={puchiBlinking ? '/puchi-cerrado.png' : '/puchi-abierto.png'}

    alt="Puchi"

    className="h-24 w-24 object-contain"

  />

  <h3 className="-mt-6 text-xl font-bold text-gray-900 dark:text-white">

    ¡Hola! Soy Puchi

  </h3>

</div>

    <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-zinc-400">
      Veo que todavía no tienes habitaciones registradas.
      Te ayudaré a crearlas para que puedas comenzar a usar ValStay.
    </p>

    <button
      type="button"
      onClick={onGoToRooms}
      disabled={!canManageRooms}
      title={
        canManageRooms
          ? 'Ir a crear habitaciones'
          : 'Solo un administrador puede crear habitaciones'
      }
      className={`mt-5 rounded-xl px-5 py-2.5 font-semibold transition-colors ${
        canManageRooms
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400'
      }`}
    >
      {canManageRooms
        ? 'Crear mis habitaciones'
        : 'Solo el administrador puede crearlas'}
    </button>
  </div>
) : floors.length === 0 ? (
  <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
    <p className="text-gray-500 dark:text-zinc-400">
      No hay habitaciones que coincidan con el filtro seleccionado.
    </p>
  </div>
) : (
        floors.map(floor => {
          const floorRooms = filteredRooms
            .filter(r => r.floor === floor)
            .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
          const freeCount = floorRooms.filter(r => effectiveRoom(r).status === 'available').length;

          return (
            <section key={floor}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-800 dark:bg-zinc-700 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                    {floor}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-zinc-100">Piso {floor}</h3>
                </div>
                <span className="text-sm font-semibold text-gray-500 dark:text-zinc-400">
                  {freeCount} {freeCount === 1 ? 'Libre' : 'Libres'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {floorRooms.map(room => (
                  <RoomCard
                    key={room.id}
                    room={effectiveRoom(room)}
                    activeStay={stayByRoomId[room.id]}
                    onCheckIn={() => onCheckIn(room)}
                    onCheckOut={() => onCheckOut(room, stayByRoomId[room.id])}
                    onMarkAvailable={() => handleMarkAvailable(room.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
