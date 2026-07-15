import { useState, useEffect, useCallback } from 'react';
import { getClient, Room, Guest, StayWithDetails, Company, HotelConfig } from '../lib/supabase';

export function useRooms(tenantId: string | null) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!tenantId) { setRooms([]); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await getClient()
        .from('rooms')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('number', { ascending: true });

      if (fetchError) throw fetchError;
      setRooms(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching rooms');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  return { rooms, loading, error, refetch: fetchRooms };
}

export function useGuests(tenantId: string | null) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuests = useCallback(async () => {
    if (!tenantId) { setGuests([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error: fetchError } = await getClient()
        .from('guests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setGuests(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching guests');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  return { guests, loading, error, refetch: fetchGuests };
}

export function useGuestByDni(dni: string, tenantId: string | null) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dni || dni.length < 3 || !tenantId) {
      setGuest(null);
      return;
    }

    const fetchGuest = async () => {
      setLoading(true);
      try {
        const { data, error } = await getClient()
          .from('guests')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('dni', dni)
          .maybeSingle();

        if (error) throw error;
        setGuest(data);
      } catch (err) {
        console.error('Error fetching guest by DNI:', err);
        setGuest(null);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchGuest, 300);
    return () => clearTimeout(timeoutId);
  }, [dni, tenantId]);

  return { guest, loading };
}

export function useStays(tenantId: string | null) {
  const [stays, setStays] = useState<StayWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStays = useCallback(async () => {
    if (!tenantId) { setStays([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error: fetchError } = await getClient()
        .from('stays')
        .select('*, guests(*), rooms(*)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setStays(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching stays');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchStays(); }, [fetchStays]);

  return { stays, loading, error, refetch: fetchStays };
}

export function useActiveStays(tenantId: string | null) {
  const [stays, setStays] = useState<StayWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStays = useCallback(async () => {
    if (!tenantId) { setStays([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await getClient()
        .from('stays')
        .select('*, guests(*), rooms(*)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'baja'])
        .order('check_in_date', { ascending: true });

      if (error) throw error;
      setStays(data || []);
    } catch (err) {
      console.error('Error fetching active stays:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchStays(); }, [fetchStays]);

  return { stays, loading, refetch: fetchStays };
}

export function useStayHistory(tenantId: string | null, roomId?: string) {
  const [stays, setStays] = useState<StayWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tenantId) { setStays([]); setLoading(false); return; }
    setLoading(true);
    let query = getClient()
      .from('stays')
      .select('*, guests(*), rooms(*)')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (roomId) query = query.eq('room_id', roomId);

    const { data } = await query;
    setStays(data || []);
    setLoading(false);
  }, [tenantId, roomId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { stays, loading, refetch: fetch };
}

export function useCompanies(tenantId: string | null) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tenantId) { setCompanies([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await getClient()
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    setCompanies(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCompany = async (name: string): Promise<Company | null> => {
    if (!tenantId) return null;
    const { data, error } = await getClient()
      .from('companies')
      .insert({ name: name.trim(), tenant_id: tenantId })
      .select()
      .single();
    if (error || !data) return null;
    await fetch();
    return data;
  };

  const deleteCompany = async (id: string): Promise<{ error?: string }> => {
    const { error } = await getClient().from('companies').delete().eq('id', id);
    if (error) return { error: error.message };
    setCompanies(prev => prev.filter(c => c.id !== id));
    return {};
  };

  return { companies, loading, refetch: fetch, addCompany, deleteCompany };
}

const DEFAULT_CONFIG: HotelConfig = {
  id: 0, tenant_id: '', name: 'Hotel Manager', logo_url: null,
  razon_social: null, ruc: null, direccion: null,
  cuenta_bancaria: null, cci: null, n_detraccion: null,
  firma_url: null,
  yape_qr_url: null, plin_qr_url: null,
  notifications_enabled: false, notification_time: '07:00:00',
  updated_at: '',
};

export function useHotelConfig(tenantId: string | null, sessionToken?: string) {
  const [config, setConfig] = useState<HotelConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tenantId) { setConfig(DEFAULT_CONFIG); setLoading(false); return; }
    setLoading(true);
    const { data } = await getClient()
      .from('hotel_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (data) setConfig(data as HotelConfig);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (updates: Partial<HotelConfig>): Promise<{ error?: string }> => {
    if (!tenantId) return { error: 'Sin tenant activo' };
    if (!sessionToken) return { error: 'Sesion no disponible' };

    // Logo and firma are sent separately to avoid huge payloads in the fields call
    const hasLogoChange  = 'logo_url'  in updates;
    const hasFirmaChange = 'firma_url' in updates;
    const hasPaymentQrChange = 'yape_qr_url' in updates || 'plin_qr_url' in updates;
    const hasNotificationChange = 'notifications_enabled' in updates || 'notification_time' in updates;
    const hasFieldChange = [
      'name',
      'razon_social',
      'ruc',
      'direccion',
      'cuenta_bancaria',
      'cci',
      'n_detraccion',
    ].some(field => field in updates);

    if (hasFieldChange) {
      const { error: fieldsErr } = await getClient().rpc('save_hotel_fields', {
        p_session_token:   sessionToken,
        p_name:            updates.name ?? config.name,
        p_razon_social:    updates.razon_social ?? config.razon_social ?? null,
        p_ruc:             updates.ruc ?? config.ruc ?? null,
        p_direccion:       updates.direccion ?? config.direccion ?? null,
        p_cuenta_bancaria: updates.cuenta_bancaria ?? config.cuenta_bancaria ?? null,
        p_cci:             updates.cci ?? config.cci ?? null,
        p_n_detraccion:    updates.n_detraccion ?? config.n_detraccion ?? null,
      });
      if (fieldsErr) return { error: fieldsErr.message };
    }

    if (hasLogoChange) {
      const { error: logoErr } = await getClient().rpc('save_hotel_logo', {
        p_session_token: sessionToken,
        p_logo_url:      updates.logo_url ?? null,
      });
      if (logoErr) return { error: logoErr.message };
    }

    if (hasFirmaChange) {
      const { error: firmaErr } = await getClient().rpc('save_hotel_firma', {
        p_session_token: sessionToken,
        p_firma_url:     updates.firma_url ?? null,
      });
      if (firmaErr) return { error: firmaErr.message };
    }

    if (hasPaymentQrChange) {
      const { error: qrErr } = await getClient().rpc('save_hotel_payment_qrs', {
        p_session_token: sessionToken,
        p_yape_qr_url: updates.yape_qr_url ?? config.yape_qr_url ?? null,
        p_plin_qr_url: updates.plin_qr_url ?? config.plin_qr_url ?? null,
      });
      if (qrErr) return { error: qrErr.message };
    }

    if (hasNotificationChange) {
      const { error: notificationErr } = await getClient().rpc('save_hotel_notification_settings', {
        p_session_token: sessionToken,
        p_enabled: updates.notifications_enabled ?? config.notifications_enabled,
        p_notification_time: updates.notification_time ?? config.notification_time,
      });
      if (notificationErr) return { error: notificationErr.message };
    }

    setConfig(prev => ({ ...prev, ...updates }));
    return {};
  };

  return { config, loading, refetch: fetch, save };
}
