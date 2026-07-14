import { useState, useEffect, useCallback } from 'react';
import { useStayHistory, useStays } from '../hooks/useData';
import { Room, getClient } from '../lib/supabase';
import {
  Calendar,
  Building2,
  Search,
  Filter,
  RefreshCw,
  History,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  User,
  FileSpreadsheet,
  X,
  ArrowUpDown,
  Banknote,
} from 'lucide-react';

const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-ES', opts);

const totalNightsCalc = (checkIn: string, checkOut: string) => {
  const a = new Date(checkIn  + 'T12:00:00');
  const b = new Date(checkOut + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

function localDateStr(d: Date = new Date()): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function lastCompletedNightStr(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateStr(date);
}

function effectiveValuationEnd(stay: { check_out_date?: string | null; status?: string | null }): string | null {
  const scheduledLastNight = stay.check_out_date?.slice(0, 10) ?? null;
  if (stay.status !== 'active' && stay.status !== 'baja') return scheduledLastNight;

  const lastCompletedNight = lastCompletedNightStr();
  return !scheduledLastNight || scheduledLastNight < lastCompletedNight
    ? lastCompletedNight
    : scheduledLastNight;
}

interface StayHistoryProps {
  tenantId: string;
  rooms: Room[];
  canDelete?: boolean;
  canValorizacion?: boolean;
  onExportValorizacion?: (options?: { empresa: string; startDate: string; endDate: string }) => void;
}

type Tab = 'particulares' | 'empresas' | 'reporte_empresa';

export function StayHistory({ tenantId, rooms, canDelete = false, canValorizacion = false, onExportValorizacion }: StayHistoryProps) {
  const { stays, loading, refetch } = useStayHistory(tenantId);
  const { stays: allStays, loading: valuationLoading } = useStays(tenantId);
  const [tab, setTab] = useState<Tab>('reporte_empresa');

  // Shared filters
  const [search, setSearch]     = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Particulares filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Empresas filter
  const [clientFilter, setClientFilter] = useState('all');
  const [activeGuestsOpen, setActiveGuestsOpen] = useState(false);
  const [valuationStart, setValuationStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return localDateStr(date);
  });
  const [valuationEnd, setValuationEnd] = useState(lastCompletedNightStr());

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  const valuationStays = allStays.filter(stay =>
    stay.status === 'active' || stay.status === 'baja' || stay.status === 'completed'
  );

  const empresas = [...new Set(
    valuationStays.filter(s => s.empresa).map(s => s.empresa as string)
  )].sort((a, b) => a.localeCompare(b, 'es'));

  // Base partition
  const particulares = stays.filter(s => !s.empresa);
  const empresaStays = stays.filter(s => !!s.empresa);
  const valuationEmpresaStays = valuationStays.filter(s => !!s.empresa);
  const valuationDayDifference = valuationStart && valuationEnd
    ? Math.round((new Date(`${valuationEnd}T12:00:00`).getTime() - new Date(`${valuationStart}T12:00:00`).getTime()) / 86400000)
    : -1;
  const valuationError = clientFilter === 'all'
    ? 'Selecciona una empresa para visualizar la valorización.'
    : !valuationStart || !valuationEnd
    ? 'Selecciona ambas fechas.'
    : valuationStart > valuationEnd
      ? 'La fecha inicial no puede ser posterior a la fecha final.'
      : valuationEnd > lastCompletedNightStr()
        ? 'La fecha final máxima es la última noche completada: ayer.'
        : valuationDayDifference > 30
          ? 'El rango máximo permitido es de 31 días.'
          : '';
  const valuationDays = valuationError ? [] : Array.from(
    { length: valuationDayDifference + 1 },
    (_, index) => {
      const date = new Date(`${valuationStart}T12:00:00`);
      date.setDate(date.getDate() + index);
      return localDateStr(date);
    },
  );
  const valuationMonthGroups = valuationDays.reduce<Array<{ key: string; label: string; count: number }>>((groups, day) => {
    const date = new Date(`${day}T12:00:00`);
    const key = day.slice(0, 7);
    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.key === key) {
      currentGroup.count += 1;
    } else {
      groups.push({
        key,
        label: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase(),
        count: 1,
      });
    }

    return groups;
  }, []);
  const valuationGroups = new Map<string, typeof valuationEmpresaStays>();
  valuationEmpresaStays
    .filter(stay => clientFilter === 'all' || stay.empresa === clientFilter)
    .forEach(stay => {
      const key = `${stay.guests?.dni ?? stay.guest_id}-${stay.worker_type ?? 'sin-cargo'}`;
      valuationGroups.set(key, [...(valuationGroups.get(key) ?? []), stay]);
    });
  const valuationRows = Array.from(valuationGroups.values()).map(group => {
    const first = group[0];
    const values = valuationDays.map(day => group.some(stay => {
      const checkIn = stay.check_in_date?.slice(0, 10);
      const checkOut = effectiveValuationEnd(stay);
      const bajaStart = stay.baja_start_date?.slice(0, 10);
      const bajaEnd = stay.baja_end_date?.slice(0, 10);
      if (!checkIn || day < checkIn || (checkOut && day > checkOut)) return false;
      return !(bajaStart && bajaEnd && day >= bajaStart && day <= bajaEnd);
    }) ? 1 : 0);
    return { stay: first, values, total: values.reduce<number>((sum, value) => sum + value, 0) };
  }).filter(row => row.total > 0)
    .sort((a, b) => a.stay.guests.name.localeCompare(b.stay.guests.name, 'es'));

  // Filter particulares
  const filteredParticulares = particulares.filter(s => {
    const matchRoom = roomFilter === 'all' || s.room_id === roomFilter;
    const matchFrom = !dateFrom || s.check_in_date >= dateFrom;
    const matchTo   = !dateTo   || s.check_in_date <= dateTo;
    const matchPayment = paymentFilter === 'all' || s.payment_method === paymentFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || s.guests.name.toLowerCase().includes(q)
      || s.guests.dni.includes(q)
      || (s.rooms?.number.includes(q) ?? false);
    return matchRoom && matchFrom && matchTo && matchPayment && matchSearch;
  });

  // Filter empresas
  const filteredEmpresas = empresaStays.filter(s => {
    const matchRoom = roomFilter === 'all' || s.room_id === roomFilter;
    const matchClient = clientFilter === 'all' || s.empresa === clientFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || s.guests.name.toLowerCase().includes(q)
      || s.guests.dni.includes(q)
      || (s.empresa?.toLowerCase().includes(q) ?? false)
      || (s.rooms?.number.includes(q) ?? false);
    return matchRoom && matchClient && matchSearch;
  });

  // Totals for particulares
  const totalAmount = filteredParticulares.reduce((acc, s) => acc + (s.total_amount ?? 0), 0);
  const totalNights = filteredParticulares.reduce((acc, s) => acc + totalNightsCalc(s.check_in_date, s.check_out_date), 0);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar el registro de estancia de ${name}? Esta accion no se puede deshacer.`)) return;
    await getClient().from('stays').delete().eq('id', id);
    refetch();
  };

  const exportParticularesCSV = () => {
    const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES');
    const headers = ['Habitacion', 'Nombre', 'DNI', 'Telefono', 'Procedencia', 'Metodo de pago', 'Fecha de Ingreso', 'Fecha de Salida', 'Noches', 'Total (S/)'];
    const rows = filteredParticulares.map(s => [
      s.rooms?.number ?? '',
      s.guests.name,
      s.guests.dni,
      s.guests.phone ?? '',
      s.guests.address ?? '',
      s.payment_method ?? '',
      fmt(s.check_in_date),
           fmt(new Date(new Date(s.check_out_date + 'T12:00:00').getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      totalNightsCalc(s.check_in_date, s.check_out_date),
      s.total_amount?.toFixed(2) ?? '',
    ]);
    // Total row
    rows.push(['', 'TOTAL', '', '', '', '', '', '', totalNights, totalAmount.toFixed(2)]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const range = dateFrom || dateTo ? `_${dateFrom || 'inicio'}_${dateTo || 'fin'}` : '';
    a.download = `particulares${range}_${localDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportEmpresasCSV = () => {
    const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES');
    const headers = ['Habitacion', 'Nombre', 'DNI', 'Empresa', 'Telefono', 'Ingreso', 'Ultima noche', 'Noches'];
    const rows = filteredEmpresas.map(s => [
      s.rooms?.number ?? '',
      s.guests.name,
      s.guests.dni,
      s.empresa ?? '',
      s.guests.phone ?? '',
      fmt(s.check_in_date),
      fmt(s.check_out_date),
      totalNightsCalc(s.check_in_date, s.check_out_date),
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empresas_${localDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = (list: typeof stays) =>
    floors.reduce<Record<number, typeof stays>>((acc, floor) => {
      const ids = rooms.filter(r => r.floor === floor).map(r => r.id);
      const fs = list.filter(s => ids.includes(s.room_id));
      if (fs.length > 0) acc[floor] = fs;
      return acc;
    }, {});

  const inputCls = 'py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500 focus:border-transparent text-sm text-gray-900 dark:text-zinc-100';

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
<div className="flex gap-1 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl w-fit flex-wrap">
  {/* Primera pestaña: Reporte por empresa */}
  <button
    onClick={() => {
      setTab('reporte_empresa');
      setExpandedId(null);
    }}
    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
      tab === 'reporte_empresa'
        ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm'
        : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
    }`}
  >
    <Building2 className="w-4 h-4" />
    Empresa
  </button>

  {/* Segunda pestaña: Particulares */}
  <button
    onClick={() => {
      setTab('particulares');
      setExpandedId(null);
    }}
    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
      tab === 'particulares'
        ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm'
        : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
    }`}
  >
    <User className="w-4 h-4" />
    Particulares

    <span className="text-xs font-normal bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
      {particulares.length}
    </span>
  </button>

</div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-7 h-7 text-gray-400 dark:text-zinc-600 animate-spin" />
        </div>
      ) : tab === 'particulares' ? (
        <ParticularesList
          stays={filteredParticulares}
          totalAmount={totalAmount}
          totalNights={totalNights}
          search={search} setSearch={setSearch}
          roomFilter={roomFilter} setRoomFilter={setRoomFilter}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
          paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter}
          floors={floors} rooms={rooms}
          expandedId={expandedId} setExpandedId={setExpandedId}
          canDelete={canDelete}
          onDelete={handleDelete}
          onRefetch={refetch}
          onExport={exportParticularesCSV}
          grouped={grouped(filteredParticulares)}
          inputCls={inputCls}
        />
      ) : tab === 'empresas' ? (
        <EmpresasList
          stays={filteredEmpresas}
          search={search} setSearch={setSearch}
          roomFilter={roomFilter} setRoomFilter={setRoomFilter}
          clientFilter={clientFilter} setClientFilter={setClientFilter}
          empresas={empresas}
          floors={floors} rooms={rooms}
          expandedId={expandedId} setExpandedId={setExpandedId}
          canDelete={canDelete}
          onDelete={handleDelete}
          onRefetch={refetch}
          onExport={exportEmpresasCSV}
          grouped={grouped(filteredEmpresas)}
          inputCls={inputCls}
          canValorizacion={canValorizacion}
          onExportValorizacion={onExportValorizacion}
        />
      ) : (
        <div className="order-3 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setActiveGuestsOpen(open => !open)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/60"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-gray-800 dark:text-zinc-100">Huéspedes activos por día</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Consulta quiénes estuvieron alojados en una fecha específica.</p>
              </div>
            </div>
            {activeGuestsOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
          {activeGuestsOpen && (
            <div className="border-t border-gray-100 p-4 dark:border-zinc-800">
              <ReporteEmpresa tenantId={tenantId} inputCls={inputCls} />
            </div>
          )}
        </div>
      )}

      {tab === 'reporte_empresa' && canValorizacion && onExportValorizacion && (
        <div className="order-2 flex justify-center py-2">
          <button
            type="button"
            onClick={() => onExportValorizacion({
              empresa: clientFilter,
              startDate: valuationStart,
              endDate: valuationEnd,
            })}
            disabled={Boolean(valuationError)}
            className="flex min-w-[280px] items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-black text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 dark:shadow-none"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Emitir valorización
          </button>
        </div>
      )}

      {tab === 'reporte_empresa' && (
      <div className="order-1 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex w-full items-center gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-zinc-100">Visualizar valorización</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Consulta noches por huésped en un rango máximo de 31 días.</p>
            </div>
          </div>
        </div>

          <div className="border-t border-gray-100 p-5 dark:border-zinc-800">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">Empresa</label>
                <select
                  value={clientFilter}
                  onChange={event => setClientFilter(event.target.value)}
                  className={`w-full px-3 ${inputCls}`}
                >
                  <option value="all" disabled>Selecciona una empresa</option>
                  {empresas.map(empresa => <option key={empresa} value={empresa}>{empresa}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">Fecha inicial</label>
                <input
                  type="date"
                  value={valuationStart}
                  max={lastCompletedNightStr()}
                  onChange={event => setValuationStart(event.target.value)}
                  className={`w-full px-3 ${inputCls}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">Fecha final</label>
                <input
                  type="date"
                  value={valuationEnd}
                  min={valuationStart}
                  max={lastCompletedNightStr()}
                  onChange={event => setValuationEnd(event.target.value)}
                  className={`w-full px-3 ${inputCls}`}
                />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-gray-500 dark:text-zinc-400">
                Empresa: <strong className="text-gray-800 dark:text-zinc-200">{clientFilter === 'all' ? 'Todas las empresas' : clientFilter}</strong>
              </span>
              {!valuationError && <span className="font-semibold text-emerald-600 dark:text-emerald-400">{valuationDays.length} día{valuationDays.length !== 1 ? 's' : ''}</span>}
            </div>

            {valuationError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{valuationError}</div>
            ) : valuationLoading ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400 dark:border-zinc-700 dark:text-zinc-500">Cargando valorización...</div>
            ) : valuationRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400 dark:border-zinc-700 dark:text-zinc-500">No existen noches registradas para este rango y empresa.</div>
            ) : (
              <div className="overflow-auto rounded-xl border border-gray-200 dark:border-zinc-700">
                <table className="w-full min-w-max text-[9px] leading-tight">
                  <thead className="bg-gray-50 dark:bg-zinc-800">
                    <tr className="border-b border-gray-200 dark:border-zinc-700">
                      <th rowSpan={2} className="sticky left-0 z-10 w-9 min-w-9 bg-gray-50 px-1 py-2 text-center font-bold text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">N.°</th>
                      <th rowSpan={2} className="sticky left-9 z-10 w-36 min-w-36 bg-gray-50 px-2 py-2 text-left font-bold text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">NOMBRE</th>
                      <th rowSpan={2} className="w-20 min-w-20 px-2 py-2 text-left font-bold text-gray-600 dark:text-zinc-300">DNI</th>
                      <th rowSpan={2} className="w-16 min-w-16 px-2 py-2 text-left font-bold text-gray-600 dark:text-zinc-300">CARGO</th>
                      {valuationMonthGroups.map(group => (
                        <th key={group.key} colSpan={group.count} className="border-l border-gray-200 px-1 py-1.5 text-center text-[8px] font-black tracking-wide text-emerald-700 dark:border-zinc-700 dark:text-emerald-400">
                          {group.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-zinc-700">
                      {valuationDays.map(day => (
                        <th key={day} className="w-7 min-w-7 px-0.5 py-1.5 text-center font-bold text-gray-600 dark:text-zinc-300">
                          <span className="block">{day.slice(8, 10)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {valuationRows.map((row, index) => (
                      <tr key={`${row.stay.guests?.dni ?? index}-${row.stay.worker_type ?? ''}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="sticky left-0 w-9 min-w-9 bg-white px-1 py-2 text-center font-semibold text-gray-500 dark:bg-zinc-900 dark:text-zinc-400">{index + 1}</td>
                        <td className="sticky left-9 w-36 min-w-36 max-w-36 truncate bg-white px-2 py-2 font-semibold uppercase text-gray-800 dark:bg-zinc-900 dark:text-zinc-100" title={row.stay.guests?.name ?? ''}>{row.stay.guests?.name?.toUpperCase() ?? '—'}</td>
                        <td className="w-20 min-w-20 px-2 py-2 font-mono text-gray-500 dark:text-zinc-400">{row.stay.guests?.dni ?? '—'}</td>
                        <td className="w-16 min-w-16 px-2 py-2 uppercase text-gray-600 dark:text-zinc-300">{row.stay.worker_type || 'SIN CARGO'}</td>
                        {row.values.map((value, dayIndex) => (
                          <td key={valuationDays[dayIndex]} className={`w-7 min-w-7 px-0.5 py-2 text-center font-black ${value ? 'bg-lime-300 text-lime-950 dark:bg-lime-600 dark:text-white' : 'text-gray-300 dark:text-zinc-700'}`}>
                            {value || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </div>
      )}
    </div>
  );
}

// ─── Particulares ─────────────────────────────────────────────────────────────

function ParticularesList({
  stays, totalAmount, totalNights,
  search, setSearch, roomFilter, setRoomFilter,
  dateFrom, setDateFrom, dateTo, setDateTo,
  paymentFilter, setPaymentFilter,
  floors, rooms, expandedId, setExpandedId,
  canDelete, onDelete, onRefetch, onExport, grouped, inputCls,
}: {
  stays: ReturnType<typeof useStayHistory>['stays'];
  totalAmount: number; totalNights: number;
  search: string; setSearch: (v: string) => void;
  roomFilter: string; setRoomFilter: (v: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  paymentFilter: string; setPaymentFilter: (v: string) => void;
  floors: number[]; rooms: Room[];
  expandedId: string | null; setExpandedId: (id: string | null) => void;
  canDelete?: boolean;
  onDelete: (id: string, name: string) => void;
  onRefetch: () => void; onExport: () => void;
  grouped: Record<number, ReturnType<typeof useStayHistory>['stays']>;
  inputCls: string;
}) {
  const hasDateFilter = !!dateFrom || !!dateTo;

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nombre, DNI o habitacion..."
            className={`w-full pl-10 pr-4 ${inputCls}`}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}
            className={`pl-10 pr-8 ${inputCls} appearance-none`}>
            <option value="all">Todas las habitaciones</option>
            {floors.map(floor => (
              <optgroup key={floor} label={`Piso ${floor}`}>
                {rooms.filter(r => r.floor === floor)
                  .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                  .map(r => <option key={r.id} value={r.id}>Hab. {r.number}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="relative">
          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className={`pl-10 pr-8 ${inputCls} appearance-none capitalize`}
          >
            <option value="all">Todos los pagos</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
          </select>
        </div>
        <button onClick={onRefetch}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700 text-sm text-gray-600 dark:text-zinc-300 transition-colors">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Date range + total */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Desde (ingreso)</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className={`w-full px-3 ${inputCls}`} />
          </div>
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Hasta (ingreso)</label>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
              className={`w-full px-3 ${inputCls}`} />
          </div>
          {hasDateFilter && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-red-500 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 transition-colors">
              Limpiar
            </button>
          )}
          <button onClick={onExport} disabled={stays.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-zinc-700 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-600 text-sm font-medium transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>

        {/* Total summary */}
        <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
            <History className="w-4 h-4" />
            <span>
              <strong className="text-gray-800 dark:text-zinc-200">{stays.length}</strong> estancia{stays.length !== 1 ? 's' : ''}
              {hasDateFilter && <span className="ml-1 text-xs">(rango seleccionado)</span>}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
            <Calendar className="w-4 h-4" />
            <span><strong className="text-gray-800 dark:text-zinc-200">{totalNights}</strong> noches totales</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
         
            <span className="text-sm text-gray-500 dark:text-zinc-400">Total recaudado:</span>
            <span className="text-xl font-black text-green-700 dark:text-green-400">
              S/ {totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* List */}
      {stays.length === 0 ? (
        <EmptyState hasFilters={!!(search || roomFilter !== 'all' || hasDateFilter || paymentFilter !== 'all')} />
      ) : roomFilter === 'all' ? (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([floor, floorStays]) => (
              <section key={floor}>
                <FloorHeader floor={Number(floor)} count={floorStays.length} />
                <div className="space-y-2">
                  {floorStays.map(stay => (
                    <HistoryRow key={stay.id} stay={stay} showPrice
                      expanded={expandedId === stay.id}
                      onToggle={() => setExpandedId(expandedId === stay.id ? null : stay.id)}
                      totalNights={totalNightsCalc(stay.check_in_date, stay.check_out_date)}
                      canDelete={canDelete} onDelete={() => onDelete(stay.id, stay.guests.name)}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {stays.map(stay => (
            <HistoryRow key={stay.id} stay={stay} showPrice
              expanded={expandedId === stay.id}
              onToggle={() => setExpandedId(expandedId === stay.id ? null : stay.id)}
              totalNights={totalNightsCalc(stay.check_in_date, stay.check_out_date)}
              canDelete={canDelete} onDelete={() => onDelete(stay.id, stay.guests.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empresas ─────────────────────────────────────────────────────────────────

function EmpresasList({
  stays, search, setSearch, roomFilter, setRoomFilter,
  clientFilter, setClientFilter, empresas,
  floors, rooms, expandedId, setExpandedId,
  canDelete, onDelete, onRefetch, onExport, grouped, inputCls,
  canValorizacion, onExportValorizacion,
}: {
  stays: ReturnType<typeof useStayHistory>['stays'];
  search: string; setSearch: (v: string) => void;
  roomFilter: string; setRoomFilter: (v: string) => void;
  clientFilter: string; setClientFilter: (v: string) => void;
  empresas: string[];
  floors: number[]; rooms: Room[];
  expandedId: string | null; setExpandedId: (id: string | null) => void;
  canDelete?: boolean;
  onDelete: (id: string, name: string) => void;
  onRefetch: () => void; onExport: () => void;
  grouped: Record<number, ReturnType<typeof useStayHistory>['stays']>;
  inputCls: string;
  canValorizacion?: boolean;
  onExportValorizacion?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nombre, DNI, empresa o habitacion..."
            className={`w-full pl-10 pr-4 ${inputCls}`} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}
            className={`pl-10 pr-8 ${inputCls} appearance-none`}>
            <option value="all">Todas las habitaciones</option>
            {floors.map(floor => (
              <optgroup key={floor} label={`Piso ${floor}`}>
                {rooms.filter(r => r.floor === floor)
                  .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                  .map(r => <option key={r.id} value={r.id}>Hab. {r.number}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
            className={`pl-10 pr-8 ${inputCls} appearance-none`}>
            <option value="all">Todas las empresas</option>
            {empresas.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <button onClick={onRefetch}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700 text-sm text-gray-600 dark:text-zinc-300 transition-colors">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
        <button onClick={onExport} disabled={stays.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-zinc-700 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-600 text-sm font-medium transition-colors disabled:opacity-40">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
        {canValorizacion && onExportValorizacion && (
          <button onClick={onExportValorizacion}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition-colors shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> Valorización
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
        <History className="w-4 h-4" />
        <span><strong className="text-gray-800 dark:text-zinc-200">{stays.length}</strong> estancias de empresa</span>
      </div>

      {stays.length === 0 ? (
        <EmptyState hasFilters={!!(search || roomFilter !== 'all' || clientFilter !== 'all')} />
      ) : roomFilter === 'all' ? (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([floor, floorStays]) => (
              <section key={floor}>
                <FloorHeader floor={Number(floor)} count={floorStays.length} />
                <div className="space-y-2">
                  {floorStays.map(stay => (
                    <HistoryRow key={stay.id} stay={stay} showPrice={false}
                      expanded={expandedId === stay.id}
                      onToggle={() => setExpandedId(expandedId === stay.id ? null : stay.id)}
                      totalNights={totalNightsCalc(stay.check_in_date, stay.check_out_date)}
                      canDelete={canDelete} onDelete={() => onDelete(stay.id, stay.guests.name)}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {stays.map(stay => (
            <HistoryRow key={stay.id} stay={stay} showPrice={false}
              expanded={expandedId === stay.id}
              onToggle={() => setExpandedId(expandedId === stay.id ? null : stay.id)}
              totalNights={totalNightsCalc(stay.check_in_date, stay.check_out_date)}
              canDelete={canDelete} onDelete={() => onDelete(stay.id, stay.guests.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reporte por Empresa ──────────────────────────────────────────────────────
function ReporteEmpresa({
  tenantId,
  inputCls,
}: {
  tenantId: string;
  inputCls: string;
}) {
  type ReportStay = ReturnType<typeof useStayHistory>['stays'][number];
  type SortField = 'name' | 'room' | 'empresa';
  type SortDirection = 'asc' | 'desc';
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(localDateStr());
  const [reportStays, setReportStays] = useState<ReportStay[]>([]);
  const [reportEmpresas, setReportEmpresas] = useState<string[]>([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] =
  useState<SortDirection>('asc');
  const hasFilters = Boolean(selectedDate || empresaFilter);

  const loadReportData = useCallback(async () => {
    setLoadingReport(true);
    setReportError('');

    try {
      const { data, error } = await getClient()
        .from('stays')
        .select('*, guests(*), rooms(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'baja', 'completed'])
        .not('empresa', 'is', null)
        .neq('empresa', '')
        .order('check_in_date', { ascending: true });

      if (error) throw error;

      const loadedStays = (data ?? []) as ReportStay[];
      setReportStays(loadedStays);

      const uniqueEmpresas = [
        ...new Set(
          loadedStays
            .map(stay => stay.empresa?.trim())
            .filter((empresa): empresa is string => Boolean(empresa)),
        ),
      ].sort((a, b) => a.localeCompare(b, 'es'));

      setReportEmpresas(uniqueEmpresas);
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los datos del reporte.',
      );
    } finally {
      setLoadingReport(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);
const handleSort = (field: SortField) => {
  if (sortField === field) {
    setSortDirection(current =>
      current === 'asc' ? 'desc' : 'asc',
    );
    return;
  }

  setSortField(field);
  setSortDirection('asc');
};
  const filtered = selectedDate
    ? reportStays
        .filter(stay => {
          const checkIn = stay.check_in_date?.slice(0, 10);
          const checkOut = effectiveValuationEnd(stay);
          const bajaStart = stay.baja_start_date?.slice(0, 10);
          const bajaEnd = stay.baja_end_date?.slice(0, 10);

          if (!checkIn) return false;

          if (
            empresaFilter &&
            stay.empresa?.trim().toLowerCase() !==
              empresaFilter.trim().toLowerCase()
          ) {
            return false;
          }

          if (selectedDate < checkIn) return false;
          if (checkOut && selectedDate > checkOut) return false;

          if (
            bajaStart &&
            bajaEnd &&
            selectedDate >= bajaStart &&
            selectedDate <= bajaEnd
          ) {
            return false;
          }

          return true;
         })

    : [];
const sortedFiltered = [...filtered].sort((a, b) => {
  let valueA = '';
  let valueB = '';

  if (sortField === 'name') {
    valueA = a.guests?.name ?? '';
    valueB = b.guests?.name ?? '';
  }

  if (sortField === 'room') {
    valueA = a.rooms?.number ?? '';
    valueB = b.rooms?.number ?? '';
  }

  if (sortField === 'empresa') {
    valueA = a.empresa ?? '';
    valueB = b.empresa ?? '';
  }

  const comparison = valueA.localeCompare(valueB, 'es', {
    sensitivity: 'base',
    numeric: sortField === 'room',
  });

  return sortDirection === 'asc'
    ? comparison
    : -comparison;
});
  const clearFilters = () => {
    setEmpresaFilter('');
    setSelectedDate('');
  };

  const exportCSV = () => {
    const formatDate = (date: string) =>
      new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('es-PE');

    const headers = [
  'N.°',
  'Nombre',
  'DNI',
  'Cargo',
  'Habitación',
  'Empresa',
  'Fecha de ingreso',
  'Última noche',
  'Teléfono',
];

const rows = sortedFiltered.map((stay, index) => [
  index + 1,
  stay.guests?.name ?? '',
  stay.guests?.dni ?? '',
  stay.worker_type ?? 'Sin cargo',
  stay.rooms?.number ?? '',
  stay.empresa ?? '',
  formatDate(stay.check_in_date),
  stay.check_out_date ? formatDate(stay.check_out_date) : '',
  stay.guests?.phone ?? '',
]);

    const csv = [headers, ...rows]
      .map(row =>
        row
          .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const empresaName = empresaFilter
      ? `_${empresaFilter.replace(/\s+/g, '_')}`
      : '_todas';

    link.href = url;
    link.download = `huespedes_activos${empresaName}_${selectedDate}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-semibold text-gray-800 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            Filtros de consulta
          </h3>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadReportData}
              disabled={loadingReport}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingReport ? 'animate-spin' : ''
                }`}
              />
              Actualizar
            </button>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
              Fecha
            </label>

            <input
  type="date"
  value={selectedDate}
  max={localDateStr()}
  onChange={event => setSelectedDate(event.target.value)}
  className={`w-full px-3 ${inputCls}`}
/>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
              Empresa
            </label>

            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />

              <select
                value={empresaFilter}
                onChange={event => setEmpresaFilter(event.target.value)}
                className={`w-full pl-10 pr-8 ${inputCls} appearance-none`}
              >
                <option value="">Todas las empresas</option>

                {reportEmpresas.map(empresa => (
                  <option key={empresa} value={empresa}>
                    {empresa}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {reportError && (
          <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            {reportError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
            <History className="w-4 h-4" />

            <span>
              <strong className="text-gray-800 dark:text-zinc-200">
                {filtered.length}
              </strong>{' '}
              huésped{filtered.length !== 1 ? 'es' : ''} activo
              {filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <button
            type="button"
            onClick={exportCSV}
            disabled={!selectedDate || filtered.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      {loadingReport ? (
        <div className="flex items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
          <RefreshCw className="w-7 h-7 text-gray-400 dark:text-zinc-600 animate-spin" />
        </div>
      ) : !selectedDate ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
          <History className="w-12 h-12 text-gray-200 dark:text-zinc-700 mx-auto mb-3" />

          <p className="text-gray-400 dark:text-zinc-500 font-medium">
            Selecciona una fecha para consultar los huéspedes activos
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
          <Building2 className="w-12 h-12 text-gray-200 dark:text-zinc-700 mx-auto mb-3" />

          <p className="text-gray-400 dark:text-zinc-500 font-medium">
            No se encontraron huéspedes activos en esta fecha
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800">
                <tr className="border-b border-gray-100 dark:border-zinc-700">
  <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    N.°
  </th>

  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    <button
      type="button"
      onClick={() => handleSort('name')}
      className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
    >
      Nombre
      <ArrowUpDown
        className={`w-3.5 h-3.5 ${
          sortField === 'name'
            ? 'text-blue-500'
            : 'text-gray-400 dark:text-zinc-500'
        }`}
      />
    </button>
  </th>

  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    DNI
  </th>
  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  Cargo
</th>

  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    <button
      type="button"
      onClick={() => handleSort('room')}
      className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
    >
      Habitación
      <ArrowUpDown
        className={`w-3.5 h-3.5 ${
          sortField === 'room'
            ? 'text-blue-500'
            : 'text-gray-400 dark:text-zinc-500'
        }`}
      />
    </button>
  </th>

  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    <button
      type="button"
      onClick={() => handleSort('empresa')}
      className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
    >
      Empresa
      <ArrowUpDown
        className={`w-3.5 h-3.5 ${
          sortField === 'empresa'
            ? 'text-blue-500'
            : 'text-gray-400 dark:text-zinc-500'
        }`}
      />
    </button>
  </th>

  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    Ingreso
  </th>

  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    Última noche
  </th>
  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
    Teléfono
  </th>
</tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
  {sortedFiltered.map((stay, index) => (
    <tr
      key={stay.id}
      className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
    >
      <td className="px-4 py-3 text-center text-gray-500 dark:text-zinc-400 font-semibold whitespace-nowrap">
        {index + 1}
      </td>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-zinc-100 whitespace-nowrap">
                      {stay.guests?.name ?? '—'}
                    </td>

                   <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 font-mono text-xs whitespace-nowrap">
  {stay.guests?.dni ?? '—'}
</td>

<td className="px-4 py-3 text-gray-600 dark:text-zinc-300 whitespace-nowrap capitalize">
  {stay.worker_type || 'Sin cargo'}
</td>

<td className="px-4 py-3 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
  Hab. {stay.rooms?.number ?? '—'}
</td>

                    <td className="px-4 py-3 text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {stay.empresa ?? '—'}
                    </td>

                    <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                      {fmtDate(stay.check_in_date.slice(0, 10), {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="px-5 py-3 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                      {stay.check_out_date
                        ? fmtDate(stay.check_out_date.slice(0, 10), {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Sin fecha'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                      {stay.guests?.phone || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── Shared sub-components ────────────────────────────────────────────────────

function FloorHeader({ floor, count }: { floor: number; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-7 h-7 bg-gray-800 dark:bg-zinc-700 text-white rounded-lg flex items-center justify-center text-xs font-bold">
        {floor}
      </div>
      <h3 className="font-bold text-gray-700 dark:text-zinc-200">Piso {floor}</h3>
      <span className="text-xs text-gray-400 dark:text-zinc-500">{count} registro{count !== 1 ? 's' : ''}</span>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
      <History className="w-12 h-12 text-gray-200 dark:text-zinc-700 mx-auto mb-3" />
      <p className="text-gray-400 dark:text-zinc-500 font-medium">No hay registros</p>
      {hasFilters && <p className="text-gray-300 dark:text-zinc-600 text-sm mt-1">Intenta con otros filtros</p>}
    </div>
  );
}

function HistoryRow({
  stay, showPrice, expanded, onToggle, totalNights, canDelete, onDelete,
}: {
  stay: ReturnType<typeof useStayHistory>['stays'][number];
  showPrice: boolean;
  expanded: boolean;
  onToggle: () => void;
  totalNights: number;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm dark:shadow-none">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="shrink-0 w-14 h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
          <span className="font-black text-gray-700 dark:text-zinc-300 text-sm">{stay.rooms?.number ?? '—'}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 dark:text-zinc-100 text-sm truncate">{stay.guests.name}</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">DNI {stay.guests.dni}</span>
          </div>
          {stay.empresa && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="text-xs text-blue-600 dark:text-blue-400 truncate">{stay.empresa}</span>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 shrink-0">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {fmtDate(stay.check_in_date, { day: '2-digit', month: 'short' })}
            {' — '}
            {fmtDate(
              showPrice
                ? new Date(new Date(stay.check_out_date + 'T12:00:00').getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                : stay.check_out_date,
              { day: '2-digit', month: 'short', year: 'numeric' },
            )}
          </span>
        </div>

        <div className="hidden md:block text-xs text-gray-500 dark:text-zinc-400 shrink-0 w-20 text-right">
          {totalNights} noche{totalNights !== 1 ? 's' : ''}
        </div>

        {showPrice && stay.total_amount != null && (
          <div className="shrink-0 text-right">
            <span className="font-bold text-gray-800 dark:text-zinc-100">S/ {stay.total_amount.toFixed(2)}</span>
          </div>
        )}

        {canDelete && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete?.(); }}
            className="shrink-0 p-1.5 text-gray-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Eliminar registro"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="shrink-0 text-gray-400 dark:text-zinc-500 ml-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-3 border-t border-gray-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-gray-50 dark:bg-zinc-800/50">
          <div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Ingreso</p>
            <p className="font-medium text-gray-700 dark:text-zinc-200">
              {fmtDate(stay.check_in_date, { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Fecha de salida</p>
            <p className="font-medium text-gray-700 dark:text-zinc-200">
              {fmtDate(
                showPrice
                  ? new Date(new Date(stay.check_out_date + 'T12:00:00').getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                  : stay.check_out_date,
                { day: '2-digit', month: 'long', year: 'numeric' },
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Telefono</p>
            <p className="font-medium text-gray-700 dark:text-zinc-200">{stay.guests.phone || '—'}</p>
          </div>
          {showPrice ? (
            <div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Procedencia</p>
              <p className="font-medium text-gray-700 dark:text-zinc-200">{stay.guests.address || '—'}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Empresa</p>
              <p className="font-medium text-blue-600 dark:text-blue-400">{stay.empresa || '—'}</p>
            </div>
          )}
          {stay.guests.address && showPrice && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Direccion</p>
              <p className="font-medium text-gray-700 dark:text-zinc-200">{stay.guests.address}</p>
            </div>
          )}
          {showPrice && stay.payment_method && (
            <div className="col-span-2 sm:col-span-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" />Medio de pago</p>
              <p className="font-semibold text-gray-700 dark:text-zinc-200 capitalize">{stay.payment_method}</p>
              {stay.payment_receipt_url && (
                <a href={stay.payment_receipt_url} target="_blank" rel="noreferrer" className="inline-block mt-3">
                  <img src={stay.payment_receipt_url} alt={`Comprobante de ${stay.payment_method}`} className="max-h-64 max-w-full rounded-xl border border-gray-200 dark:border-zinc-700 object-contain" />
                  <span className="block mt-1 text-xs text-blue-600 dark:text-blue-400">Abrir comprobante completo</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
