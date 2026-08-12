import { useState } from 'react';
import { Building2, FileText, Loader2, ReceiptText, X } from 'lucide-react';
import { useEffect } from 'react';
import { useRucLookup } from '../hooks/useRucLookup';

export type ReceiptRequest =
  | { type: 'none' }
  | { type: 'boleta' }
  | { type: 'factura'; ruc: string; businessName: string; fiscalAddress: string };

interface ReceiptChoiceModalProps {
  guestName: string;
  loading?: boolean;
  onContinue: (request: ReceiptRequest) => void;
  onCancel: () => void;
}

export function ReceiptChoiceModal({ guestName, loading = false, onContinue, onCancel }: ReceiptChoiceModalProps) {
  const [type, setType] = useState<'none' | 'boleta' | 'factura'>('none');
  const [ruc, setRuc] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState('');
  const { data: rucData, loading: rucLoading, error: rucError } = useRucLookup(ruc);
  useEffect(() => {
    if (!rucData) return;
    setBusinessName(rucData.razon_social);
    setFiscalAddress(rucData.direccion);
  }, [rucData]);
  const facturaValid = /^\d{11}$/.test(ruc) && businessName.trim() && fiscalAddress.trim();

  const submit = () => {
    if (type === 'factura') {
      if (!facturaValid) return;
      onContinue({ type, ruc, businessName: businessName.trim(), fiscalAddress: fiscalAddress.trim() });
      return;
    }
    onContinue({ type });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-zinc-100">¿Desea comprobante?</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{guestName} · La elección es opcional.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-2">
          {([
            { value: 'none' as const, label: 'Sin comprobante', description: 'Continuar con la salida actual', icon: X },
            { value: 'boleta' as const, label: 'Boleta', description: 'Usar los datos del huésped', icon: ReceiptText },
            { value: 'factura' as const, label: 'Factura', description: 'Registrar los datos de la empresa', icon: Building2 },
          ]).map(option => {
            const Icon = option.icon;
            const selected = type === option.value;
            return (
              <button key={option.value} type="button" onClick={() => setType(option.value)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30' : 'border-gray-200 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'}`}><Icon className="h-5 w-5" /></span>
                <span><span className="block text-sm font-bold text-gray-900 dark:text-zinc-100">{option.label}</span><span className="text-xs text-gray-500 dark:text-zinc-400">{option.description}</span></span>
              </button>
            );
          })}
        </div>

        {type === 'factura' && (
          <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-300">RUC *<div className="relative mt-1"><input value={ruc} onChange={event => setRuc(event.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="11 dígitos" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-800" />{rucLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />}</div>{rucData && <span className="mt-1 block text-[11px] font-medium text-emerald-600">{rucData.estado} · {rucData.condicion}</span>}{rucError && <span className="mt-1 block text-[11px] text-red-600">{rucError}</span>}</label>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-300">Razón social *<input value={businessName} onChange={event => setBusinessName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-300">Dirección fiscal *<input value={fiscalAddress} onChange={event => setFiscalAddress(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" /></label>
          </div>
        )}

        {type !== 'none' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">La solicitud quedará guardada. La emisión electrónica se habilitará al conectar el proveedor SUNAT.</p>}

        <button type="button" onClick={submit} disabled={loading || (type === 'factura' && !facturaValid)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-700 dark:hover:bg-zinc-600">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {type === 'none' ? 'Continuar sin comprobante' : `Solicitar ${type}`}
        </button>
      </div>
    </div>
  );
}
