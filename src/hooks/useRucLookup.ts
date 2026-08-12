import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';

export interface RucLookupResult {
  ruc: string;
  razon_social: string;
  direccion: string;
  estado: string;
  condicion: string;
}

export function useRucLookup(ruc: string) {
  const [data, setData] = useState<RucLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    if (!/^\d{11}$/.test(ruc)) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const sessionToken = getSession()?.sessionToken;
        let response: Response | null = null;
        try {
          response = await fetch(`${supabaseUrl}/functions/v1/lookup-ruc?ruc=${ruc}`, {
            signal: controller.signal,
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'x-session-token': sessionToken ?? '' },
          });
        } catch (primaryError) {
          if (primaryError instanceof DOMException && primaryError.name === 'AbortError') throw primaryError;
          // Continue to the temporary provider below when the Edge Function
          // has not been deployed yet or the gateway is temporarily offline.
        }
        // Temporary bridge while the local SUNAT directory/function is being
        // deployed and populated. OpenRUC only covers legal entities (RUC 20).
        if ((!response || !response.ok) && ruc.startsWith('20')) {
          response = await fetch(`https://openruc.com/api/ruc/${ruc}`, { signal: controller.signal });
        }
        if (!response) throw new Error('La API propia de RUC aún no está desplegada. Completa la instalación para consultar RUC 10.');
        if (response.status === 404 && !ruc.startsWith('20')) {
          throw new Error('La API propia de RUC aún no está desplegada o el padrón todavía no fue cargado.');
        }
        if (!response.ok) throw new Error(response.status === 404 ? 'RUC no encontrado en el padrón.' : 'No se pudo consultar el RUC.');
        const result = await response.json() as Partial<RucLookupResult>;
        if (!result.razon_social) throw new Error('La consulta no devolvió una razón social.');
        setData({
          ruc,
          razon_social: result.razon_social,
          direccion: result.direccion ?? '',
          estado: result.estado ?? '',
          condicion: result.condicion ?? '',
        });
      } catch (lookupError) {
        if (lookupError instanceof DOMException && lookupError.name === 'AbortError') return;
        setError(lookupError instanceof Error ? lookupError.message : 'No se pudo consultar el RUC.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [ruc]);

  return { data, loading, error };
}
