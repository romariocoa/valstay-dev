import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Calendar,
  FileSpreadsheet,
  Building2,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { getClient, HotelConfig } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface Props {
  tenantId: string;
  onClose: () => void;
  initialEmpresa?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

const MONTH_NAMES_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// ── palette ──────────────────────────────────────────────────────────────────
const HDR_RGB   = 'B8CCE4';
const GREEN_RGB = '92D050';
const GRAY_RGB  = 'D9D9D9';

function fillStyle(rgb: string, bold = false, align = 'left', size = 10) {
  return {
    fill: { patternType: 'solid', fgColor: { rgb }, bgColor: { indexed: 64 } },
    font: { bold, sz: size, name: 'Calibri' },
    alignment: { horizontal: align, vertical: 'center', wrapText: false },
    border: {
      top:    { style: 'thin', color: { auto: 1 } },
      bottom: { style: 'thin', color: { auto: 1 } },
      left:   { style: 'thin', color: { auto: 1 } },
      right:  { style: 'thin', color: { auto: 1 } },
    },
  };
}

function plainStyle(bold = false, align = 'left', size = 10) {
  return {
    font: { bold, sz: size, name: 'Calibri' },
    alignment: { horizontal: align, vertical: 'center', wrapText: false },
  };
}

function applyStyle(ws: XLSX.WorkSheet, r: number, c: number, style: object) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!ws[ref]) ws[ref] = { t: 'z', v: '' };
  (ws[ref] as XLSX.CellObject & { s: object }).s = style;
}

