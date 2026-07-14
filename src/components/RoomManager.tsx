
import { getClient, Room, StayWithDetails } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Save, Layers, Loader2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RoomManagerProps {
  tenantId: string;
  sessionToken: string;
  rooms: Room[];
  stays: StayWithDetails[];
  onUpdate: () => void;
  readOnly?: boolean;
}

const roomTypes = [
  { value: 'single', label: 'Individual', capacity: 1 },
  { value: 'suite',  label: 'Suite',      capacity: 4 },
  { value: 'family', label: 'Familiar',   capacity: 5 },
];

const SPACE_TYPES = new Set<Room['type']>(['sala', 'tienda', 'lavanderia', 'almacen']);

export function RoomManager({

  sessionToken,

  rooms,

  stays,

  onUpdate,
  readOnly = false,

}: RoomManagerProps) {
  const [showAddRoom, setShowAddRoom] = useState(false);

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [loading, setLoading] = useState(false);

  const [puchiBlinking, setPuchiBlinking] = useState(false);
  useEffect(() => {
    let blinkTimeout: number | undefined;

    const blinkInterval = window.setInterval(() => {
      setPuchiBlinking(true);

      blinkTimeout = window.setTimeout(() => {
        setPuchiBlinking(false);
      }, 180);
    }, 4000);

    return () => {
      window.clearInterval(blinkInterval);

      if (blinkTimeout) {
        window.clearTimeout(blinkTimeout);
      }
    };
  }, []);
  const guestRooms = rooms.filter(room => !SPACE_TYPES.has(room.type));

  const floors = [...new Set(guestRooms.map(room => room.floor))].sort(
    (a, b) => a - b
  );

  const roomsByFloor = floors.map(floor => ({
    floor,
    rooms: guestRooms
      .filter(room => room.floor === floor)
      .sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true })
      ),
  }));

  const occupiedRoomIds = new Set(
    stays
      .filter(stay => stay.status === 'active')
      .map(stay => stay.room_id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">
            Gestión de Habitaciones
          </h3>

          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {guestRooms.length} habitaciones en {floors.length} pisos
          </p>
        </div>

        {!readOnly && <button
          type="button"
          onClick={() => setShowAddRoom(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-700 hover:to-teal-700"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Agregar Habitación</span>
        </button>}
      </div>

      {floors.length === 0 ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <img
              src={
                puchiBlinking
                  ? '/puchi-senalando-cerrado.png'
                  : '/puchi-senalando-abierto.png'
              }
              alt="Puchi señalando el botón Agregar Habitación"
              className="h-44 w-44 shrink-0 object-contain sm:h-52 sm:w-52"
            />

            <div className="text-center sm:text-left">
  

  <p className="text-base font-semibold text-gray-700 dark:text-zinc-200">
    No hay habitaciones registradas
  </p>

  <p className="mt-2 text-sm text-gray-400 dark:text-zinc-500">
    Haz clic en “Agregar Habitación”, arriba a la derecha, y yo te ayudo a comenzar.
  </p>
</div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {roomsByFloor.map(({ floor, rooms: floorRooms }) => (
            <div
              key={floor}
              className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-gray-500 dark:text-zinc-400" />

                  <span className="font-semibold text-gray-700 dark:text-zinc-200">
                    Piso {floor}
                  </span>

                  <span className="text-sm text-gray-500 dark:text-zinc-400">
                    ({floorRooms.length} habitaciones)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {floorRooms.map(room => (
                  <RoomItem
                    key={room.id}
                    room={room}
                    isOccupied={occupiedRoomIds.has(room.id)}
                    onEdit={() => setEditingRoom(room)}
                    onDelete={async () => {
                      if (!confirm(`¿Eliminar habitación ${room.number}?`)) {
                        return;
                      }

                      setLoading(true);

                      const { error } = await getClient().rpc('delete_room', {
                        p_session_token: sessionToken,
                        p_room_id: room.id,
                      });

                      setLoading(false);

                      if (error) {
                        alert(error.message);
                        return;
                      }

                      onUpdate();
                    }}
                    loading={loading}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAddRoom || editingRoom) && (
        <RoomForm
          rooms={guestRooms}
          floors={floors}
          room={editingRoom}
          onClose={() => {
            setShowAddRoom(false);
            setEditingRoom(null);
          }}
          onSave={async data => {
            setLoading(true);

            let errorMsg: string | null = null;

            if (editingRoom) {
              const { error } = await getClient().rpc('update_room', {
                p_session_token: sessionToken,
                p_room_id: editingRoom.id,
                p_number: data.number ?? editingRoom.number,
                p_floor: data.floor ?? editingRoom.floor,
                p_type: data.type ?? editingRoom.type,
                p_capacity: data.capacity ?? editingRoom.capacity,
                p_price_per_night:
                  data.price_per_night ?? editingRoom.price_per_night,
                p_status: data.status ?? editingRoom.status,
              });

              if (error) {
                errorMsg = error.message;
              }
            } else {
              const { error } = await getClient().rpc('create_room', {
                p_session_token: sessionToken,
                p_number: data.number!,
                p_floor: data.floor!,
                p_type: data.type!,
                p_capacity: data.capacity!,
                p_price_per_night: data.price_per_night ?? 0,
                p_status: data.status ?? 'available',
              });

              if (error) {
                errorMsg = error.message;
              }
            }

            setLoading(false);

            if (errorMsg) {
              return errorMsg;
            }

            onUpdate();
            setShowAddRoom(false);
            setEditingRoom(null);

            return null;
          }}
          loading={loading}
        />
      )}
    </div>
  );
}
  
interface RoomItemProps {
  room: Room;
  isOccupied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  loading: boolean;
  readOnly?: boolean;
}

function RoomItem({ room, isOccupied, onEdit, onDelete, loading, readOnly = false }: RoomItemProps) {
  const [showOccupiedWarning, setShowOccupiedWarning] = useState(false);

  const statusColors: Record<Room['status'], string> = {
    available: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    occupied: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    maintenance: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    cleaning: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
  };

  const handleEditClick = () => {
    if (isOccupied) {
      setShowOccupiedWarning(true);
      return;
    }
    onEdit();
  };

  return (
    <>
      <div className={`bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 border dark:border-zinc-700 group transition-colors ${
        isOccupied ? 'border-red-200 dark:border-red-900/50' : 'border-gray-200'
      }`}>
        <div className="flex justify-between items-start mb-2">
          <span className="font-bold text-gray-800 dark:text-zinc-100">Hab. {room.number}</span>
          {!readOnly && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleEditClick}
              className={`p-1 rounded transition-colors ${
                isOccupied
                  ? 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'
                  : 'hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400'
              }`}
              disabled={loading}
              title={isOccupied ? 'Habitación ocupada — registra la salida primero' : 'Editar habitación'}
            >
              {isOccupied ? <Lock className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onDelete}
              className={`p-1 rounded transition-colors ${
                isOccupied
                  ? 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'
                  : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
              }`}
              disabled={loading || isOccupied}
              title={isOccupied ? 'No se puede eliminar una habitación ocupada' : 'Eliminar habitación'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 bg-white dark:bg-zinc-700 rounded border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-zinc-300">
            {roomTypes.find(t => t.value === room.type)?.label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[room.status]}`}>
            {room.status === 'available' ? 'Disponible' :
             room.status === 'occupied' ? 'Ocupado' :
             room.status === 'maintenance' ? 'Mantenimiento' : 'Limpieza'}
          </span>
        </div>
        <div className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
          S/ {room.price_per_night.toFixed(2)}/noche
        </div>
      </div>

      {showOccupiedWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-zinc-100">Habitación en uso</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
              Esta habitación está en uso. Primero debes registrar la salida del huésped para poder editar esta habitación.
            </p>
            <button
              onClick={() => setShowOccupiedWarning(false)}
              className="w-full py-2.5 px-4 bg-gray-800 dark:bg-zinc-700 text-white rounded-xl font-medium hover:bg-gray-700 dark:hover:bg-zinc-600 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}

interface RoomFormProps {
  rooms: Room[];
  floors: number[];
  room: Room | null;
  onClose: () => void;
  onSave: (data: Partial<Room>) => Promise<string | null>;
  loading: boolean;
}

function RoomForm({ rooms, floors, room, onClose, onSave, loading }: RoomFormProps) {
  const [number, setNumber] = useState(room?.number || '');
  const [floor, setFloor] = useState<number>(room?.floor || (floors[0] || 1));
  const [type, setType] = useState<Room['type']>(room?.type || 'single');
  const [price, setPrice] = useState(room?.price_per_night?.toString() || '0');
  const [status, setStatus] = useState<'available' | 'maintenance' | 'cleaning'>(
    room?.status === 'maintenance' ? 'maintenance' : room?.status === 'cleaning' ? 'cleaning' : 'available'
  );
  const [newFloor, setNewFloor] = useState('');
  const [showNewFloor, setShowNewFloor] = useState(false);
  const [pendingFloors, setPendingFloors] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const allFloors = [...new Set([...floors, ...pendingFloors])].sort((a, b) => a - b);

 const handleSubmit = async () => {
  setFormError(null);

  if (allFloors.length === 0) {
    setFormError('Primero debes crear un piso.');
    return;
  }

  if (!number.trim()) {
    setFormError('El numero de habitacion es obligatorio');
    return;
  }

  if (!floor) {
    setFormError('Debes seleccionar o crear un piso');
    return;
  }

  const typeInfo = roomTypes.find(t => t.value === type);

  const err = await onSave({
    number: number.trim(),
    floor,
    type,
    capacity: typeInfo?.capacity ?? 1,
    price_per_night: room ? parseFloat(price) || 0 : 0,
    status: room ? status : 'available',
  });

  if (err) {
    if (err.includes('unique') || err.includes('duplicate')) {
      setFormError(`Ya existe una habitacion con el numero "${number}"`);
    } else {
      setFormError(err);
    }
  }
};

  const handleAddFloor = () => {
    const floorNum = parseInt(newFloor);
    if (!floorNum || floorNum <= 0) return;
    setPendingFloors(prev => prev.includes(floorNum) ? prev : [...prev, floorNum]);
    setFloor(floorNum);
    setShowNewFloor(false);
    setNewFloor('');
    setNumber(`${floorNum}${String(1).padStart(2, '0')}`);
  };

  const handleNumberChange = (val: string) => {
    setNumber(val);
    const match = val.match(/^(\d+)\d{2}$/);
    if (match) {
      const detected = parseInt(match[1]);
      if (detected > 0) {
        setFloor(detected);
        if (!allFloors.includes(detected)) {
          setPendingFloors(prev => prev.includes(detected) ? prev : [...prev, detected]);
        }
      }
    }
  };

  const suggestRoomNumber = () => {
    const floorRooms = rooms.filter(r => r.floor === floor);
    const lastNum = floorRooms.length > 0
      ? Math.max(...floorRooms.map(r => parseInt(r.number.slice(-2)) || 0))
      : 0;
    setNumber(`${floor}${(lastNum + 1).toString().padStart(2, '0')}`);
  };

  const inputBase = 'py-2.5 px-3 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 focus:outline-none';
  const labelBase = 'block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="border-b border-gray-100 dark:border-zinc-800 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-zinc-100">
            {room ? 'Editar Habitacion' : 'Nueva Habitacion'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Floor */}
          <div>
            <label className={labelBase}>Piso *</label>
            <div className="flex gap-2">
              {!showNewFloor ? (
                <>
                  {allFloors.length > 0 ? (
                    <select
                      value={floor}
                      onChange={(e) => setFloor(Number(e.target.value))}
                      className={`flex-1 ${inputBase}`}
                    >
                      {allFloors.map(f => (
                        <option key={f} value={f}>
                          Piso {f}{pendingFloors.includes(f) ? ' (nuevo)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className={`flex-1 ${inputBase} bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800`}>
                      No hay pisos — Agrega uno nuevo
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNewFloor(true)}
                    className="px-3 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Piso
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    value={newFloor}
                    onChange={(e) => setNewFloor(e.target.value)}
                    placeholder="Ej: 1, 2, 3..."
                    className={`flex-1 ${inputBase}`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddFloor}
                    disabled={!newFloor}
                    className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium disabled:opacity-50"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewFloor(false); setNewFloor(''); }}
                    className="px-3 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {showNewFloor && (
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">Ingresa el numero del nuevo piso y presiona OK</p>
            )}
          </div>

          {/* Room Number */}
          <div>
            <label className={labelBase}>Numero de Habitacion *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={number}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder="Ej: 101, 401..."
                className={`flex-1 ${inputBase}`}
              />
              <button
                type="button"
                onClick={suggestRoomNumber}
                className="px-3 py-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 text-sm font-medium"
              >
                Auto
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">El piso se detecta automaticamente del numero (ej: "401" → Piso 4)</p>
          </div>

          {/* Type */}
          <div>
            <label className={labelBase}>Tipo *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Room['type'])}
              className={`w-full ${inputBase}`}
            >
              {room?.type === 'double' && (
                <option value="double">Doble (tipo existente)</option>
              )}
              {roomTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Price (edit only) */}
          {room && (
            <div>
              <label className={labelBase}>Precio por noche</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm font-medium">S/</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className={`w-full pl-9 ${inputBase}`}
                />
              </div>
            </div>
          )}

          {/* Status (edit only) */}
          {room && (
            <div>
              <label className={`${labelBase} mb-2`}>Estado</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('available')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    status === 'available'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Disponible
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('maintenance')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    status === 'maintenance'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Mantenimiento
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('cleaning')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    status === 'cleaning'
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400'
                      : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  Limpieza
                </button>
              </div>
            </div>
          )}

          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-zinc-800 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !number.trim()}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {room ? 'Guardar Cambios' : 'Crear Habitacion'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
