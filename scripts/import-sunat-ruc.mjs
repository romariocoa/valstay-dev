import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sourcePath = process.argv[2];
const sourceDate = process.argv[3] || new Date().toISOString().slice(0, 10);
if (!supabaseUrl || !serviceKey || !sourcePath) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:sunat-ruc -- archivo.zip YYYY-MM-DD');
  process.exit(1);
}

const input = sourcePath.endsWith('.zip')
  ? spawn('unzip', ['-p', sourcePath], { stdio: ['ignore', 'pipe', 'inherit'] }).stdout
  : createReadStream(sourcePath);
input.setEncoding('latin1');
const lines = createInterface({ input, crlfDelay: Infinity });
let batch = [];
let imported = 0;

async function sendBatch() {
  if (!batch.length) return;
  const response = await fetch(`${supabaseUrl}/rest/v1/sunat_taxpayers?on_conflict=ruc`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(batch),
  });
  if (!response.ok) throw new Error(`Error importando: ${response.status} ${await response.text()}`);
  imported += batch.length;
  if (imported % 10000 === 0) console.log(`${imported.toLocaleString('es-PE')} registros importados`);
  batch = [];
}

for await (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;
  const [ruc, businessName, status = '', condition = '', ubigeo = '', ...addressParts] = line.split('|');
  if (!/^\d{11}$/.test(ruc) || !businessName || /^RUC$/i.test(ruc)) continue;
  batch.push({ ruc, business_name: businessName.trim(), status: status.trim(), condition: condition.trim(), ubigeo: ubigeo.trim(), fiscal_address: addressParts.join('|').trim(), source_updated_at: sourceDate, imported_at: new Date().toISOString() });
  if (batch.length >= 1000) await sendBatch();
}
await sendBatch();
console.log(`Importación completa: ${imported.toLocaleString('es-PE')} registros.`);
