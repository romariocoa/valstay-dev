import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Base anon client — used only for unauthenticated calls (login RPC).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Session-aware client — carries x-session-token header for RLS context.
let _sessionClient: ReturnType<typeof createClient> | null = null;

export function setSession(token: string | null): void {
  _sessionClient = token
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { 'x-session-token': token } },
      })
    : null;
}

// Use this for all authenticated data operations.
export function getClient() {
  return _sessionClient ?? supabase;
}

export type Room = {
  id: string;
  number: string;
  floor: number;
  type: 'single' | 'double' | 'suite' | 'family' | 'sala' | 'lavanderia' | 'almacen' | 'tienda';
  capacity: number;
  price_per_night: number;
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning';
  pos_x: number | null;
  pos_y: number | null;
  cell_width: number;
  cell_height: number;
  created_at: string;
};

export type Guest = {
  id: string;
  dni: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type Stay = {
  id: string;
  guest_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  baja_start_date: string | null;
  baja_end_date: string | null;
  status: 'active' | 'checked_out' | 'baja' | 'completed';
  total_amount: number | null;
  notes: string | null;
  empresa: string | null;
  worker_type: 'obrero' | 'empleado' | 'staff' | null;
  payment_method: 'efectivo' | 'tarjeta' | 'yape' | 'plin' | null;
  payment_receipt_url: string | null;
  created_at: string;
  updated_at: string;
  guests?: Guest;
  rooms?: Room;
};

export type StayWithDetails = Stay & {
  guests: Guest;
  rooms: Room;
};

export type Company = {
  id: string;
  name: string;
  created_at: string;
};

export type HotelConfig = {
  id: number;
  tenant_id: string;
  name: string;
  logo_url: string | null;
  razon_social: string | null;
  ruc: string | null;
  direccion: string | null;
  cuenta_bancaria: string | null;
  cci: string | null;
  n_detraccion: string | null;
  firma_url: string | null;
  yape_qr_url: string | null;
  plin_qr_url: string | null;
  notifications_enabled: boolean;
  notification_time: string;
  updated_at: string;
};
