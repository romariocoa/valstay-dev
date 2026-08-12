import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle, ExternalLink, Eye, FilePlus2, FileText, Loader2, MessageCircle, ReceiptText, Save, Search, Settings, X } from 'lucide-react';
import { HotelConfig } from '../lib/supabase';
import { useRucLookup } from '../hooks/useRucLookup';
import jsPDF from 'jspdf';

type BillingTab = 'new' | 'issued' | 'settings';
type BillingSettings = {
  ruc: string; legalName: string; tradeName: string; fiscalAddress: string; ubigeo: string;
  invoiceSeries: string; currency: 'PEN' | 'USD'; igvRate: number; logoUrl: string; whatsappPhone: string;
};
type InternalInvoice = {
  id: string; series: string; number: number; issuedAt: string; customerRuc: string;
  customerName: string; customerPhone: string; description: string; subtotal: number; igv: number; total: number; currency: string;
};

const defaultSettings = (config: HotelConfig): BillingSettings => ({
  ruc: config.ruc ?? '', legalName: config.razon_social ?? '', tradeName: config.name,
  fiscalAddress: config.direccion ?? '', ubigeo: '', invoiceSeries: config.tax_settings?.invoice_series ?? 'F001',
  currency: 'PEN', igvRate: config.tax_settings?.igv_rate ?? 18, logoUrl: config.logo_url ?? '', whatsappPhone: '',
});
const money = (value: number, currency: string) => new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(value);

