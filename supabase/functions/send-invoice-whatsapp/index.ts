import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Faltan secretos de Supabase');

const admin = createClient(supabaseUrl, serviceRoleKey);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const sessionToken = request.headers.get('x-session-token');
  if (!sessionToken) return reply({ error: 'Sesión requerida' }, 401);
  const anon = createClient(supabaseUrl, anonKey);
  const { data: sessions } = await anon.rpc('verify_session', { p_session_token: sessionToken });
  const session = sessions?.[0];
  if (!session?.tenant_id) return reply({ error: 'Sesión inválida' }, 401);

  const body = await request.json() as { invoiceNumber?: string; recipientPhone?: string; pdfBase64?: string };
  const phoneDigits = String(body.recipientPhone || '').replace(/\D/g, '');
  const recipient = phoneDigits.length === 9 && phoneDigits.startsWith('9') ? `51${phoneDigits}` : phoneDigits;
  if (!body.invoiceNumber || !/^\d{11,15}$/.test(recipient) || !body.pdfBase64) return reply({ error: 'Datos de envío incompletos' }, 400);
  const binary = Uint8Array.from(atob(body.pdfBase64), character => character.charCodeAt(0));
  if (binary.byteLength > 10 * 1024 * 1024) return reply({ error: 'El PDF supera 10 MB' }, 413);

  const safeNumber = body.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '');
  const path = `${session.tenant_id}/${crypto.randomUUID()}-${safeNumber}.pdf`;
  let { error: uploadError } = await admin.storage.from('invoice-documents').upload(path, binary, { contentType: 'application/pdf', upsert: false });
  if (uploadError && /bucket.*not found/i.test(uploadError.message)) {
    const { error: bucketError } = await admin.storage.createBucket('invoice-documents', {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['application/pdf'],
    });
    if (bucketError && !/already exists/i.test(bucketError.message)) {
      return reply({ error: `No se pudo crear el almacenamiento de facturas: ${bucketError.message}` }, 500);
    }
    ({ error: uploadError } = await admin.storage.from('invoice-documents').upload(path, binary, { contentType: 'application/pdf', upsert: false }));
  }
  if (uploadError) return reply({ error: `No se pudo almacenar el PDF: ${uploadError.message}` }, 500);
  const { data: signed, error: signedError } = await admin.storage.from('invoice-documents').createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signedError) return reply({ error: 'No se pudo crear el enlace temporal del PDF' }, 500);
  return reply({ downloadUrl: signed.signedUrl, expiresInDays: 7, recipient });
});
