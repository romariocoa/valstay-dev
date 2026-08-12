import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Faltan secretos de Supabase');

const admin = createClient(supabaseUrl, serviceRoleKey);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-session-token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });

  const sessionToken = request.headers.get('x-session-token');
  if (!sessionToken) return Response.json({ error: 'Sesión requerida' }, { status: 401, headers: cors });
  const anon = createClient(supabaseUrl, anonKey);
  const { data: session, error: sessionError } = await anon.rpc('verify_session', { p_session_token: sessionToken });
  if (sessionError || !session?.length) return Response.json({ error: 'Sesión inválida' }, { status: 401, headers: cors });

  const ruc = new URL(request.url).searchParams.get('ruc')?.trim() ?? '';
  if (!/^\d{11}$/.test(ruc)) return Response.json({ error: 'El RUC debe tener 11 dígitos' }, { status: 400, headers: cors });

  const { data, error } = await admin.from('sunat_taxpayers').select('ruc, business_name, status, condition, ubigeo, fiscal_address, source_updated_at').eq('ruc', ruc).maybeSingle();
  if (error) return Response.json({ error: 'No se pudo consultar el padrón' }, { status: 500, headers: cors });
  if (!data) return Response.json({ error: 'RUC no encontrado en el padrón local' }, { status: 404, headers: cors });

  return Response.json({
    ruc: data.ruc,
    razon_social: data.business_name,
    direccion: data.fiscal_address,
    estado: data.status,
    condicion: data.condition,
    ubigeo: data.ubigeo,
    actualizado: data.source_updated_at,
    source: 'SUNAT_PADRON_REDUCIDO',
  }, { headers: { ...cors, 'Cache-Control': 'private, max-age=86400' } });
});
