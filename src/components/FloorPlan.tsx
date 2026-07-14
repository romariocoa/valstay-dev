import { useState, useEffect, useRef, useCallback } from 'react';
import { getClient, Room, StayWithDetails } from '../lib/supabase';
import {
  Pencil, RotateCcw, ChevronLeft, ChevronRight,
  Eraser, MousePointer, Save,
  DoorOpen, ArrowUpDown, Trash2, Move, RotateCw,
  Plus, Minus, X, Loader2, LogIn, LogOut,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_COLS = 22;
const DEFAULT_ROWS = 14;
const CELL_PX  = 44;
const GRID_PAD = 12;
const CELL_GAP = 2;

const ROTATABLE: ElementType[] = ['door', 'window', 'stairs'];

function localDateStr(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function effectiveDepartureDateStr(stay: { check_out_date: string; empresa: string | null }): string {
  if (stay.empresa) return stay.check_out_date;
  const d = new Date(stay.check_out_date + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

function isLeavingToday(stay: StayWithDetails | undefined): boolean {
  if (!stay?.check_out_date) return false;
  return effectiveDepartureDateStr(stay) === localDateStr(new Date());
}

type ElementType = 'wall' | 'stairs' | 'elevator' | 'door' | 'window' | 'hallway';
type Tool = 'select' | ElementType | 'eraser';

interface PlacedElement {
  id?: string;
  floor: number;
  pos_x: number;
  pos_y: number;
  element_type: ElementType;
  rotation: number;
}

interface RoomSize { w: number; h: number; }

// ── Room status styles ────────────────────────────────────────────────────────
const RS: Record<Room['status'], { bg: string; border: string; text: string; dot: string }> = {
  available:   { bg: 'bg-emerald-50',  border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  occupied:    { bg: 'bg-rose-50',     border: 'border-rose-400',    text: 'text-rose-800',    dot: 'bg-rose-500' },
  maintenance: { bg: 'bg-amber-50',    border: 'border-amber-400',   text: 'text-amber-800',   dot: 'bg-amber-400' },
  cleaning:    { bg: 'bg-sky-50',      border: 'border-sky-400',     text: 'text-sky-800',     dot: 'bg-sky-400' },
};

const STATUS_BADGE: Record<Room['status'], string> = {
  available:   'bg-green-500',
  occupied:    'bg-red-500',
  maintenance: 'bg-amber-400',
  cleaning:    'bg-blue-400',
};
const STATUS_LABEL: Record<Room['status'], string> = {
  available:   'Libre',
  occupied:    'Ocupado',
  maintenance: 'Mantenim.',
  cleaning:    'Limpieza',
};
const TYPE_LABEL: Record<Room['type'], string> = {
  single:     'INDIVIDUAL',
  double:     'DOBLE',
  suite:      'SUITE',
  family:     'FAMILIAR',
  sala:       'SALA',
  lavanderia: 'LAVANDERÍA',
  almacen:    'ALMACÉN',
  tienda:     'TIENDA',
};
const GUEST_TYPES = new Set<Room['type']>(['single', 'double', 'suite', 'family']);

// Type-based color overrides (for special spaces regardless of status)
const TYPE_OVERRIDE: Partial<Record<Room['type'], { bg: string; border: string; text: string; dot: string }>> = {
  sala:       { bg: 'bg-violet-50',  border: 'border-violet-400', text: 'text-violet-800', dot: 'bg-violet-400' },
  lavanderia: { bg: 'bg-cyan-50',    border: 'border-cyan-400',   text: 'text-cyan-800',   dot: 'bg-cyan-400' },
  almacen:    { bg: 'bg-amber-50',   border: 'border-amber-400',  text: 'text-amber-800',  dot: 'bg-amber-400' },
  tienda:     { bg: 'bg-pink-50',    border: 'border-pink-400',   text: 'text-pink-800',   dot: 'bg-pink-400' },
};

const SPACE_TYPES: { value: Room['type']; label: string; capacity: number; price: number }[] = [
  { value: 'sala',       label: 'Sala',        capacity: 20, price: 0 },
  { value: 'tienda',     label: 'Tienda',      capacity: 10, price: 0 },
  { value: 'lavanderia', label: 'Lavanderia',  capacity: 0,  price: 0 },
  { value: 'almacen',    label: 'Almacen',     capacity: 0,  price: 0 },
  { value: 'single',     label: 'Individual',  capacity: 1,  price: 80 },
  { value: 'double',     label: 'Doble',       capacity: 2,  price: 120 },
  { value: 'suite',      label: 'Suite',       capacity: 4,  price: 250 },
  { value: 'family',     label: 'Familiar',    capacity: 5,  price: 200 },
];

// ── Element configs ───────────────────────────────────────────────────────────
const EC: Record<ElementType, {
  label: string; cellBg: string; cellBorder: string; textColor: string;
  btnIdle: string; btnActive: string;
}> = {
  wall:     { label: 'Pared',    cellBg: 'bg-transparent', cellBorder: 'border-transparent', textColor: 'text-gray-800',   btnIdle: 'bg-gray-100 text-gray-700 border-gray-400',       btnActive: 'bg-gray-800 text-white border-gray-800' },
  hallway:  { label: 'Pasillo',  cellBg: 'bg-slate-100',   cellBorder: 'border-slate-300',   textColor: 'text-slate-500',  btnIdle: 'bg-slate-50 text-slate-600 border-slate-300',    btnActive: 'bg-slate-500 text-white border-slate-500' },
  door:     { label: 'Puerta',   cellBg: 'bg-orange-50',   cellBorder: 'border-orange-400',  textColor: 'text-orange-700', btnIdle: 'bg-orange-50 text-orange-700 border-orange-300', btnActive: 'bg-orange-500 text-white border-orange-500' },
  window:   { label: 'Ventana',  cellBg: 'bg-cyan-50',     cellBorder: 'border-cyan-400',    textColor: 'text-cyan-700',   btnIdle: 'bg-cyan-50 text-cyan-700 border-cyan-300',       btnActive: 'bg-cyan-500 text-white border-cyan-500' },
  stairs:   { label: 'Escalera', cellBg: 'bg-stone-50',    cellBorder: 'border-stone-400',   textColor: 'text-stone-700',  btnIdle: 'bg-stone-50 text-stone-700 border-stone-400',    btnActive: 'bg-stone-600 text-white border-stone-600' },
  elevator: { label: 'Ascensor', cellBg: 'bg-blue-50',     cellBorder: 'border-blue-500',    textColor: 'text-blue-800',   btnIdle: 'bg-blue-50 text-blue-700 border-blue-300',       btnActive: 'bg-blue-600 text-white border-blue-600' },
};

const TOOLS: Tool[] = ['select', 'wall', 'hallway', 'door', 'window', 'stairs', 'elevator', 'eraser'];

const ROT_LABELS: Record<number, string> = { 0: '0°', 90: '90°', 180: '180°', 270: '270°' };

function cellKey(x: number, y: number) { return `${x},${y}`; }

// ── Wall cell ─────────────────────────────────────────────────────────────────
function WallCell({ x, y, getElem }: {
  x: number; y: number;
  getElem: (x: number, y: number) => PlacedElement | null;
}) {
  const isWall = (dx: number, dy: number) => getElem(x + dx, y + dy)?.element_type === 'wall';
  const L = isWall(-1, 0), R = isWall(1, 0), U = isWall(0, -1), D = isWall(0, 1);
  const T = 8, c = CELL_PX / 2, half = T / 2;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <div className="absolute bg-gray-800" style={{
        top: c - half, height: T,
        left: L ? -CELL_GAP : c - half, right: R ? -CELL_GAP : c - half,
        borderRadius: (!L && !R) ? 3 : (!L ? '3px 0 0 3px' : !R ? '0 3px 3px 0' : 0),
      }} />
      <div className="absolute bg-gray-800" style={{
        left: c - half, width: T,
        top: U ? -CELL_GAP : c - half, bottom: D ? -CELL_GAP : c - half,
        borderRadius: (!U && !D) ? 3 : (!U ? '3px 3px 0 0' : !D ? '0 0 3px 3px' : 0),
      }} />
    </div>
  );
}

// ── Window cell ───────────────────────────────────────────────────────────────
function WindowCell({ rotation }: { rotation: number }) {
  const pad = Math.round(CELL_PX * 0.12);
  const gap = Math.round(CELL_PX * 0.22);
  const center = CELL_PX / 2;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${rotation}deg)` }}>
      <div className="absolute bg-cyan-600" style={{ top: pad, bottom: pad, left: pad, width: 1.5 }} />
      <div className="absolute bg-cyan-600" style={{ top: pad, bottom: pad, right: pad, width: 1.5 }} />
      <div className="absolute bg-cyan-500" style={{ left: pad + 2, right: pad + 2, top: center - gap / 2 - 1, height: 1.5 }} />
      <div className="absolute bg-cyan-500" style={{ left: pad + 2, right: pad + 2, top: center + gap / 2 - 1, height: 1.5 }} />
    </div>
  );
}

// ── Stairs cell ───────────────────────────────────────────────────────────────
function StairsCell({ rotation }: { rotation: number }) {
  const pad = 4, w = CELL_PX - pad * 2, h = CELL_PX - pad * 2, steps = 5;
  return (
    <svg width={CELL_PX} height={CELL_PX} viewBox={`0 0 ${CELL_PX} ${CELL_PX}`}
      className="absolute inset-0"
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}>
      <rect x={pad} y={pad} width={w} height={h} fill="none" stroke="#78716c" strokeWidth="1.2" />
      {Array.from({ length: steps - 1 }, (_, i) => {
        const y = pad + ((i + 1) * h) / steps;
        return <line key={i} x1={pad} y1={y} x2={pad + w} y2={y} stroke="#78716c" strokeWidth="1" />;
      })}
      <line x1={CELL_PX / 2} y1={pad + 3} x2={CELL_PX / 2} y2={pad + h * 0.6} stroke="#57534e" strokeWidth="1.5" />
      <polyline
        points={`${CELL_PX/2 - 3},${pad + 7} ${CELL_PX/2},${pad + 2} ${CELL_PX/2 + 3},${pad + 7}`}
        fill="none" stroke="#57534e" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Door cell ─────────────────────────────────────────────────────────────────
function DoorCell({ rotation }: { rotation: number }) {
  const sz = Math.round(CELL_PX * 0.55);
  return (
    <div style={{ transform: `rotate(${rotation}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <DoorOpen size={sz} className="text-orange-600" strokeWidth={1.5} />
    </div>
  );
}

// ── Visual size picker (5×5 hover grid) ──────────────────────────────────────
const MAX_PICK = 5;
function SizePicker({ currentW, currentH, maxW, maxH, onChange }: {
  currentW: number; currentH: number;
  maxW: number; maxH: number;
  onChange: (w: number, h: number) => void;
}) {
  const [hoverW, setHoverW] = useState(0);
  const [hoverH, setHoverH] = useState(0);
  const dW = hoverW || currentW;
  const dH = hoverH || currentH;
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
        Tamaño: <span className="text-gray-800">{dW}×{dH}</span> celdas
      </p>
      <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${MAX_PICK}, 1fr)` }}>
        {Array.from({ length: MAX_PICK }, (_, rowIdx) =>
          Array.from({ length: MAX_PICK }, (_, colIdx) => {
            const w = colIdx + 1, h = rowIdx + 1;
            const selectable = w <= maxW && h <= maxH;
            const active = w <= dW && h <= dH;
            return (
              <div key={`${w},${h}`}
                className={`w-7 h-7 border rounded-sm transition-all ${
                  !selectable
                    ? 'opacity-20 cursor-not-allowed bg-gray-50 border-gray-200'
                    : active
                    ? 'bg-gray-800 border-gray-900 cursor-pointer'
                    : 'bg-gray-100 border-gray-300 hover:bg-gray-300 cursor-pointer'
                }`}
                onMouseEnter={() => { if (selectable) { setHoverW(w); setHoverH(h); } }}
                onMouseLeave={() => { setHoverW(0); setHoverH(0); }}
                onClick={() => selectable && onChange(w, h)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface FloorPlanProps {
  tenantId: string;
  sessionToken: string;
  rooms: Room[];
  stays: StayWithDetails[];
  onCheckIn: (room: Room) => void;
  onCheckOut: (room: Room, stay: StayWithDetails | undefined) => void;
  onUpdate: () => void;
  canEdit?: boolean;
}

// ── Grid resize button ────────────────────────────────────────────────────────
function ResizeBtn({ onClick, disabled, icon, label }: {
  onClick: () => void; disabled?: boolean; icon: 'plus' | 'minus'; label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all
        ${disabled
          ? 'opacity-30 cursor-not-allowed bg-white border-gray-200 text-gray-400'
          : icon === 'plus'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            : 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
        }`}
    >
      {icon === 'plus' ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function FloorPlan({ tenantId, sessionToken, rooms, stays, onCheckIn, onCheckOut, onUpdate, canEdit = true }: FloorPlanProps) {
  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  const [floorIdx, setFloorIdx]     = useState(0);
  const [editMode, setEditMode]     = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>('select');

  const [gridCols, setGridCols]   = useState(DEFAULT_COLS);
  const [gridRows, setGridRows]   = useState(DEFAULT_ROWS);
  const [savedCols, setSavedCols] = useState(DEFAULT_COLS);
  const [savedRows, setSavedRows] = useState(DEFAULT_ROWS);

  const viewContainerRef = useRef<HTMLDivElement>(null);
  const [viewScale, setViewScale] = useState(1);
  const [expandedPlan, setExpandedPlan] = useState(false);
  
  const [pendingPos, setPendingPos]     = useState<Record<string, { x: number; y: number } | null>>({});
  const [pendingSizes, setPendingSizes] = useState<Record<string, RoomSize>>({});
  const [dragRoom, setDragRoom]         = useState<Room | null>(null);
  const [dragElem, setDragElem]         = useState<{ x: number; y: number; type: ElementType; rotation: number } | null>(null);
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);

  const [elements, setElements]         = useState<PlacedElement[]>([]);
  const [pendingElems, setPendingElems] = useState<Record<string, PlacedElement | null>>({});
  const [loadingElems, setLoadingElems] = useState(false);
  const [saving, setSaving]             = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editSelRoom, setEditSelRoom]   = useState<Room | null>(null);
  const [editSelElem, setEditSelElem]   = useState<{ x: number; y: number } | null>(null);

  // Pointer-based drag (reliable across z-layers)
  const gridRef  = useRef<HTMLDivElement>(null);
  const [dragHover, setDragHover] = useState<{ x: number; y: number } | null>(null);

  // Add-room form
  const [showAddRoom, setShowAddRoom]   = useState(false);
  const [addRoomNum, setAddRoomNum]     = useState('');
  const [addRoomType, setAddRoomType]   = useState<Room['type']>('sala');
  const [addRoomErr, setAddRoomErr]     = useState('');
  const [addingRoom, setAddingRoom]     = useState(false);

  const isPainting  = useRef(false);
  const paintAction = useRef<'add' | 'remove'>('add');
  const [paintRotation, setPaintRotation] = useState(0);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [tapToPlaceRoom, setTapToPlaceRoom] = useState<Room | null>(null);

  const floor      = floors[floorIdx] ?? null;
  const floorRooms = rooms.filter(r => r.floor === floor);
  const stayByRoom = Object.fromEntries(
    stays.filter(s => s.status === 'active').map(s => [s.room_id, s])
  );

  // ── Load elements + config ────────────────────────────────────────────────
  useEffect(() => {
    if (floor == null) return;
    setLoadingElems(true);
    Promise.all([
      getClient().from('floor_plan_elements').select('*').eq('tenant_id', tenantId).eq('floor', floor),
      getClient().from('floor_plan_config').select('*').eq('tenant_id', tenantId).eq('floor', floor).maybeSingle(),
    ]).then(([elemsRes, cfgRes]) => {
      setElements((elemsRes.data as PlacedElement[]) ?? []);
      const cols = cfgRes.data?.cols ?? DEFAULT_COLS;
      const rows = cfgRes.data?.rows ?? DEFAULT_ROWS;
      setGridCols(cols); setSavedCols(cols);
      setGridRows(rows); setSavedRows(rows);
      setPendingElems({});
      setLoadingElems(false);
    });
  }, [floor, tenantId]);

  // ── View mode: scale full grid to fill container width ───────────────────

useEffect(() => {
  if (editMode || expandedPlan) return;

  const el = viewContainerRef.current;
  if (!el) return;

  const fullW =
    GRID_PAD * 2 +
    gridCols * CELL_PX +
    (gridCols - 1) * CELL_GAP;

  const update = () => {
    const availableWidth = el.clientWidth;

    if (availableWidth > 0 && fullW > 0) {
      setViewScale(availableWidth / fullW);
    }
  };

  const observer = new ResizeObserver(update);

  observer.observe(el);
  update();

  return () => {
    observer.disconnect();
  };
}, [editMode, expandedPlan, gridCols, gridRows]);

  // ── Derived helpers ───────────────────────────────────────────────────────
  const getRoomPos = useCallback((room: Room): { x: number; y: number } | null => {
    if (room.id in pendingPos) return pendingPos[room.id];
    if (room.pos_x != null && room.pos_y != null) return { x: room.pos_x, y: room.pos_y };
    return null;
  }, [pendingPos]);

  const getRoomSize = useCallback((room: Room): RoomSize => {
    return pendingSizes[room.id] ?? { w: room.cell_width ?? 1, h: room.cell_height ?? 1 };
  }, [pendingSizes]);

  const roomOriginMap: Record<string, Room> = {};
  const coveredCells = new Set<string>();
  floorRooms.forEach(r => {
    const p = getRoomPos(r);
    if (!p) return;
    const { w, h } = getRoomSize(r);
    roomOriginMap[cellKey(p.x, p.y)] = r;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        coveredCells.add(cellKey(p.x + dx, p.y + dy));
  });

  const getElem = useCallback((x: number, y: number): PlacedElement | null => {
    const k = cellKey(x, y);
    if (k in pendingElems) return pendingElems[k];
    const found = elements.find(e => e.pos_x === x && e.pos_y === y);
    if (!found) return null;
    return { ...found, rotation: found.rotation ?? 0 };
  }, [elements, pendingElems]);

  const gridW = GRID_PAD * 2 + gridCols * CELL_PX + (gridCols - 1) * CELL_GAP;
  const gridH = GRID_PAD * 2 + gridRows * CELL_PX + (gridRows - 1) * CELL_GAP;


  // ── Grid resize helpers ───────────────────────────────────────────────────
  const canRemoveLastCol = useCallback(() => {
    const lc = gridCols - 1;
    if (lc < 3) return false;
    for (let y = 0; y < gridRows; y++) if (getElem(lc, y)) return false;
    for (const r of floorRooms) {
      const p = getRoomPos(r); if (!p) continue;
      const { w } = getRoomSize(r);
      if (p.x + w - 1 >= lc) return false;
    }
    return true;
  }, [gridCols, gridRows, getElem, floorRooms, getRoomPos, getRoomSize]);

  const canRemoveLastRow = useCallback(() => {
    const lr = gridRows - 1;
    if (lr < 3) return false;
    for (let x = 0; x < gridCols; x++) if (getElem(x, lr)) return false;
    for (const r of floorRooms) {
      const p = getRoomPos(r); if (!p) continue;
      const { h } = getRoomSize(r);
      if (p.y + h - 1 >= lr) return false;
    }
    return true;
  }, [gridRows, gridCols, getElem, floorRooms, getRoomPos, getRoomSize]);

  const cellLeft = (x: number) => GRID_PAD + x * (CELL_PX + CELL_GAP);
  const cellTop  = (y: number) => GRID_PAD + y * (CELL_PX + CELL_GAP);
  const unplacedRooms = floorRooms.filter(r => !getRoomPos(r));

  // ── Paint cells ───────────────────────────────────────────────────────────
  const paintCell = useCallback((x: number, y: number) => {
    if (!editMode) return;
    const k = cellKey(x, y);
    if (activeTool === 'eraser') { setPendingElems(prev => ({ ...prev, [k]: null })); return; }
    if (activeTool === 'select') return;
    if (coveredCells.has(k)) return;
    if (paintAction.current === 'remove') {
      setPendingElems(prev => ({ ...prev, [k]: null }));
    } else {
      const rot = ROTATABLE.includes(activeTool as ElementType) ? paintRotation : 0;
      setPendingElems(prev => ({
        ...prev,
        [k]: { floor: floor!, pos_x: x, pos_y: y, element_type: activeTool as ElementType, rotation: rot },
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, activeTool, floor, elements, pendingElems, pendingPos, pendingSizes, paintRotation]);

  const handleCellMouseDown = (x: number, y: number) => {
    if (!editMode || activeTool === 'select') return;
    isPainting.current = true;
    const existing = getElem(x, y);
    paintAction.current = (existing?.element_type === activeTool && !coveredCells.has(cellKey(x, y)))
      ? 'remove' : 'add';
    paintCell(x, y);
  };
  const handleCellMouseEnter = (x: number, y: number) => { if (isPainting.current) paintCell(x, y); };
  const handleMouseUp = () => { isPainting.current = false; };

  const handleGridTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!editMode || activeTool === 'select') return;
    e.preventDefault();
    const touch = e.touches[0];
    const cell = getGridCell(touch.clientX, touch.clientY);
    if (cell) handleCellMouseDown(cell.x, cell.y);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, activeTool, paintCell]);

  const handleGridTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!editMode || activeTool === 'select') return;
    e.preventDefault();
    const touch = e.touches[0];
    const cell = getGridCell(touch.clientX, touch.clientY);
    if (cell) handleCellMouseEnter(cell.x, cell.y);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, activeTool, paintCell]);

  const rotateElem = (x: number, y: number, rotation: number) => {
    const k = cellKey(x, y);
    const current = getElem(x, y);
    if (!current) return;
    setPendingElems(prev => ({ ...prev, [k]: { ...current, rotation } }));
  };

  // ── Drop handlers ─────────────────────────────────────────────────────────
  const canDropRoom = (room: Room, tx: number, ty: number): boolean => {
    const { w, h } = getRoomSize(room);
    if (tx + w > gridCols || ty + h > gridRows) return false;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const k = cellKey(tx + dx, ty + dy);
        if (coveredCells.has(k)) {
          const owner = floorRooms.find(r => {
            const p = getRoomPos(r); if (!p) return false;
            const { w: rw, h: rh } = getRoomSize(r);
            return (tx + dx) >= p.x && (tx + dx) < p.x + rw &&
                   (ty + dy) >= p.y && (ty + dy) < p.y + rh;
          });
          if (owner && owner.id !== room.id) return false;
        }
      }
    }
    return true;
  };

  const handleCellDrop = (tx: number, ty: number) => {
    if (dragElem) {
      const oldKey = cellKey(dragElem.x, dragElem.y);
      const newKey = cellKey(tx, ty);
      if (newKey !== oldKey && !coveredCells.has(newKey) && !getElem(tx, ty)) {
        setPendingElems(prev => ({
          ...prev,
          [oldKey]: null,
          [newKey]: { floor: floor!, pos_x: tx, pos_y: ty, element_type: dragElem.type, rotation: dragElem.rotation },
        }));
      }
      setDragElem(null);
      return;
    }
    if (!dragRoom) return;
    if (canDropRoom(dragRoom, tx, ty))
      setPendingPos(prev => ({ ...prev, [dragRoom!.id]: { x: tx, y: ty } }));
    setDragRoom(null);
  };

  const resizeRoom = (room: Room, w: number, h: number) => {
    const pos = getRoomPos(room);
    if (!pos || pos.x + w > gridCols || pos.y + h > gridRows) return;
    setPendingSizes(prev => ({ ...prev, [room.id]: { w, h } }));
  };

  const removeRoomFromGrid = (room: Room) => {
    setPendingPos(prev => ({ ...prev, [room.id]: null }));
    setEditSelRoom(null);
  };

  const deleteRoom = async (room: Room) => {
    await getClient().rpc('delete_room', {
      p_session_token: sessionToken,
      p_room_id: room.id,
    });
    setEditSelRoom(null);
    onUpdate();
  };

  const handleAddRoom = async () => {
    const num = addRoomNum.trim();
    if (!num) { setAddRoomErr('Ingresa un nombre o numero.'); return; }
    if (rooms.some(r => r.number === num)) { setAddRoomErr('Ya existe un espacio con ese nombre.'); return; }
    setAddingRoom(true); setAddRoomErr('');
    const def = SPACE_TYPES.find(t => t.value === addRoomType)!;
    const { error } = await getClient().rpc('create_room', {
      p_session_token:   sessionToken,
      p_number:          num,
      p_floor:           floor!,
      p_type:            addRoomType,
      p_capacity:        def.capacity,
      p_price_per_night: def.price,
      p_status:          'available',
    });
    setAddingRoom(false);
    if (error) { setAddRoomErr('Error al crear. Intenta de nuevo.'); return; }
    setShowAddRoom(false);
    setAddRoomNum(''); setAddRoomType('sala');
    onUpdate();
  };

  const deleteElem = (x: number, y: number) => {
    setPendingElems(prev => ({ ...prev, [cellKey(x, y)]: null }));
    setEditSelElem(null);
  };

  // Calculate grid cell (col, row) from client pointer coordinates
  const getGridCell = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const step = CELL_PX + CELL_GAP;
    const col = Math.floor((clientX - rect.left - GRID_PAD) / step);
    const row = Math.floor((clientY - rect.top  - GRID_PAD) / step);
    if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return null;
    return { x: col, y: row };
  };

  // Global pointer listeners active only while dragging a room or element
  useEffect(() => {
    if (!dragRoom && !dragElem) return;

    const onMove = (e: PointerEvent) => {
      setDragHover(getGridCell(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const cell = getGridCell(e.clientX, e.clientY);
      if (cell) handleCellDrop(cell.x, cell.y);
      else { setDragRoom(null); setDragElem(null); }
      setDragHover(null);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragRoom, dragElem]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true);
    const roomUpdates = floorRooms.map(room => {
      const p = getRoomPos(room);
      const { w, h } = getRoomSize(room);
      return getClient().from('rooms').update({
        pos_x: p?.x ?? null, pos_y: p?.y ?? null,
        cell_width: w, cell_height: h,
      }).eq('id', room.id);
    });
    const toDelete: string[] = [];
    const toUpsert: Omit<PlacedElement, 'id'>[] = [];
    Object.entries(pendingElems).forEach(([key, elem]) => {
      const [xs, ys] = key.split(',');
      if (elem === null) {
        const ex = elements.find(e => e.pos_x === +xs && e.pos_y === +ys);
        if (ex?.id) toDelete.push(ex.id);
      } else {
        toUpsert.push({ floor: floor!, pos_x: elem.pos_x, pos_y: elem.pos_y, element_type: elem.element_type, rotation: elem.rotation ?? 0, tenant_id: tenantId } as Omit<PlacedElement, 'id'> & { tenant_id: string });
      }
    });
    await Promise.all([
      ...roomUpdates,
      toDelete.length ? getClient().from('floor_plan_elements').delete().in('id', toDelete) : Promise.resolve(),
      toUpsert.length ? getClient().from('floor_plan_elements').upsert(toUpsert, { onConflict: 'tenant_id,floor,pos_x,pos_y' }) : Promise.resolve(),
      getClient().from('floor_plan_config').upsert({ floor: floor!, cols: gridCols, rows: gridRows, tenant_id: tenantId }, { onConflict: 'tenant_id,floor' }),
    ]);
    const { data } = await getClient().from('floor_plan_elements').select('*').eq('tenant_id', tenantId).eq('floor', floor!);
    setElements((data as PlacedElement[]) ?? []);
    setSavedCols(gridCols); setSavedRows(gridRows);
    setPendingElems({}); setPendingPos({}); setPendingSizes({});
    setEditSelRoom(null); setEditSelElem(null);
    setSaving(false); setEditMode(false);
    onUpdate();
  };

  const cancelEdit = () => {
    setGridCols(savedCols); setGridRows(savedRows);
    setPendingPos({}); setPendingElems({}); setPendingSizes({});
    setEditMode(false); setActiveTool('select');
    setEditSelRoom(null); setEditSelElem(null); setTapToPlaceRoom(null);
  };

  const enterEdit = () => {
    setPendingPos({}); setPendingElems({}); setPendingSizes({});
    setEditMode(true); setActiveTool('select');
    setSelectedRoom(null); setEditSelRoom(null); setEditSelElem(null); setTapToPlaceRoom(null);
  };

  const selElemData = editSelElem ? getElem(editSelElem.x, editSelElem.y) : null;

  if (floors.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
        <p className="text-gray-400">No hay habitaciones registradas</p>
      </div>
    );
  }

  // ── Shared grid renderer ──────────────────────────────────────────────────
  const gridContent = (
    <div ref={gridRef}
      className={`relative ${editMode ? 'bg-slate-50' : 'bg-white'}`}
      style={{
        width: gridW, height: gridH,
        touchAction: editMode && activeTool !== 'select' ? 'none' : undefined,
      }}
      onTouchStart={handleGridTouchStart}
      onTouchMove={handleGridTouchMove}
      onTouchEnd={() => handleMouseUp()}>
      {/* Cell grid */}
      <div className="absolute inset-0" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, ${CELL_PX}px)`,
        gridTemplateRows: `repeat(${gridRows}, ${CELL_PX}px)`,
        gap: CELL_GAP, padding: GRID_PAD,
      }}>
        {Array.from({ length: gridRows }, (_, y) =>
          Array.from({ length: gridCols }, (_, x) => {
            const k = cellKey(x, y);
            const elem = getElem(x, y);
            const isCovered = coveredCells.has(k);
            const isElemSel = editSelElem?.x === x && editSelElem?.y === y;
            const isDragging = dragElem?.x === x && dragElem?.y === y;
            const rot = elem?.rotation ?? 0;
            const isDropTarget = !!(dragHover && (dragRoom || dragElem) && (() => {
              if (dragRoom) {
                const { w, h } = getRoomSize(dragRoom);
                return x >= dragHover.x && x < dragHover.x + w &&
                       y >= dragHover.y && y < dragHover.y + h;
              }
              return dragHover.x === x && dragHover.y === y;
            })());
            const dropValid = isDropTarget && (
              dragRoom  ? canDropRoom(dragRoom, dragHover!.x, dragHover!.y) :
              dragElem  ? (dragElem.x !== x || dragElem.y !== y) && !coveredCells.has(k) && !elem :
              false
            );

            // Tap-to-place: highlight cells where the room could be dropped
            const isTapTarget = !!(tapToPlaceRoom && !isCovered && !elem && editMode && activeTool === 'select');
            const tapDropValid = isTapTarget && canDropRoom(tapToPlaceRoom!, x, y);

            let cursor = 'cursor-default';
            if (editMode) {
              if (tapToPlaceRoom && activeTool === 'select') cursor = isTapTarget ? (tapDropValid ? 'cursor-copy' : 'cursor-not-allowed') : 'cursor-default';
              else if (activeTool === 'select') cursor = elem && !isCovered ? 'cursor-grab' : 'cursor-default';
              else if (activeTool === 'eraser') cursor = 'cursor-cell';
              else cursor = 'cursor-crosshair';
            }

            let cls = '';
            if (!isCovered) {
              if (elem) {
                if (elem.element_type === 'wall')    cls = 'relative overflow-visible bg-transparent';
                else if (elem.element_type === 'hallway') cls = 'bg-slate-100 border-y border-slate-200 flex items-center justify-center';
                else if (elem.element_type === 'window')  cls = `relative overflow-hidden ${EC.window.cellBg} border ${EC.window.cellBorder}`;
                else if (elem.element_type === 'stairs')  cls = `relative overflow-hidden ${EC.stairs.cellBg} border ${EC.stairs.cellBorder}`;
                else cls = `rounded-md border ${EC[elem.element_type].cellBorder} ${EC[elem.element_type].cellBg} flex items-center justify-center`;
                if (isElemSel) cls += ' ring-2 ring-gray-900 ring-offset-1 z-10';
                if (isDragging) cls += ' opacity-25';
              } else if (editMode) {
                if (isTapTarget && tapToPlaceRoom) {
                  cls = tapDropValid
                    ? 'rounded-md border-2 border-dashed border-emerald-400 bg-emerald-50 hover:bg-emerald-100 transition-colors'
                    : 'rounded-md border border-dashed border-gray-200 bg-white/50';
                } else {
                  cls = 'rounded-md border border-dashed border-gray-200 bg-white/50 hover:bg-white hover:border-gray-300 transition-colors';
                }
              }
            }
            if (isDropTarget) {
              cls += dropValid
                ? ' !bg-emerald-100 !border-emerald-400 !border-2 z-30'
                : ' !bg-red-100 !border-red-400 !border-2 z-30';
            }

            return (
              <div key={k} className={`${cls} ${cursor}`}
                onPointerDown={editMode && activeTool === 'select' && !!elem && !isCovered
                  ? (e) => { e.preventDefault(); e.stopPropagation(); setDragElem({ x, y, type: elem.element_type, rotation: rot }); setEditSelElem(null); }
                  : undefined}
                onMouseDown={() => handleCellMouseDown(x, y)}
                onMouseEnter={() => handleCellMouseEnter(x, y)}
                onClick={editMode && activeTool === 'select'
                  ? () => {
                      if (tapToPlaceRoom && !isCovered && !elem) {
                        if (tapDropValid) {
                          setPendingPos(prev => ({ ...prev, [tapToPlaceRoom.id]: { x, y } }));
                        }
                        setTapToPlaceRoom(null);
                        return;
                      }
                      if (elem && !isCovered) {
                        setEditSelElem(p => p?.x === x && p?.y === y ? null : { x, y });
                        setEditSelRoom(null);
                      }
                    }
                  : undefined}
              >
                {elem?.element_type === 'wall'     && <WallCell x={x} y={y} getElem={getElem} />}
                {elem?.element_type === 'window'   && <WindowCell rotation={rot} />}
                {elem?.element_type === 'stairs'   && <StairsCell rotation={rot} />}
                {elem?.element_type === 'door'     && <DoorCell rotation={rot} />}
                {elem?.element_type === 'hallway'  && <div className="w-3/4 h-px bg-slate-400 mx-auto" />}
                {elem?.element_type === 'elevator' && <ArrowUpDown size={17} className="text-blue-700" strokeWidth={1.5} />}
                {isElemSel && (
                  <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-gray-900 rounded-sm flex items-center justify-center pointer-events-none z-20">
                    <Move size={7} className="text-white" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Room overlays */}
      {floorRooms.map(room => {
        const pos = getRoomPos(room);
        if (!pos) return null;
        const { w, h } = getRoomSize(room);
        const isGuestRoom         = GUEST_TYPES.has(room.type);
        const activeStay          = stayByRoom[room.id];
        const isOccupied          = room.status === 'occupied';
        const effectivelyOccupied = isOccupied || !!activeStay;
        const salenHoy            = isGuestRoom && isLeavingToday(activeStay);

        const typeStyle = TYPE_OVERRIDE[room.type];
        const effectiveStatus = !typeStyle && effectivelyOccupied && !isOccupied ? 'occupied' : room.status;
        const s = typeStyle ?? RS[effectiveStatus];
        const isViewSel  = !editMode && selectedRoom?.id === room.id;
        const isEditSel  = editMode && activeTool === 'select' && editSelRoom?.id === room.id;
        const isTapReady = editMode && activeTool === 'select' && tapToPlaceRoom?.id === room.id;
        const left   = cellLeft(pos.x);
        const top    = cellTop(pos.y);
        const width  = w * CELL_PX + (w - 1) * CELL_GAP;
        const height = h * CELL_PX + (h - 1) * CELL_GAP;
        const cursor = editMode ? (activeTool === 'select' ? 'cursor-grab' : 'cursor-default') : 'cursor-pointer';

        return (
          <div key={room.id} className="absolute" style={{
            left, top, width, height, zIndex: isViewSel || isEditSel || isTapReady ? 20 : 10,
            touchAction: editMode && activeTool === 'select' ? 'none' : undefined,
          }}>
            {/* X delete button — only in edit mode */}
            {editMode && (
              <button
                className="absolute -top-2 -right-2 z-30 w-5 h-5 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); removeRoomFromGrid(room); }}
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            )}
            {/* Tap-to-move indicator badge */}
            {isTapReady && (
              <div className="absolute -top-2 -left-2 z-30 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-bold shadow pointer-events-none">
                toca celda
              </div>
            )}
            <div
              className={`w-full h-full shadow-sm flex flex-col overflow-hidden transition-all rounded-lg border-2
                ${editMode
                  ? isGuestRoom ? 'bg-gray-50 border-gray-300' : `${s.bg} ${s.border}`
                  : isGuestRoom
                    ? salenHoy ? 'bg-blue-50 border-blue-400' : `bg-white ${s.border}`
                    : `${s.bg} ${s.border}`}
                ${isTapReady
                  ? 'ring-2 ring-offset-1 ring-blue-500 scale-[1.03]'
                  : isViewSel || isEditSel ? 'ring-2 ring-offset-1 ring-gray-900 scale-[1.03]' : 'hover:brightness-95'}
                ${cursor}`}
              onPointerDown={editMode && activeTool === 'select'
                ? (e) => {
                    e.preventDefault(); e.stopPropagation();
                    pointerDownAt.current = { x: e.clientX, y: e.clientY };
                    setDragRoom(room); setEditSelRoom(room); setEditSelElem(null);
                  }
                : undefined}
              onClick={editMode && activeTool === 'select'
                ? (e) => {
                    const d = pointerDownAt.current;
                    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
                    // Toggle tap-to-place mode for this room
                    setTapToPlaceRoom(r => r?.id === room.id ? null : room);
                    setEditSelRoom(r => r?.id === room.id ? null : room);
                    setEditSelElem(null);
                  }
                : !editMode ? () => setSelectedRoom(r => r?.id === room.id ? null : room)
                : undefined}
            >
              {editMode ? (
                /* ── Edit mode: minimal label ── */
                <div className="flex flex-col items-center justify-center h-full gap-px px-0.5">
                  <span className={`font-black leading-none text-center truncate w-full text-center ${isGuestRoom ? 'text-gray-700' : s.text}`}
                    style={{ fontSize: Math.min(13, Math.max(8, width * 0.22)) }}>
                    {room.number}
                  </span>
                  <span className={`leading-none opacity-60 truncate w-full text-center ${isGuestRoom ? 'text-gray-500' : s.text}`}
                    style={{ fontSize: Math.min(8, Math.max(6, width * 0.12)) }}>
                    {TYPE_LABEL[room.type]}
                  </span>
                </div>
          ) : isGuestRoom ? (
  /* ── View mode: guest room card ── */
  <div className="flex flex-col h-full p-1 gap-px">
    {/* Número y estado */}
    <div className="flex items-start justify-between gap-0.5 min-w-0">
      <span
  className="font-black text-gray-900 leading-none truncate"
  style={{
    fontSize: expandedPlan
      ? Math.min(17, Math.max(10, width * 0.15))
      : Math.min(16, Math.max(9, width * 0.15)),
  }}
>
  {room.number}
</span>

      {width >= 60 && (
        <span
          className={`${
            salenHoy ? 'bg-blue-500' : STATUS_BADGE[room.status]
          } text-white font-bold rounded-full leading-none shrink-0`}
          style={{
            fontSize: expandedPlan
              ? Math.min(10, Math.max(7, width * 0.1))
              : Math.min(7, Math.max(5, width * 0.08)),
            padding: expandedPlan ? '3px 6px' : '1px 4px',
          }}
        >
          {salenHoy ? 'Salen hoy' : STATUS_LABEL[room.status]}
        </span>
      )}
    </div>

    {/* Tipo */}
    <span
      className="text-gray-600 font-bold tracking-wider leading-none truncate"
      style={{
        fontSize: expandedPlan
          ? Math.min(11, Math.max(8, width * 0.12))
          : Math.min(7, Math.max(5, width * 0.09)),
      }}
    >
      {TYPE_LABEL[room.type]}
    </span>

    {/* Huésped */}
    {height >= 70 && effectivelyOccupied && activeStay && (
      <div
        className={`rounded px-0.5 py-px border min-w-0 mt-px ${
          salenHoy
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-100'
        }`}
      >
        <p
          className="font-semibold text-gray-800 truncate leading-tight"
          style={{
            fontSize: expandedPlan
              ? Math.min(11, Math.max(8, width * 0.12))
              : Math.min(7, Math.max(5, width * 0.09)),
          }}
        >
          {activeStay.guests.name}
        </p>

        {(activeStay.empresa || salenHoy) && height >= 85 && (
          <p
            className="text-blue-700 font-medium truncate leading-tight"
            style={{
              fontSize: expandedPlan
                ? Math.min(10, Math.max(7, width * 0.1))
                : Math.min(6, Math.max(5, width * 0.08)),
            }}
          >
            {activeStay.empresa || 'Particular'}
          </p>
        )}

        {salenHoy && height >= 85 && (
          <p
            className="text-blue-600 font-bold truncate leading-tight"
            style={{
              fontSize: expandedPlan
                ? Math.min(10, Math.max(7, width * 0.1))
                : Math.min(6, Math.max(5, width * 0.08)),
            }}
          >
            Salen hoy
          </p>
        )}
      </div>
    )}

    {height >= 70 &&
      !effectivelyOccupied &&
      room.status === 'cleaning' && (
        <span
          className="text-blue-400 italic leading-none truncate"
          style={{
            fontSize: expandedPlan
              ? Math.min(10, Math.max(7, width * 0.1))
              : Math.min(6, Math.max(5, width * 0.08)),
          }}
        >
          En limpieza
        </span>
      )}

    {height >= 70 && room.status === 'maintenance' && (
      <span
        className="text-amber-600 italic leading-none truncate"
        style={{
          fontSize: expandedPlan
            ? Math.min(10, Math.max(7, width * 0.1))
            : Math.min(6, Math.max(5, width * 0.08)),
        }}
      >
        Mantenimiento
      </span>
    )}

    {/* Botón */}
    {height >= 100 && (
      <div className="mt-auto">
        {effectivelyOccupied ? (
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              onCheckOut(room, activeStay);
            }}
            className="w-full flex items-center justify-center gap-0.5 border border-red-500 text-red-500 rounded font-semibold hover:bg-red-50 transition-colors"
            style={{
              fontSize: expandedPlan
                ? Math.min(11, width * 0.12)
                : Math.min(7, width * 0.09),
              padding: expandedPlan ? '4px 0' : '1px 0',
            }}
          >
            <LogOut
              style={{
                width: expandedPlan ? 11 : 7,
                height: expandedPlan ? 11 : 7,
              }}
            />
            Salida
          </button>
        ) : room.status === 'available' ? (
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              onCheckIn(room);
            }}
            className="w-full flex items-center justify-center gap-0.5 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition-colors"
            style={{
              fontSize: expandedPlan
                ? Math.min(11, width * 0.12)
                : Math.min(7, width * 0.09),
              padding: expandedPlan ? '4px 0' : '1px 0',
            }}
          >
            <LogIn
              style={{
                width: expandedPlan ? 11 : 7,
                height: expandedPlan ? 11 : 7,
              }}
            />
            Ingreso
          </button>
        ) : null}
      </div>
    )}
  </div>
) : (
  /* ── View mode: sala, tienda, lavandería, almacén ── */
  <div className="flex flex-col items-center justify-center h-full gap-px px-0.5">
    <span
      className={`font-black leading-none text-center truncate w-full ${s.text}`}
      style={{
        fontSize: expandedPlan
          ? Math.min(
              18,
              Math.max(
                11,
                (width / Math.max(room.number.length, 1)) * 0.65
              )
            )
          : Math.min(
              13,
              Math.max(
                8,
                (width / Math.max(room.number.length, 1)) * 0.5
              )
            ),
      }}
    >
      {room.number}
    </span>

    <span
      className={`font-bold leading-none opacity-70 truncate w-full text-center ${s.text}`}
      style={{
        fontSize: expandedPlan
          ? Math.min(11, Math.max(8, width * 0.12))
          : Math.min(7, Math.max(5, width * 0.09)),
      }}
    >
      {TYPE_LABEL[room.type]}
    </span>
  </div>
)}
            </div>
          </div>
        );
      })}
    </div>
  );
return (
  <div
    className="space-y-4 select-none"
    onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp}
  >
    {/* ── Top bar ── */}
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => {
            setFloorIdx(i => Math.max(0, i - 1));
            setSelectedRoom(null);
          }}
          disabled={floorIdx === 0}
          className="p-2.5 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>

        {floors.map((f, i) => (
          <button
            type="button"
            key={f}
            onClick={() => {
              setFloorIdx(i);
              setSelectedRoom(null);
            }}
            className={`px-3 py-2.5 text-sm font-semibold transition-colors ${
              i === floorIdx
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            P{f}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            setFloorIdx(i => Math.min(floors.length - 1, i + 1));
            setSelectedRoom(null);
          }}
          disabled={floorIdx === floors.length - 1}
          className="p-2.5 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="px-2.5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-xs text-gray-500 font-medium hidden sm:block">
        {gridCols} × {gridRows}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {!editMode ? (
          <>
            {/* Solo escritorio */}
            <button
  type="button"
  onClick={() => {
    setExpandedPlan(value => !value);
    setSelectedRoom(null);
  }}
  className="hidden lg:flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm"
>
  {expandedPlan ? (
    <Minus className="w-4 h-4" />
  ) : (
    <Move className="w-4 h-4" />
  )}

  {expandedPlan ? 'Vista normal' : 'Ampliar plano'}
</button>

            {canEdit && (
              <button
                type="button"
                onClick={enterEdit}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm font-medium shadow-sm"
              >
                <Pencil className="w-4 h-4" />
                <span>Editar plano</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cancelar</span>
            </button>

            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </>
        )}
      </div>
    </div>

    {/* ── Edit mode tools + grid controls ── */}
    {editMode && (
      <div className="space-y-2">
        {/* Herramientas */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 px-3 py-2.5 min-w-max">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-1 shrink-0 hidden sm:block">
                Herramienta
              </span>

              {TOOLS.map(tool => {
                const isActive = activeTool === tool;

                const cfg =
                  tool !== 'select' && tool !== 'eraser'
                    ? EC[tool as ElementType]
                    : null;

                const idle =
                  tool === 'select'
                    ? 'bg-white text-gray-600 border-gray-300'
                    : tool === 'eraser'
                      ? 'bg-red-50 text-red-600 border-red-300'
                      : cfg!.btnIdle;

                const active =
                  tool === 'select'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : tool === 'eraser'
                      ? 'bg-red-500 text-white border-red-500'
                      : cfg!.btnActive;

                return (
                  <button
                    type="button"
                    key={tool}
                    onClick={() => {
                      setActiveTool(tool);
                      setEditSelRoom(null);
                      setEditSelElem(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
                      isActive ? active : idle
                    }`}
                  >
                    {tool === 'select' && (
                      <MousePointer className="w-4 h-4" />
                    )}

                    {tool === 'wall' && (
                      <div className="w-3.5 h-2 bg-current rounded-sm" />
                    )}

                    {tool === 'hallway' && (
                      <div className="w-3.5 h-0.5 bg-current rounded" />
                    )}

                    {tool === 'door' && (
                      <DoorOpen className="w-4 h-4" />
                    )}

                    {tool === 'window' && (
                      <svg width="14" height="12" viewBox="0 0 12 10">
                        <rect
                          x="0"
                          y="0"
                          width="12"
                          height="10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="0"
                          y1="3.5"
                          x2="12"
                          y2="3.5"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <line
                          x1="0"
                          y1="6.5"
                          x2="12"
                          y2="6.5"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                      </svg>
                    )}

                    {tool === 'stairs' && (
                      <svg width="14" height="14" viewBox="0 0 14 14">
                        <rect
                          x="1"
                          y="1"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />

                        {[3, 5.5, 8].map(y => (
                          <line
                            key={y}
                            x1="1"
                            y1={y}
                            x2="13"
                            y2={y}
                            stroke="currentColor"
                            strokeWidth="0.8"
                          />
                        ))}

                        <line
                          x1="7"
                          y1="2"
                          x2="7"
                          y2="8"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />

                        <polyline
                          points="5,4 7,1.5 9,4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}

                    {tool === 'elevator' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}

                    {tool === 'eraser' && (
                      <Eraser className="w-4 h-4" />
                    )}

                    <span className="hidden sm:inline">
                      {tool === 'select'
                        ? 'Mover'
                        : tool === 'eraser'
                          ? 'Borrar'
                          : cfg!.label}
                    </span>
                  </button>
                );
              })}

              {activeTool !== 'select' &&
                activeTool !== 'eraser' &&
                ROTATABLE.includes(activeTool as ElementType) && (
                  <div className="flex items-center gap-1 ml-1 pl-2 border-l border-gray-200 shrink-0">
                    <RotateCw className="w-3.5 h-3.5 text-gray-400 mr-0.5" />

                    {[0, 90, 180, 270].map(r => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setPaintRotation(r)}
                        className={`px-2 py-1.5 rounded text-[11px] font-semibold border transition-all ${
                          paintRotation === r
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {ROT_LABELS[r]}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Tamaño de cuadrícula */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest shrink-0 hidden sm:block">
            Cuadrícula
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500 font-medium">
              Col:
            </span>

            <ResizeBtn
              icon="minus"
              label=""
              onClick={() => setGridCols(c => c - 1)}
              disabled={!canRemoveLastCol()}
            />

            <span className="text-sm font-bold text-gray-700 tabular-nums w-6 text-center">
              {gridCols}
            </span>

            <ResizeBtn
              icon="plus"
              label=""
              onClick={() => setGridCols(c => c + 1)}
            />
          </div>

          <div className="w-px h-5 bg-gray-200 shrink-0" />

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500 font-medium">
              Fil:
            </span>

            <ResizeBtn
              icon="minus"
              label=""
              onClick={() => setGridRows(r => r - 1)}
              disabled={!canRemoveLastRow()}
            />

            <span className="text-sm font-bold text-gray-700 tabular-nums w-6 text-center">
              {gridRows}
            </span>

            <ResizeBtn
              icon="plus"
              label=""
              onClick={() => setGridRows(r => r + 1)}
            />
          </div>

          <span className="text-[11px] text-gray-400 ml-auto shrink-0">
            {gridCols}×{gridRows}
          </span>
        </div>
      </div>
    )}

    {/* ── VIEW MODE: vista normal o ampliada dentro de la sección ── */}
{!editMode && (
  <div
    className={`w-full rounded-2xl border border-gray-200 shadow-sm bg-white ${
      expandedPlan
        ? 'overflow-auto'
        : 'overflow-hidden'
    }`}
  >
    {loadingElems ? (
      <div className="flex items-center justify-center h-64 bg-white">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    ) : expandedPlan ? (
      <div
        className="flex justify-center p-4"
        style={{
          minHeight: Math.min(gridH, 850),
        }}
      >
        <div
          style={{
            width: gridW,
            height: gridH,
            flexShrink: 0,
          }}
        >
          {gridContent}
        </div>
      </div>
    ) : (
      <div
        ref={viewContainerRef}
        style={{
          height: gridH * viewScale,
        }}
      >
        <div
          style={{
            width: gridW,
            height: gridH,
            transform: `scale(${viewScale})`,
            transformOrigin: 'top left',
          }}
        >
          {gridContent}
        </div>
      </div>
    )}
  </div>
)}

    {/* ── EDIT MODE: grid + side panel ── */}
    {editMode && (
      <div className="flex gap-5 flex-wrap lg:flex-nowrap">
        <div className="flex-1 min-w-0 overflow-auto">
          {tapToPlaceRoom && (
            <div className="mb-2 flex items-center justify-between gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Move className="w-4 h-4 shrink-0" />

                Toca una celda para colocar

                <span className="bg-white/20 px-1.5 py-0.5 rounded font-black">
                  {tapToPlaceRoom.number}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setTapToPlaceRoom(null)}
                className="shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loadingElems ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-200">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 shadow-sm overflow-auto">
              {gridContent}
            </div>
          )}

          <button
            type="button"
            onClick={() => setSidePanelOpen(v => !v)}
            className="lg:hidden mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 shadow-sm"
          >
            {sidePanelOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}

            {sidePanelOpen ? 'Cerrar panel' : 'Espacios y opciones'}
          </button>
        </div>

        {/* Panel lateral */}
        <div
          className={`w-full lg:w-60 shrink-0 space-y-3 ${
            sidePanelOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Elemento seleccionado */}
          {activeTool === 'select' &&
            editSelElem &&
            selElemData && (
              <div
                className={`rounded-xl border-2 p-4 ${
                  EC[selElemData.element_type].cellBg || 'bg-white'
                } ${EC[selElemData.element_type].cellBorder}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p
                    className={`font-bold text-sm ${
                      EC[selElemData.element_type].textColor
                    }`}
                  >
                    {EC[selElemData.element_type].label}
                  </p>

                  <button
                    type="button"
                    onClick={() => setEditSelElem(null)}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  >
                    &times;
                  </button>
                </div>

                {ROTATABLE.includes(selElemData.element_type) && (
                  <>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <RotateCw className="w-3 h-3" />
                      Rotación
                    </p>

                    <div className="grid grid-cols-4 gap-1 mb-3">
                      {[0, 90, 180, 270].map(r => (
                        <button
                          type="button"
                          key={r}
                          onClick={() =>
                            rotateElem(
                              editSelElem.x,
                              editSelElem.y,
                              r
                            )
                          }
                          className={`text-[10px] font-semibold py-1.5 rounded border transition-all ${
                            (selElemData.rotation ?? 0) === r
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          {ROT_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p className="text-[10px] text-gray-400 mb-3">
                  Arrastra para mover a otra celda.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    deleteElem(editSelElem.x, editSelElem.y)
                  }
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white/70 hover:bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold"
                >
                  <Trash2 className="w-3 h-3" />
                  Eliminar
                </button>
              </div>
            )}

          {/* Habitación seleccionada */}
          {activeTool === 'select' &&
            editSelRoom &&
            !editSelElem &&
            (() => {
              const typeStyle = TYPE_OVERRIDE[editSelRoom.type];
              const s = typeStyle ?? RS[editSelRoom.status];
              const { w: cw, h: ch } = getRoomSize(editSelRoom);
              const pos = getRoomPos(editSelRoom);
              const maxW = pos ? gridCols - pos.x : gridCols;
              const maxH = pos ? gridRows - pos.y : gridRows;

              return (
                <div
                  className={`rounded-xl border-2 p-4 ${s.bg} ${s.border}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={`font-black text-sm ${s.text}`}>
                        {editSelRoom.number}
                      </p>

                      <p className="text-[10px] text-gray-400 capitalize">
                        {editSelRoom.type}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditSelRoom(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >
                      &times;
                    </button>
                  </div>

                  <SizePicker
                    currentW={cw}
                    currentH={ch}
                    maxW={maxW}
                    maxH={maxH}
                    onChange={(w, h) =>
                      resizeRoom(editSelRoom, w, h)
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeRoomFromGrid(editSelRoom)
                    }
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 bg-white/70 hover:bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold"
                  >
                    <Trash2 className="w-3 h-3" />
                    Quitar del plano
                  </button>
                </div>
              );
            })()}

          {/* Crear espacio */}
          {activeTool === 'select' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {!showAddRoom ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRoom(true);
                    setAddRoomErr('');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar espacio
                </button>
              ) : (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Nuevo espacio
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRoom(false);
                        setAddRoomErr('');
                        setAddRoomNum('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                      Nombre / número
                    </label>

                    <input
                      type="text"
                      value={addRoomNum}
                      onChange={e => {
                        setAddRoomNum(e.target.value);
                        setAddRoomErr('');
                      }}
                      placeholder="Ej: Sala 1, Lavandería, 201"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddRoom();
                        }
                      }}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                      Tipo
                    </label>

                    <div className="grid grid-cols-2 gap-1">
                      {SPACE_TYPES.map(t => {
                        const ovr = TYPE_OVERRIDE[t.value];
                        const active = addRoomType === t.value;

                        return (
                          <button
                            type="button"
                            key={t.value}
                            onClick={() =>
                              setAddRoomType(t.value)
                            }
                            className={`px-2 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all text-left ${
                              active
                                ? ovr
                                  ? `${ovr.bg} ${ovr.border} ${ovr.text}`
                                  : 'bg-gray-900 border-gray-900 text-white'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {addRoomErr && (
                    <p className="text-xs text-red-500">
                      {addRoomErr}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleAddRoom}
                    disabled={addingRoom || !addRoomNum.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {addingRoom ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}

                    {addingRoom ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Habitaciones sin ubicar */}
          {activeTool === 'select' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Sin ubicar ({unplacedRooms.length})
              </p>

              {unplacedRooms.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Todas ubicadas
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-gray-400 mb-2">
                    Toca un espacio y luego una celda del plano.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {unplacedRooms.map(room => {
                      const typeStyle = TYPE_OVERRIDE[room.type];
                      const s = typeStyle ?? RS[room.status];
                      const isActive =
                        tapToPlaceRoom?.id === room.id;

                      return (
                        <div
                          key={room.id}
                          onPointerDown={e => {
                            e.preventDefault();
                            setDragRoom(room);
                            setEditSelElem(null);
                            setTapToPlaceRoom(null);
                          }}
                          onClick={e => {
                            e.stopPropagation();

                            setTapToPlaceRoom(current =>
                              current?.id === room.id
                                ? null
                                : room
                            );

                            setEditSelRoom(null);
                            setEditSelElem(null);
                          }}
                          className={`px-2.5 py-2 rounded-lg border-2 text-xs font-bold cursor-pointer select-none transition-all ${
                            isActive
                              ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-300 scale-105'
                              : `${s.bg} ${s.border} ${s.text} cursor-grab`
                          }`}
                        >
                          {room.number}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Herramienta de pintura */}
          {activeTool !== 'select' &&
            activeTool !== 'eraser' && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Pintando
                </p>

                <div
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    EC[activeTool as ElementType].cellBg
                  } ${
                    EC[activeTool as ElementType].cellBorder
                  }`}
                >
                  <div className="w-8 h-8 relative flex items-center justify-center shrink-0">
                    {activeTool === 'stairs' && (
                      <StairsCell rotation={paintRotation} />
                    )}

                    {activeTool === 'window' && (
                      <WindowCell rotation={paintRotation} />
                    )}

                    {activeTool === 'door' && (
                      <DoorCell rotation={paintRotation} />
                    )}

                    {activeTool === 'wall' && (
                      <div className="w-5 h-2 bg-gray-800 rounded-sm" />
                    )}

                    {activeTool === 'hallway' && (
                      <div className="w-5 h-px bg-slate-400" />
                    )}

                    {activeTool === 'elevator' && (
                      <ArrowUpDown
                        size={17}
                        className="text-blue-700"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>

                  <span
                    className={`text-sm font-bold ${
                      EC[activeTool as ElementType].textColor
                    }`}
                  >
                    {EC[activeTool as ElementType].label}
                  </span>
                </div>

                <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                  Clic o arrastra para pintar.
                </p>
              </div>
            )}

          <LegendPanel />

          <FloorSummary
            floor={floor}
            floorRooms={floorRooms}
            leavingTodayCount={
              floorRooms.filter(room =>
                isLeavingToday(stayByRoom[room.id])
              ).length
            }
          />
        </div>
      </div>
    )}

    {/* ── Información inferior ── */}
    {!editMode && !loadingElems && (
      <div className="flex gap-4 flex-wrap">
        <LegendPanel />

        <FloorSummary
          floor={floor}
          floorRooms={floorRooms}
          leavingTodayCount={
            floorRooms.filter(room =>
              isLeavingToday(stayByRoom[room.id])
            ).length
          }
        />
      </div>
    )}

    {/* ── Detalle de habitación ── */}
    {!editMode && selectedRoom && (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-64 z-[110] shadow-2xl">
        <RoomDetailCard
          room={selectedRoom}
          stay={stayByRoom[selectedRoom.id]}
          onCheckIn={() => {
            setSelectedRoom(null);
            onCheckIn(selectedRoom);
          }}
          onCheckOut={() => {
            setSelectedRoom(null);
            onCheckOut(
              selectedRoom,
              stayByRoom[selectedRoom.id]
            );
          }}
          onClose={() => setSelectedRoom(null)}
        />
      </div>
    )}

    {/* ── Pantalla completa: solo escritorio ── */}
    
  </div>
);
}
// ── Legend ────────────────────────────────────────────────────────────────────
function LegendPanel() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Leyenda</p>
      <div className="space-y-2">
        {(Object.entries(RS) as [Room['status'], typeof RS[Room['status']]][]).map(([st, s]) => (
          <div key={st} className="flex items-center gap-2 text-xs text-gray-600">
            <span className={`w-4 h-4 rounded border-2 shrink-0 ${s.bg} ${s.border}`} />
            {st === 'available' ? 'Disponible' : st === 'occupied' ? 'Ocupado' :
             st === 'maintenance' ? 'Mantenimiento' : 'Limpieza'}
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold">
          <span className="w-4 h-4 rounded border-2 shrink-0 bg-blue-50 border-blue-400" />
          Salen hoy
        </div>
        {(Object.entries(TYPE_OVERRIDE) as [Room['type'], typeof RS[Room['status']]][]).map(([type, s]) => (
          <div key={type} className="flex items-center gap-2 text-xs text-gray-600">
            <span className={`w-4 h-4 rounded border-2 shrink-0 ${s.bg} ${s.border}`} />
            {type === 'sala' ? 'Sala' : type === 'lavanderia' ? 'Lavanderia' : 'Almacen'}
          </div>
        ))}
        <div className="border-t border-gray-100 pt-2 mt-2 space-y-2">
          {(Object.keys(EC) as ElementType[]).map(type => (
            <div key={type} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-4 h-4 shrink-0 relative flex items-center justify-center overflow-visible">
                {type === 'wall'     && <div className="w-3 h-1.5 bg-gray-800 rounded-sm" />}
                {type === 'hallway'  && <div className="w-3 h-px bg-slate-400" />}
                {type === 'door'     && <DoorOpen size={12} className="text-orange-500" />}
                {type === 'window'   && (
                  <svg width="12" height="10" viewBox="0 0 12 10">
                    <rect x="0.5" y="0.5" width="11" height="9" fill="none" stroke="#0891b2" strokeWidth="1"/>
                    <line x1="0.5" y1="3.5" x2="11.5" y2="3.5" stroke="#06b6d4" strokeWidth="0.8"/>
                    <line x1="0.5" y1="6.5" x2="11.5" y2="6.5" stroke="#06b6d4" strokeWidth="0.8"/>
                  </svg>
                )}
                {type === 'stairs'   && (
                  <svg width="13" height="13" viewBox="0 0 14 14">
                    <rect x="1" y="1" width="12" height="12" fill="none" stroke="#78716c" strokeWidth="1"/>
                    {[3.5,6,8.5].map(y=><line key={y} x1="1" y1={y} x2="13" y2={y} stroke="#78716c" strokeWidth="0.8"/>)}
                    <line x1="7" y1="2" x2="7" y2="7" stroke="#57534e" strokeWidth="1"/>
                    <polyline points="5,4.5 7,2 9,4.5" fill="none" stroke="#57534e" strokeWidth="1" strokeLinejoin="round"/>
                  </svg>
                )}
                {type === 'elevator' && <ArrowUpDown size={12} className="text-blue-600" />}
              </span>
              {EC[type].label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Floor summary ─────────────────────────────────────────────────────────────
function FloorSummary({
  floor,
  floorRooms,
  leavingTodayCount = 0,
}: {
  floor: number | null;
  floorRooms: Room[];
  leavingTodayCount?: number;
}) {
  const realRooms = floorRooms.filter(room =>
    GUEST_TYPES.has(room.type)
  );

  const availableCount = realRooms.filter(
    room => room.status === 'available'
  ).length;

  const occupiedCount = realRooms.filter(
    room => room.status === 'occupied'
  ).length;

  const cleaningCount = realRooms.filter(
    room => room.status === 'cleaning'
  ).length;

  const maintenanceCount = realRooms.filter(
    room => room.status === 'maintenance'
  ).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Piso {floor}
      </p>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-600">
          <span>Habitaciones</span>
          <span className="font-semibold">{realRooms.length}</span>
        </div>

        <div className="flex justify-between text-emerald-700">
          <span>Libres</span>
          <span className="font-semibold">{availableCount}</span>
        </div>

        <div className="flex justify-between text-rose-700">
          <span>Ocupadas</span>
          <span className="font-semibold">{occupiedCount}</span>
        </div>

        {leavingTodayCount > 0 && (
          <div className="flex justify-between text-blue-600 font-semibold">
            <span>Salen hoy</span>
            <span>{leavingTodayCount}</span>
          </div>
        )}

        {cleaningCount > 0 && (
          <div className="flex justify-between text-sky-700">
            <span>En limpieza</span>
            <span className="font-semibold">{cleaningCount}</span>
          </div>
        )}

        {maintenanceCount > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>Mantenimiento</span>
            <span className="font-semibold">{maintenanceCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Room detail card ──────────────────────────────────────────────────────────
function RoomDetailCard({ room, stay, onCheckIn, onCheckOut, onClose }: {
  room: Room; stay?: StayWithDetails;
  onCheckIn: () => void; onCheckOut: () => void; onClose: () => void;
}) {
  const typeStyle = TYPE_OVERRIDE[room.type];
  const salenHoy = isLeavingToday(stay);
  const s = salenHoy ? { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800' } : (typeStyle ?? RS[room.status]);
  return (
    <div className={`rounded-xl border-2 p-4 ${s.bg} ${s.border}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className={`text-lg font-black ${s.text}`}>{room.number}</p>
            {salenHoy && (
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Salen hoy</span>
            )}
          </div>
          <p className="text-xs text-gray-500 capitalize">{
            room.type === 'sala' ? 'Sala' :
            room.type === 'lavanderia' ? 'Lavanderia' :
            room.type === 'almacen' ? 'Almacen' :
            room.type
          }</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>
      <div className="space-y-1 text-xs text-gray-600 mb-3">
        {stay && (
          <>
            <p className="font-semibold text-gray-800">{stay.guests.name}</p>
            <p>DNI: {stay.guests.dni}</p>
            {(stay.empresa || salenHoy) && <p>Empresa: {stay.empresa || 'Particular'}</p>}
            <p>
              {new Date(stay.check_in_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              {' — '}
              {new Date(stay.check_out_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
            </p>
          </>
        )}
      </div>
      {room.status === 'available' && room.type !== 'sala' && room.type !== 'lavanderia' && room.type !== 'almacen' && (
        <button onClick={onCheckIn} className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
          Ingreso
        </button>
      )}
      {(room.status === 'occupied' || !!stay) && stay && (
        <button onClick={onCheckOut} className="w-full py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700">
          Salida
        </button>
      )}
    </div>
  );
}