// ── date helpers ─────────────────────────────────────────────────────────────
function getDaysInRange(start: string, end: string): Date[] {
  const days: Date[] = [];
  const cur  = new Date(start + 'T12:00:00');
  const last = new Date(end   + 'T12:00:00');
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function toDateOnly(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} DE ${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`;
}

// ── shared data fetch ─────────────────────────────────────────────────────────
async function fetchStays(empresa: string, startDate: string, endDate: string, tenantId: string) {
  return getClient()
    .from('stays').select('*, guests(*), rooms(*)')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'baja', 'completed'])
    .eq('empresa', empresa)
    .lte('check_in_date', endDate)
    .or(`check_out_date.gte.${startDate},check_out_date.is.null,status.in.(active,baja)`)
    .order('check_in_date', { ascending: true });
}

type WorkerType = 'obrero' | 'empleado' | 'staff';

type StayRow = {
  status?: 'active' | 'baja' | 'completed' | string | null;
  check_in_date: string;
  check_out_date: string | null;
  baja_start_date: string | null;
  baja_end_date: string | null;
  worker_type?: WorkerType | null;
  guests?: {
    name?: string;
    dni?: string;
  } | null;
};



function buildDataRows(
  stays: StayRow[],
  days: Date[],
  tarifas: Record<WorkerType, number>,
) {
  const lastCompletedNight = new Date();
  lastCompletedNight.setDate(lastCompletedNight.getDate() - 1);
  lastCompletedNight.setHours(12, 0, 0, 0);
  const lastCompletedNightDate = lastCompletedNight;
  /*
   * Se agrupa por DNI + cargo.
   * Esto evita mezclar en una misma fila estancias del mismo huésped
   * que tengan cargos o tarifas diferentes.
   */
  const guestMap = new Map<string, StayRow[]>();

  for (const stay of stays) {
    const dni = stay.guests?.dni ?? `sin-dni-${Math.random()}`;
    const workerType = stay.worker_type ?? 'obrero';
    const key = `${dni}_${workerType}`;

    if (!guestMap.has(key)) {
      guestMap.set(key, []);
    }

    guestMap.get(key)!.push(stay);
  }

  let item = 1;

  return Array.from(guestMap.values()).map(guestStays => {
    const first = guestStays[0];
    const workerType: WorkerType = first.worker_type ?? 'obrero';
    const tarifaAplicada = tarifas[workerType];

    const dayVals = days.map(day => {
      for (const stay of guestStays) {
        const checkIn = toDateOnly(stay.check_in_date);
        const scheduledCheckOut = stay.check_out_date
          ? toDateOnly(stay.check_out_date)
          : null;
        const checkOut = (stay.status === 'active' || stay.status === 'baja') &&
          (!scheduledCheckOut || scheduledCheckOut < lastCompletedNightDate)
          ? lastCompletedNightDate
          : scheduledCheckOut;

        const bajaStart = stay.baja_start_date
          ? toDateOnly(stay.baja_start_date)
          : null;

        const bajaEnd = stay.baja_end_date
          ? toDateOnly(stay.baja_end_date)
          : null;

        if (day < checkIn) continue;
        if (checkOut !== null && day > checkOut) continue;

        if (
          bajaStart &&
          bajaEnd &&
          day >= bajaStart &&
          day <= bajaEnd
        ) {
          continue;
        }

        return '1';
      }

      return '';
    });

    const cant = dayVals.filter(value => value === '1').length;

    const cargoLabel: Record<WorkerType, string> = {
      obrero: 'OBRERO',
      empleado: 'EMPLEADO',
      staff: 'STAFF',
    };

    return {
      item: item++,
      nombre: (first.guests?.name ?? '').toUpperCase(),
      cargo: cargoLabel[workerType],
      workerType,
      dni: first.guests?.dni ?? '',
      dayVals,
      cant,
      tarifa: tarifaAplicada,
      total: cant * tarifaAplicada,
    };
  });
}

// ── image loader (for PDF logo/firma) ────────────────────────────────────────
async function loadImageAsBase64(url: string): Promise<string> {
  const fullUrl = url.startsWith('/') ? window.location.origin + url : url;
  const response = await fetch(fullUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── component ─────────────────────────────────────────────────────────────────
export function ExportValorizacion({ tenantId, onClose, initialEmpresa, initialStartDate, initialEndDate }: Props) {
  const today        = new Date();
  const lastNight    = new Date(today);
  lastNight.setDate(lastNight.getDate() - 1);
  const pad          = (n: number) => String(n).padStart(2, '0');
  const firstOfMonth = `${lastNight.getFullYear()}-${pad(lastNight.getMonth() + 1)}-01`;
  const lastNightStr = `${lastNight.getFullYear()}-${pad(lastNight.getMonth() + 1)}-${pad(lastNight.getDate())}`;

  const lockedContext = Boolean(initialEmpresa && initialStartDate && initialEndDate);
  const [startDate,       setStartDate]       = useState(initialStartDate ?? firstOfMonth);
  const [endDate,         setEndDate]         = useState(initialEndDate ?? lastNightStr);
  const [selectedEmpresa, setSelectedEmpresa] = useState(initialEmpresa ?? '');
  const [tarifaObrero, setTarifaObrero] = useState('41.20');
  const [workerTypesPresent, setWorkerTypesPresent] = useState<WorkerType[]>([]);
  const [loadingWorkerTypes, setLoadingWorkerTypes] = useState(false);
  const [tarifaEmpleado, setTarifaEmpleado] = useState('48');
  const [tarifaStaff, setTarifaStaff] = useState('65.50');
  const [ratesCompany, setRatesCompany] = useState('');
  const [savingRates, setSavingRates] = useState(false);
  const [empresas,        setEmpresas]        = useState<string[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [hotelConfig,     setHotelConfig]     = useState<HotelConfig | null>(null);
  const [excelLoading,    setExcelLoading]    = useState(false);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const [error,           setError]           = useState('');

  useEffect(() => {
  getClient()
    .from('stays')
    .select('empresa')
    .eq('tenant_id', tenantId)
    .not('empresa', 'is', null)
    .neq('empresa', '')
    .in('status', ['active', 'baja', 'completed'])
    .then(({ data }) => {
      const unique = [
        ...new Set((data ?? []).map(row => row.empresa as string)),
      ]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      setEmpresas(unique);

      if (unique.length === 1) {
        setSelectedEmpresa(unique[0]);
      }

      setLoadingEmpresas(false);
    });

  getClient()
    .from('hotel_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
    .then(({ data }) => {
      if (data) {
        setHotelConfig(data as HotelConfig);
      }
    });
}, [tenantId]);

  useEffect(() => {
    let cancelled = false;

    const loadRates = async () => {
      setRatesCompany('');
      if (!selectedEmpresa) return;

      const { data, error: ratesError } = await getClient()
        .from('company_valuation_rates')
        .select('obrero_rate, empleado_rate, staff_rate')
        .eq('tenant_id', tenantId)
        .eq('company_name', selectedEmpresa)
        .maybeSingle();

      if (cancelled) return;

      if (ratesError) {
        setError('No se pudieron cargar las tarifas guardadas.');
        return;
      }

      setTarifaObrero(data ? String(data.obrero_rate) : '41.20');
      setTarifaEmpleado(data ? String(data.empleado_rate) : '48');
      setTarifaStaff(data ? String(data.staff_rate) : '65.50');
      setRatesCompany(selectedEmpresa);
    };

    loadRates();
    return () => { cancelled = true; };
  }, [selectedEmpresa, tenantId]);

  useEffect(() => {
    if (!selectedEmpresa || ratesCompany !== selectedEmpresa) return;

    const values = [tarifaObrero, tarifaEmpleado, tarifaStaff].map(Number);
    if (values.some(value => !Number.isFinite(value) || value < 0)) return;

    const timeout = window.setTimeout(async () => {
      setSavingRates(true);
      const { error: saveError } = await getClient()
        .from('company_valuation_rates')
        .upsert({
          tenant_id: tenantId,
          company_name: selectedEmpresa,
          obrero_rate: values[0],
          empleado_rate: values[1],
          staff_rate: values[2],
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,company_name' });

      if (saveError) setError('No se pudieron guardar las tarifas.');
      setSavingRates(false);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [tarifaObrero, tarifaEmpleado, tarifaStaff, selectedEmpresa, ratesCompany, tenantId]);

  useEffect(() => {
  const loadWorkerTypes = async () => {
    if (!selectedEmpresa || !startDate || !endDate) {
      setWorkerTypesPresent([]);
      return;
    }

    setLoadingWorkerTypes(true);

    const { data, error } = await fetchStays(
      selectedEmpresa,
      startDate,
      endDate,
      tenantId,
    );

    if (error) {
      setWorkerTypesPresent([]);
      setLoadingWorkerTypes(false);
      return;
    }

    const types = [
      ...new Set(
        (data ?? [])
          .map(stay => stay.worker_type as WorkerType | null)
          .filter(
            (type): type is WorkerType =>
              type === 'obrero' ||
              type === 'empleado' ||
              type === 'staff',
          ),
      ),
    ];

    const order: WorkerType[] = ['obrero', 'empleado', 'staff'];

    setWorkerTypesPresent(
      order.filter(type => types.includes(type)),
    );

    setLoadingWorkerTypes(false);
  };

  loadWorkerTypes();
}, [selectedEmpresa, startDate, endDate, tenantId]);

  const dayCount  = startDate && endDate && startDate <= endDate
    ? getDaysInRange(startDate, endDate).length : 0;
 const tarifas: Record<WorkerType, number> = {
  obrero: parseFloat(tarifaObrero) || 0,
  empleado: parseFloat(tarifaEmpleado) || 0,
  staff: parseFloat(tarifaStaff) || 0,
};

const canExport =
  dayCount > 0 &&
  endDate <= lastNightStr &&
  !!selectedEmpresa &&
  workerTypesPresent.length > 0 &&
  workerTypesPresent.every(type => tarifas[type] > 0);
  const isLoading = excelLoading || pdfLoading;

  // ── Excel export ────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (!canExport) return;
    setExcelLoading(true);
    setError('');

    try {
      const { data: stays, error: fetchErr } = await fetchStays(selectedEmpresa, startDate, endDate, tenantId);
      if (fetchErr) throw fetchErr;
      if (!stays || stays.length === 0) {
        setError(`No hay estancias de "${selectedEmpresa}" en el rango seleccionado.`);
        return;
      }

      const days     = getDaysInRange(startDate, endDate);
      const dataRows = buildDataRows(stays, days, tarifas);

      const monthGroups: { month: number; year: number; days: Date[] }[] = [];
      for (const day of days) {
        const m = day.getMonth(), y = day.getFullYear();
        const last = monthGroups[monthGroups.length - 1];
        if (last && last.month === m && last.year === y) last.days.push(day);
        else monthGroups.push({ month: m, year: y, days: [day] });
      }

      const FIXED   = 4;
      const cCant   = FIXED + days.length;
      const cTarifa = cCant + 1;
      const cTotal  = cCant + 2;
      const TOTAL_COLS = cTotal + 1;

      const blank = (): (string | number)[] => Array(TOTAL_COLS).fill('');
      const hrow  = (label: string, value: string): (string | number)[] =>
        [`${label} :`, value, ...Array(TOTAL_COLS - 2).fill('')];

      const mesLabel  = `DEL ${formatDateLabel(startDate)} AL ${formatDateLabel(endDate)}`;
      const hotelName = (hotelConfig?.name ?? 'HOTEL').toUpperCase();
      const title     = `VALORIZACIÓN - ${hotelName}`;

      const aoa: (string | number)[][] = [
        [title, ...Array(TOTAL_COLS - 1).fill('')],
        blank(),
        ['SERVICIO  DE ALOJAMIENTO', ...Array(TOTAL_COLS - 1).fill('')],
        hrow('RAZON SOCIAL',       hotelConfig?.razon_social    ?? ''),
        hrow('RUC',                hotelConfig?.ruc              ?? ''),
        hrow('DIRECCION',          hotelConfig?.direccion        ?? ''),
        hrow('N° Cuenta Bancaria', hotelConfig?.cuenta_bancaria  ?? ''),
        hrow('CCI',                hotelConfig?.cci              ?? ''),
        hrow('N° DE DETRACCION',   hotelConfig?.n_detraccion     ?? ''),
        hrow('MES',                mesLabel),
        hrow('EMPRESA',            selectedEmpresa),
        blank(),
      ];

      const HEADER_ROWS = aoa.length;

      const hdr1: (string | number)[] = ['Item', 'NOMBRES Y APELLIDOS', 'CARGO', 'DNI'];
      for (const g of monthGroups) {
        hdr1.push(MONTH_NAMES_ES[g.month]);
        for (let i = 1; i < g.days.length; i++) hdr1.push('');
      }
      hdr1.push('Cant', 'Tarifa', 'Total');
      aoa.push(hdr1);

      const hdr2: (string | number)[] = ['', '', '', ''];
      for (const day of days) hdr2.push(day.getDate());
      hdr2.push('', '', '');
      aoa.push(hdr2);

      for (const r of dataRows) {
        aoa.push([r.item, r.nombre, r.cargo, r.dni, ...r.dayVals.map(v => v === '1' ? 1 : ''), r.cant, `S/ ${r.tarifa.toFixed(2)}`, r.total]);
      }

      let totalCant = 0;
      const totalsRow: (string | number)[] = ['', 'Total', '', ''];
      for (let i = 0; i < days.length; i++) {
        const s = dataRows.reduce((acc, r) => acc + (r.dayVals[i] === '1' ? 1 : 0), 0);
        totalsRow.push(s > 0 ? s : '');
        totalCant += s;
      }
      const grandTotal = dataRows.reduce((a, r) => a + r.total, 0);
      totalsRow.push(totalCant, '', grandTotal);
      aoa.push(totalsRow);

      const TOTAL_ROW = aoa.length - 1;
      const igv      = grandTotal * 0.18;
      const totalFin = grandTotal + igv;

      const summaryRows: (string | number)[][] = [
        [...Array(cCant).fill(''), 'SUB TOTAL', 'S/', grandTotal],
        [...Array(cCant).fill(''), 'IGV (18%)', 'S/', parseFloat(igv.toFixed(2))],
        [...Array(cCant).fill(''), 'TOTAL',     'S/', parseFloat(totalFin.toFixed(2))],
];

for (const sr of summaryRows) {
  aoa.push(sr);
}

      aoa.push(blank());
      const BRAND_ROW = aoa.length;
      aoa.push(['by ValStay', ...Array(TOTAL_COLS - 1).fill('')]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: TOTAL_COLS - 1 } },
        { s: { r: BRAND_ROW, c: 0 }, e: { r: BRAND_ROW, c: 2 } },
        ...[3, 4, 5, 6, 7, 8, 9, 10].map(r => ({ s: { r, c: 1 }, e: { r, c: TOTAL_COLS - 1 } })),
        { s: { r: HEADER_ROWS, c: 0 }, e: { r: HEADER_ROWS + 1, c: 0 } },
        { s: { r: HEADER_ROWS, c: 1 }, e: { r: HEADER_ROWS + 1, c: 1 } },
        { s: { r: HEADER_ROWS, c: 2 }, e: { r: HEADER_ROWS + 1, c: 2 } },
        { s: { r: HEADER_ROWS, c: 3 }, e: { r: HEADER_ROWS + 1, c: 3 } },
        { s: { r: HEADER_ROWS, c: cCant   }, e: { r: HEADER_ROWS + 1, c: cCant   } },
        { s: { r: HEADER_ROWS, c: cTarifa }, e: { r: HEADER_ROWS + 1, c: cTarifa } },
        { s: { r: HEADER_ROWS, c: cTotal  }, e: { r: HEADER_ROWS + 1, c: cTotal  } },
      ];

      let colOffset = FIXED;
      for (const g of monthGroups) {
        if (g.days.length > 1) {
          merges.push({ s: { r: HEADER_ROWS, c: colOffset }, e: { r: HEADER_ROWS, c: colOffset + g.days.length - 1 } });
        }
        colOffset += g.days.length;
      }
      ws['!merges'] = merges;

      ws['!cols'] = [
        { wch: 6 }, { wch: 36 }, { wch: 16 }, { wch: 12 },
        ...days.map(() => ({ wch: 4 })),
        { wch: 9 }, { wch: 10 }, { wch: 14 },
      ];
      ws['!rows'] = [
        { hpt: 24 }, { hpt: 6 }, { hpt: 18 },
        ...Array(8).fill({ hpt: 17 }),
        { hpt: 6 }, { hpt: 22 }, { hpt: 16 },
      ];

      const titleStyle = { font: { bold: true, sz: 13, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' } };
      applyStyle(ws, 0, 0, titleStyle);
      const serviceStyle = { font: { bold: true, sz: 11, name: 'Calibri' }, alignment: { horizontal: 'left', vertical: 'center' } };
      applyStyle(ws, 2, 0, serviceStyle);
      for (let r = 3; r <= 10; r++) {
        applyStyle(ws, r, 0, plainStyle(true));
        applyStyle(ws, r, 1, plainStyle(false));
      }
      for (let c = 0; c < TOTAL_COLS; c++) {
        applyStyle(ws, HEADER_ROWS,     c, fillStyle(HDR_RGB, true, 'center'));
        applyStyle(ws, HEADER_ROWS + 1, c, fillStyle(HDR_RGB, true, 'center'));
      }
      const DATA_START = HEADER_ROWS + 2;
      for (let ri = 0; ri < dataRows.length; ri++) {
        const row = dataRows[ri];
        const R   = DATA_START + ri;
        applyStyle(ws, R, 0, plainStyle(false, 'center'));
        applyStyle(ws, R, 1, plainStyle());
        applyStyle(ws, R, 2, plainStyle(false, 'center'));
        applyStyle(ws, R, 3, plainStyle(false, 'center'));
        for (let di = 0; di < days.length; di++) {
          const isPresent = row.dayVals[di] === '1';
          applyStyle(ws, R, FIXED + di, fillStyle(isPresent ? GREEN_RGB : 'FFFFFF', false, 'center'));
        }
        applyStyle(ws, R, cCant,   plainStyle(false, 'center'));
        applyStyle(ws, R, cTarifa, plainStyle(false, 'right'));
        applyStyle(ws, R, cTotal,  plainStyle(false, 'right'));
      }
      for (let c = 0; c < TOTAL_COLS; c++) {
        const isDay = c >= FIXED && c < cCant;
        applyStyle(ws, TOTAL_ROW, c, fillStyle(GRAY_RGB, true, isDay ? 'center' : c <= 1 ? 'center' : 'right'));
      }
      const SUM_START = TOTAL_ROW + 1;
      for (let si = 0; si < 3; si++) {
        const R = SUM_START + si;
        applyStyle(ws, R, cCant,   fillStyle(GRAY_RGB, true, 'right'));
        applyStyle(ws, R, cTarifa, fillStyle(GRAY_RGB, true, 'center'));
        applyStyle(ws, R, cTotal,  fillStyle(GRAY_RGB, true, 'right'));
      }
      applyStyle(ws, BRAND_ROW, 0, {
        font: { italic: true, sz: 7, name: 'Calibri', color: { rgb: 'B7B7B7' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Valorización');
      const safeName = selectedEmpresa.replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `valorizacion_${safeName}_${startDate}_al_${endDate}.xlsx`, {
        bookType: 'xlsx', cellStyles: true,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el archivo.');
    } finally {
      setExcelLoading(false);
    }
  };

  // ── PDF export ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!canExport) return;
    setPdfLoading(true);
    setError('');

    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const { data: stays, error: fetchErr } = await fetchStays(selectedEmpresa, startDate, endDate, tenantId);
      if (fetchErr) throw fetchErr;
      if (!stays || stays.length === 0) {
        setError(`No hay estancias de "${selectedEmpresa}" en el rango seleccionado.`);
        return;
      }

      const days     = getDaysInRange(startDate, endDate);
      const dataRows = buildDataRows(stays, days, tarifas);
      const grandTotal = dataRows.reduce((a, r) => a + r.total, 0);
      const totalCant  = dataRows.reduce((a, r) => a + r.cant, 0);

      const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
      const pageW  = doc.internal.pageSize.getWidth();  // 297
      const margin = 12;
      let y = margin;

      // ── Logo ────────────────────────────────────────────────────────────────
      let logoLoaded = false;
      if (hotelConfig?.logo_url) {
        try {
          const b64 = await loadImageAsBase64(hotelConfig.logo_url);
          doc.addImage(b64, 'PNG', margin, y, 22, 22);
          logoLoaded = true;
        } catch { /* skip logo on error */ }
      }

      // ── Hotel name + title (centered) ────────────────────────────────────────
      const hotelName = (hotelConfig?.name ?? 'HOTEL').toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(hotelName, pageW / 2, logoLoaded ? y + 8 : y + 5, { align: 'center' });
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text('VALORIZACIÓN DE ALOJAMIENTO', pageW / 2, logoLoaded ? y + 15 : y + 12, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      y += logoLoaded ? 26 : 18;

      // ── Fiscal info block ────────────────────────────────────────────────────
      const infoLines: [string, string][] = [
        ['RAZÓN SOCIAL',     hotelConfig?.razon_social    ?? ''],
        ['RUC',              hotelConfig?.ruc              ?? ''],
        ['DIRECCIÓN',        hotelConfig?.direccion        ?? ''],
        ['N° CTA. BANCARIA', hotelConfig?.cuenta_bancaria  ?? ''],
        ['CCI',              hotelConfig?.cci              ?? ''],
        ['N° DETRACCIÓN',    hotelConfig?.n_detraccion     ?? ''],
      ];

      // 2-column layout — left 3 items, right 3 items
      const colMid = pageW / 2 - 5;
      doc.setFontSize(7.5);
      infoLines.slice(0, 3).forEach(([label, val], i) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, y + i * 5);
        doc.setFont('helvetica', 'normal');
        doc.text(val, margin + 30, y + i * 5);
      });
      infoLines.slice(3).forEach(([label, val], i) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, colMid, y + i * 5);
        doc.setFont('helvetica', 'normal');
        doc.text(val, colMid + 30, y + i * 5);
      });

      y += 17;

      // ── Empresa + periodo (centered band) ────────────────────────────────────
      doc.setFillColor(184, 204, 228);
      doc.roundedRect(margin, y - 1, pageW - margin * 2, 8, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(
        `EMPRESA: ${selectedEmpresa}   |   DEL ${formatDateLabel(startDate)} AL ${formatDateLabel(endDate)}`,
        pageW / 2, y + 4.5,
        { align: 'center' },
      );

      y += 12;

      // ── Build table ──────────────────────────────────────────────────────────
      const usable = pageW - margin * 2;
      // Compact fixed cols to give maximum room to the day columns
      const W_NUM   = 6;
      const W_NAME  = 38;
      const W_CARGO = 16;
      const W_DNI   = 14;
      const W_CANT  = 8;
      const W_TAR   = 14;
      const W_TOT   = 18;
      const fixedW  = W_NUM + W_NAME + W_CARGO + W_DNI;
      const tailW   = W_CANT + W_TAR + W_TOT;
      // Give each day column an equal share; no upper cap so 2-digit numbers always fit
      const dayW    = Math.max(5, (usable - fixedW - tailW) / days.length);

      const head = [['N°', 'NOMBRES Y APELLIDOS', 'CARGO', 'DNI', ...days.map(d => `${d.getDate()}`), 'CANT', 'TARIFA', 'TOTAL']];

      // Totals row per day column
      const dayTotals = days.map((_, i) =>
        dataRows.reduce((acc, r) => acc + (r.dayVals[i] === '1' ? 1 : 0), 0)
      );

      const body = [
        ...dataRows.map(r => [
          `${r.item}`,
          r.nombre,
          r.cargo,
          r.dni,
          ...r.dayVals,
          `${r.cant}`,
          `S/ ${r.tarifa.toFixed(2)}`,
          `S/ ${r.total.toFixed(2)}`,
        ]),
        // Totals row
        ['', 'TOTAL', '', '',
          ...dayTotals.map(s => s > 0 ? `${s}` : ''),
          `${totalCant}`, '',
          `S/ ${grandTotal.toFixed(2)}`],
      ];

      const totalsRowIdx = body.length - 1;

      autoTable(doc, {
        startY: y,
        head,
        body,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: {
          fontSize: 6,
          cellPadding: { top: 1.2, bottom: 1.2, left: 0.8, right: 0.8 },
          valign: 'middle',
          overflow: 'ellipsize',
        },
        headStyles: {
          fillColor: [184, 204, 228],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 6,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: W_NUM },
          1: { halign: 'left',   cellWidth: W_NAME },
          2: { halign: 'center', cellWidth: W_CARGO, fontSize: 5.5, overflow: 'visible' },
          3: { halign: 'center', cellWidth: W_DNI },
          ...Object.fromEntries(
            days.map((_, i) => [4 + i, { halign: 'center', cellWidth: dayW, cellPadding: { top: 1.2, bottom: 1.2, left: 0.3, right: 0.3 } }])
          ),
          [4 + days.length]:     { halign: 'center', cellWidth: W_CANT },
          [4 + days.length + 1]: { halign: 'right',  cellWidth: W_TAR },
          [4 + days.length + 2]: { halign: 'right',  cellWidth: W_TOT },
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const isDayCol = data.column.index >= 4 && data.column.index < 4 + days.length;
            if (data.row.index === totalsRowIdx) {
              data.cell.styles.fillColor  = [217, 217, 217];
              data.cell.styles.fontStyle  = 'bold';
              data.cell.styles.halign     = isDayCol ? 'center' : data.column.index <= 1 ? 'center' : 'right';
            } else if (isDayCol && data.cell.raw === '1') {
              data.cell.styles.fillColor = [146, 208, 80];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      // ── Summary block ────────────────────────────────────────────────────────
      const igv      = grandTotal * 0.18;
      const totalFin = grandTotal + igv;

      // @ts-expect-error jspdf-autotable attaches lastAutoTable at runtime
      const tableEndY: number = doc.lastAutoTable?.finalY ?? y + 40;

      const summaryW    = 60;
      const summaryX    = pageW - margin - summaryW;
      const summaryData = [
        ['SUB TOTAL', `S/ ${grandTotal.toFixed(2)}`],
        ['IGV 18%',   `S/ ${igv.toFixed(2)}`],
        ['TOTAL',     `S/ ${totalFin.toFixed(2)}`],
      ];

      autoTable(doc, {
        startY: tableEndY + 4,
        body: summaryData,
        margin: { left: summaryX, right: margin },
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          fillColor: [217, 217, 217],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' },
          1: { cellWidth: 30, halign: 'right' },
        },
      });

      // ── Firma ────────────────────────────────────────────────────────────────
      if (hotelConfig?.firma_url) {
        try {
          const firmaPng = await loadImageAsBase64(hotelConfig.firma_url);
          // @ts-expect-error jspdf-autotable attaches lastAutoTable at runtime
          const summaryEndY: number = doc.lastAutoTable?.finalY ?? tableEndY + 30;
          const firmaH = 30;
          const firmaW = 60;
          const firmaX = (pageW - firmaW) / 2;
          const firmaY = summaryEndY + 8;
          doc.addImage(firmaPng, 'PNG', firmaX, firmaY, firmaW, firmaH);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text('Firma', pageW / 2, firmaY + firmaH + 4, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        } catch { /* skip firma on error */ }
      }

      // ── Small ValStay maker mark + page footer ──────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(205, 205, 205);
        doc.text('by ValStay', margin, pageH - 5.5);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Pág. ${p} / ${totalPages}`,
          pageW - margin, pageH - 5,
          { align: 'right' },
        );
        doc.setTextColor(0, 0, 0);
      }

      const safeName = selectedEmpresa.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`valorizacion_${safeName}_${startDate}_al_${endDate}.pdf`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-zinc-100">Emitir valorización</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Define las tarifas antes de generar el archivo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {lockedContext && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="font-bold text-emerald-800 dark:text-emerald-300">{selectedEmpresa}</p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Periodo: {formatDateLabel(startDate)} al {formatDateLabel(endDate)}
              </p>
            </div>
          )}

          {/* Empresa */}
          {!lockedContext && (
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              Empresa
            </label>
            {loadingEmpresas ? (
              <div className="h-11 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
            ) : empresas.length === 0 ? (
              <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                No hay estancias con empresa asignada registradas.
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={selectedEmpresa}
                  onChange={e => setSelectedEmpresa(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl pl-10 pr-8 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                >
                  <option value="">-- Seleccionar empresa --</option>
                  {empresas.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          )}

     {/* Tarifas */}
{selectedEmpresa && (
  <div className="space-y-3">
    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
      Tarifas por persona / noche
    </label>

    {loadingWorkerTypes ? (
      <div className="h-11 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
    ) : workerTypesPresent.length === 0 ? (
      <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        No hay cargos registrados para esta empresa en el rango seleccionado.
      </div>
    ) : (
      <div
        className={`grid grid-cols-1 gap-3 ${
          workerTypesPresent.length === 2
            ? 'sm:grid-cols-2'
            : workerTypesPresent.length === 3
              ? 'sm:grid-cols-3'
              : ''
        }`}
      >
        {workerTypesPresent.includes('obrero') && (
          <TarifaInput
            label="Obrero"
            value={tarifaObrero}
            onChange={setTarifaObrero}
          />
        )}

        {workerTypesPresent.includes('empleado') && (
          <TarifaInput
            label="Empleado"
            value={tarifaEmpleado}
            onChange={setTarifaEmpleado}
          />
        )}

        {workerTypesPresent.includes('staff') && (
          <TarifaInput
            label="Staff"
            value={tarifaStaff}
            onChange={setTarifaStaff}
          />
        )}
      </div>
    )}

    <p className="text-xs text-gray-400 dark:text-zinc-500">
      {savingRates ? 'Guardando tarifas…' : 'Las tarifas se guardan automáticamente por empresa.'}
      {' '}El día de salida no se cobra. Solo se cobran las noches pernoctadas.
    </p>
  </div>
)}

          {/* Date range */}
          {!lockedContext && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                Fecha inicio
              </label>
              <input
                type="date"
                value={startDate}
                max={lastNightStr}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                Fecha fin
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={lastNightStr}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              />
            </div>
          </div>
          )}

         {/* Summary */}
{canExport && (
  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
    <p>
      <span className="font-bold">{dayCount} días</span> de{' '}
      <span className="font-bold">{selectedEmpresa}</span>
    </p>

    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
      {workerTypesPresent.includes('obrero') && (
        <span>
          Obrero: <strong>S/ {tarifas.obrero.toFixed(2)}</strong>
        </span>
      )}

      {workerTypesPresent.includes('empleado') && (
        <span>
          Empleado: <strong>S/ {tarifas.empleado.toFixed(2)}</strong>
        </span>
      )}

      {workerTypesPresent.includes('staff') && (
        <span>
          Staff: <strong>S/ {tarifas.staff.toFixed(2)}</strong>
        </span>
      )}
    </div>
  </div>
)}

          {!hotelConfig?.razon_social && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              Completa los datos fiscales en <strong>Mi Hotel</strong> para que aparezcan en el encabezado del archivo.
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-none px-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isLoading || !canExport}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {pdfLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {pdfLoading ? 'Generando...' : 'PDF'}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isLoading || !canExport}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {excelLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {excelLoading ? 'Generando...' : 'Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
function TarifaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
        {label}
      </label>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400 text-sm font-semibold">
          S/
        </span>

        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="0.00"
          className="w-full pl-9 pr-3 py-2.5 border border-emerald-300 dark:border-emerald-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-300 font-semibold"
        />
      </div>
    </div>
  );
}