export function BillingModule({ tenantId, sessionToken, hotelConfig, readOnly = false }: { tenantId: string; sessionToken: string; hotelConfig: HotelConfig; readOnly?: boolean }) {
  const settingsKey = `valstay_billing_settings_${tenantId}`;
  const invoicesKey = `valstay_internal_invoices_${tenantId}`;
  const [tab, setTab] = useState<BillingTab>('new');
  const [settings, setSettings] = useState<BillingSettings>(() => {
    try { return { ...defaultSettings(hotelConfig), ...JSON.parse(localStorage.getItem(settingsKey) ?? '{}') }; }
    catch { return defaultSettings(hotelConfig); }
  });
  const [invoices, setInvoices] = useState<InternalInvoice[]>(() => {
    try { return JSON.parse(localStorage.getItem(invoicesKey) ?? '[]'); } catch { return []; }
  });
  const [customerRuc, setCustomerRuc] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('Servicio de hospedaje');
  const [total, setTotal] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InternalInvoice | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ invoice: InternalInvoice; url: string } | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState('');
  const { data: rucData, loading: rucLoading, error: rucError } = useRucLookup(customerRuc);
  useEffect(() => { if (rucData) setCustomerName(rucData.razon_social); }, [rucData]);

  const totals = useMemo(() => {
    const gross = Number(total) || 0;
    const subtotal = gross / (1 + settings.igvRate / 100);
    return { total: gross, subtotal, igv: gross - subtotal };
  }, [total, settings.igvRate]);

  const saveSettings = (event: FormEvent) => {
    event.preventDefault(); if (readOnly) return;
    localStorage.setItem(settingsKey, JSON.stringify(settings)); setNotice('Configuración guardada en este dispositivo.');
  };
  const issue = (event: FormEvent) => {
    event.preventDefault(); if (readOnly || !/^\d{11}$/.test(customerRuc) || !customerName.trim() || totals.total <= 0) return;
    const next = Math.max(0, ...invoices.map(invoice => invoice.number)) + 1;
    const invoice: InternalInvoice = { id: crypto.randomUUID(), series: settings.invoiceSeries, number: next, issuedAt: new Date().toISOString(), customerRuc, customerName: customerName.trim(), customerPhone: customerPhone.trim(), description: description.trim(), ...totals, currency: settings.currency };
    const updated = [invoice, ...invoices]; setInvoices(updated); localStorage.setItem(invoicesKey, JSON.stringify(updated));
    setNotice(`Factura interna ${invoice.series}-${String(next).padStart(8, '0')} creada.`); setCustomerRuc(''); setCustomerName(''); setCustomerPhone(''); setTotal(''); setTab('issued');
  };

  const createInvoicePdf = (invoice: InternalInvoice) => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = pdf.internal.pageSize.getWidth();
    const seriesNumber = `${invoice.series}-${String(invoice.number).padStart(8, '0')}`;
    const emitterName = settings.legalName || settings.tradeName || hotelConfig.name;

    pdf.setFillColor(20, 32, 52);
    pdf.rect(0, 0, width, 34, 'F');
    if (settings.logoUrl.startsWith('data:image/')) {
      try { pdf.addImage(settings.logoUrl, settings.logoUrl.includes('png') ? 'PNG' : 'JPEG', 14, 7, 24, 20, undefined, 'FAST'); } catch { /* The invoice remains usable without a logo. */ }
    }
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(settings.tradeName || hotelConfig.name, settings.logoUrl.startsWith('data:image/') ? 43 : 14, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(emitterName, settings.logoUrl.startsWith('data:image/') ? 43 : 14, 21);
    pdf.text(settings.fiscalAddress || 'Dirección fiscal sin configurar', settings.logoUrl.startsWith('data:image/') ? 43 : 14, 26, { maxWidth: 100 });

    pdf.setFillColor(245, 247, 250);
    pdf.setDrawColor(190, 198, 210);
    pdf.roundedRect(142, 7, 54, 23, 2, 2, 'FD');
    pdf.setTextColor(20, 32, 52);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(`RUC ${settings.ruc || 'SIN CONFIGURAR'}`, 169, 13, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('FACTURA INTERNA', 169, 20, { align: 'center' });
    pdf.setFontSize(9);
    pdf.text(seriesNumber, 169, 26, { align: 'center' });

    pdf.setTextColor(40, 48, 62);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DATOS DEL RECEPTOR', 14, 46);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Razón social: ${invoice.customerName}`, 14, 53);
    pdf.text(`RUC: ${invoice.customerRuc}`, 14, 59);
    pdf.text(`Fecha de emisión: ${new Date(invoice.issuedAt).toLocaleDateString('es-PE')}`, 125, 53);
    pdf.text(`Moneda: ${invoice.currency}`, 125, 59);

    pdf.setFillColor(235, 240, 247);
    pdf.rect(14, 69, 182, 9, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.text('DESCRIPCIÓN', 18, 75);
    pdf.text('CANT.', 133, 75, { align: 'center' });
    pdf.text('VALOR DE VENTA', 190, 75, { align: 'right' });
    pdf.setDrawColor(215, 220, 228);
    pdf.rect(14, 78, 182, 24);
    pdf.setFont('helvetica', 'normal');
    pdf.text(invoice.description, 18, 86, { maxWidth: 105 });
    pdf.text('1', 133, 86, { align: 'center' });
    pdf.text(money(invoice.subtotal, invoice.currency), 190, 86, { align: 'right' });

    const valueX = 190;
    pdf.text('Subtotal:', 145, 116);
    pdf.text(money(invoice.subtotal, invoice.currency), valueX, 116, { align: 'right' });
    pdf.text(`IGV (${settings.igvRate}%):`, 145, 124);
    pdf.text(money(invoice.igv, invoice.currency), valueX, 124, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('TOTAL:', 145, 135);
    pdf.text(money(invoice.total, invoice.currency), valueX, 135, { align: 'right' });

    pdf.setFillColor(255, 247, 224);
    pdf.setDrawColor(235, 185, 70);
    pdf.roundedRect(14, 153, 182, 17, 2, 2, 'FD');
    pdf.setTextColor(135, 88, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('DOCUMENTO INTERNO DE PRUEBA', 18, 160);
    pdf.setFont('helvetica', 'normal');
    pdf.text('No ha sido enviado ni aceptado por SUNAT y no tiene validez tributaria.', 18, 166);

    pdf.setTextColor(120, 126, 138);
    pdf.setFontSize(8);
    pdf.text(`Generado por ValStay · ${new Date().toLocaleString('es-PE')}`, width / 2, 286, { align: 'center' });
    return pdf;
  };

  const openInvoicePdf = (invoice: InternalInvoice) => {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url);
    const url = URL.createObjectURL(createInvoicePdf(invoice).output('blob'));
    setPdfPreview({ invoice, url });
  };

  const closePdfPreview = () => {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url);
    setPdfPreview(null);
  };

  const sendInvoiceWhatsApp = (invoice: InternalInvoice) => {
    const digits = (invoice.customerPhone || '').replace(/\D/g, '');
    if (!digits) return;
    const phone = digits.length === 9 && digits.startsWith('9') ? `51${digits}` : digits;
    const number = `${invoice.series}-${String(invoice.number).padStart(8, '0')}`;
    const message = [
      `Hola ${invoice.customerName},`,
      `te compartimos los datos de tu factura interna ${number}.`,
      `Importe total: ${money(invoice.total, invoice.currency)}.`,
      '',
      'El archivo PDF puede descargarse desde ValStay. Este documento aún no tiene validez SUNAT.',
    ].join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const shareInvoicePdf = async (invoice: InternalInvoice) => {
    if (!invoice.customerPhone || sendingWhatsApp) return;
    setSendingWhatsApp(true);
    setWhatsAppError('');
    const number = `${invoice.series}-${String(invoice.number).padStart(8, '0')}`;
    try {
      const blob = createInvoicePdf(invoice).output('blob');
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('No se pudo preparar el PDF'));
        reader.readAsDataURL(blob);
      });
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-whatsapp`, {
        method: 'POST',
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'x-session-token': sessionToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: number, recipientPhone: invoice.customerPhone, pdfBase64 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo crear el enlace del PDF.');
      const digits = invoice.customerPhone.replace(/\D/g, '');
      const phone = digits.length === 9 && digits.startsWith('9') ? `51${digits}` : digits;
      const message = [
        `Hola ${invoice.customerName},`,
        `puedes descargar tu factura interna ${number} desde este enlace:`,
        result.downloadUrl,
        '',
        'El enlace estará disponible durante 7 días.',
        'Este documento todavía no tiene validez SUNAT.',
      ].join('\n');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      setNotice(`Enlace del PDF ${number} preparado para WhatsApp.`);
    } catch (sendError) {
      setWhatsAppError(sendError instanceof Error ? sendError.message : 'No se pudo crear el enlace del PDF.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const tabs = [
    { id: 'new' as const, label: 'Nueva factura', icon: FilePlus2 },
    { id: 'issued' as const, label: 'Facturas emitidas', icon: ReceiptText },
    { id: 'settings' as const, label: 'Configuración de facturación', icon: Settings },
  ];
  const input = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
  const label = 'block text-xs font-semibold text-gray-600 dark:text-zinc-300 mb-1';

  return <div className="space-y-5">
    <div className="flex gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 dark:border-zinc-700 dark:bg-zinc-900">
      {tabs.map(item => <button key={item.id} onClick={() => { setTab(item.id); setNotice(''); }} className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${tab === item.id ? 'bg-gray-900 text-white dark:bg-zinc-700' : 'text-gray-500 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Fase 1: estos documentos son internos y todavía no tienen validez tributaria ni aceptación de SUNAT.</div>
    {notice && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle className="h-4 w-4" />{notice}</div>}

    {tab === 'new' && <form onSubmit={issue} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 flex items-center gap-2 font-bold dark:text-white"><FileText className="h-5 w-5" />Nueva factura interna</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>RUC del receptor *<div className="relative"><input className={`${input} pr-10`} value={customerRuc} onChange={e => setCustomerRuc(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="11 dígitos" />{rucLoading ? <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" /> : <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />}</div>{rucError && <span className="mt-1 block text-[11px] text-red-500">{rucError}</span>}</label>
        <label className={label}>Razón social *<input className={input} value={customerName} onChange={e => setCustomerName(e.target.value)} /></label>
        <label className={label}>Número de WhatsApp<input type="tel" inputMode="tel" className={input} value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 18))} placeholder="Ej: 987654321" /></label>
        <label className={label}>Descripción *<input className={input} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label className={label}>Total con IGV *<input type="number" min="0.01" step="0.01" className={input} value={total} onChange={e => setTotal(e.target.value)} /></label>
        <div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-zinc-800"><p>Subtotal: <strong>{money(totals.subtotal, settings.currency)}</strong></p><p>IGV ({settings.igvRate}%): <strong>{money(totals.igv, settings.currency)}</strong></p><p>Total: <strong>{money(totals.total, settings.currency)}</strong></p></div>
      </div>
      <button disabled={readOnly || !/^\d{11}$/.test(customerRuc) || !customerName.trim() || totals.total <= 0} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40"><FilePlus2 className="h-4 w-4" />Emitir factura interna</button>
    </form>}

    {tab === 'issued' && <div className="space-y-3">{invoices.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-zinc-700">Todavía no hay facturas internas.</div> : invoices.map(invoice => <div key={invoice.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-bold dark:text-white">{invoice.series}-{String(invoice.number).padStart(8, '0')}</p><p className="truncate text-xs text-gray-500">{invoice.customerName} · RUC {invoice.customerRuc}{invoice.customerPhone ? ` · ${invoice.customerPhone}` : ''}</p></div><div className="text-right"><p className="font-black dark:text-white">{money(invoice.total, invoice.currency)}</p><p className="text-xs text-gray-400">{new Date(invoice.issuedAt).toLocaleDateString('es-PE')}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedInvoice(invoice)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/30"><Eye className="h-4 w-4" />Ver</button><button type="button" onClick={() => openInvoicePdf(invoice)} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"><ExternalLink className="h-4 w-4" />PDF</button><button type="button" onClick={() => sendInvoiceWhatsApp(invoice)} disabled={!invoice.customerPhone} className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-zinc-700"><MessageCircle className="h-4 w-4" />WhatsApp</button></div></div>)}</div>}

    {tab === 'settings' && <form onSubmit={saveSettings} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><h3 className="mb-4 flex items-center gap-2 font-bold dark:text-white"><Building2 className="h-5 w-5" />Datos del emisor</h3><div className="grid gap-4 sm:grid-cols-2">
      <label className={label}>RUC *<input className={input} value={settings.ruc} onChange={e => setSettings({ ...settings, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })} /></label>
      <label className={label}>Razón social *<input className={input} value={settings.legalName} onChange={e => setSettings({ ...settings, legalName: e.target.value })} /></label>
      <label className={label}>Nombre comercial<input className={input} value={settings.tradeName} onChange={e => setSettings({ ...settings, tradeName: e.target.value })} /></label>
      <label className={label}>Ubigeo<input className={input} value={settings.ubigeo} onChange={e => setSettings({ ...settings, ubigeo: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="6 dígitos" /></label>
      <label className={`${label} sm:col-span-2`}>Dirección fiscal *<input className={input} value={settings.fiscalAddress} onChange={e => setSettings({ ...settings, fiscalAddress: e.target.value })} /></label>
      <label className={label}>Serie de factura<input className={input} value={settings.invoiceSeries} onChange={e => setSettings({ ...settings, invoiceSeries: e.target.value.toUpperCase().slice(0, 4) })} /></label>
      <label className={label}>Moneda por defecto<select className={input} value={settings.currency} onChange={e => setSettings({ ...settings, currency: e.target.value as 'PEN' | 'USD' })}><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select></label>
      <label className={label}>IGV (%)<input type="number" className={input} value={settings.igvRate} onChange={e => setSettings({ ...settings, igvRate: Number(e.target.value) })} /></label>
      <label className={label}>Número de WhatsApp<input className={input} value={settings.whatsappPhone} onChange={e => setSettings({ ...settings, whatsappPhone: e.target.value })} placeholder="Ej: 987654321" /></label>
      <label className={`${label} sm:col-span-2`}>Logo del hotel<input className={input} value={settings.logoUrl} onChange={e => setSettings({ ...settings, logoUrl: e.target.value })} placeholder="URL o logo configurado del hotel" /></label>
    </div><div className="mt-4 flex items-center gap-2 text-xs text-gray-500"><MessageCircle className="h-4 w-4 text-emerald-500" />El teléfono quedará preparado para el futuro envío por WhatsApp.</div><button disabled={readOnly} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white disabled:opacity-40 dark:bg-zinc-700"><Save className="h-4 w-4" />Guardar configuración</button></form>}
    {selectedInvoice && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-zinc-900" onClick={event => event.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Factura interna</p><h3 className="text-xl font-black text-gray-900 dark:text-white">{selectedInvoice.series}-{String(selectedInvoice.number).padStart(8, '0')}</h3></div><button onClick={() => setSelectedInvoice(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button></div>
        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Documento interno de prueba. No ha sido enviado ni aceptado por SUNAT.</div>
          <div className="grid gap-5 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-gray-400">Emisor</p><p className="mt-1 font-bold text-gray-900 dark:text-white">{settings.legalName || settings.tradeName || hotelConfig.name}</p><p className="text-sm text-gray-500">RUC {settings.ruc || 'Sin configurar'}</p><p className="text-sm text-gray-500">{settings.fiscalAddress || 'Dirección sin configurar'}</p></div><div><p className="text-xs font-bold uppercase text-gray-400">Receptor</p><p className="mt-1 font-bold text-gray-900 dark:text-white">{selectedInvoice.customerName}</p><p className="text-sm text-gray-500">RUC {selectedInvoice.customerRuc}</p>{selectedInvoice.customerPhone && <p className="text-sm text-gray-500">WhatsApp {selectedInvoice.customerPhone}</p>}<p className="mt-2 text-xs text-gray-400">Emisión: {new Date(selectedInvoice.issuedAt).toLocaleString('es-PE')}</p></div></div>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700"><div className="grid grid-cols-[1fr_auto] bg-gray-50 px-4 py-2 text-xs font-bold uppercase text-gray-500 dark:bg-zinc-800"><span>Descripción</span><span>Importe</span></div><div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4 text-sm"><span className="text-gray-700 dark:text-zinc-200">{selectedInvoice.description}</span><span className="font-bold dark:text-white">{money(selectedInvoice.subtotal, selectedInvoice.currency)}</span></div></div>
          <div className="ml-auto max-w-xs space-y-2 text-sm"><div className="flex justify-between gap-8"><span className="text-gray-500">Subtotal</span><strong>{money(selectedInvoice.subtotal, selectedInvoice.currency)}</strong></div><div className="flex justify-between gap-8"><span className="text-gray-500">IGV ({settings.igvRate}%)</span><strong>{money(selectedInvoice.igv, selectedInvoice.currency)}</strong></div><div className="flex justify-between gap-8 border-t border-gray-200 pt-2 text-lg dark:border-zinc-700"><span className="font-bold">Total</span><strong>{money(selectedInvoice.total, selectedInvoice.currency)}</strong></div></div>
          <button type="button" onClick={() => openInvoicePdf(selectedInvoice)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700"><ExternalLink className="h-4 w-4" />Abrir factura en PDF</button>
          <button type="button" onClick={() => sendInvoiceWhatsApp(selectedInvoice)} disabled={!selectedInvoice.customerPhone} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-zinc-700"><MessageCircle className="h-4 w-4" />Enviar datos por WhatsApp</button>
        </div>
      </div>
    </div>}
    {pdfPreview && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={closePdfPreview}>
      <div className="flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-zinc-800"><div><p className="text-xs font-semibold text-gray-400">Vista previa del PDF</p><h3 className="font-black text-gray-900 dark:text-white">{pdfPreview.invoice.series}-{String(pdfPreview.invoice.number).padStart(8, '0')}</h3></div><button type="button" onClick={closePdfPreview} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 bg-gray-200 p-2 dark:bg-zinc-950"><iframe src={pdfPreview.url} title={`Factura ${pdfPreview.invoice.series}`} className="h-full w-full rounded-lg bg-white" /></div>
        <div className="grid gap-2 border-t border-gray-200 bg-white p-3 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
          <button type="button" onClick={() => createInvoicePdf(pdfPreview.invoice).save(`${pdfPreview.invoice.series}-${String(pdfPreview.invoice.number).padStart(8, '0')}.pdf`)} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 py-3 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"><ExternalLink className="h-4 w-4" />Descargar PDF</button>
          <button type="button" onClick={() => void shareInvoicePdf(pdfPreview.invoice)} disabled={!pdfPreview.invoice.customerPhone || sendingWhatsApp} title={pdfPreview.invoice.customerPhone ? 'Enviar enlace por WhatsApp' : 'La factura no tiene número de WhatsApp'} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-zinc-700">{sendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}{sendingWhatsApp ? 'Creando enlace...' : 'Enviar enlace por WhatsApp'}</button>
          {whatsAppError && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">{whatsAppError}</p>}
        </div>
      </div>
    </div>}
  </div>;
}
