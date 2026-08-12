# API propia de consulta RUC

Esta primera versión consulta una copia local del Padrón Reducido del RUC de SUNAT.

## 1. Crear la estructura

Aplicar la migración `20260812030000_062_sunat_ruc_directory.sql` en Supabase.

## 2. Desplegar la API

```bash
supabase functions deploy lookup-ruc
```

La función utiliza automáticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`. Solo acepta consultas de sesiones válidas de ValStay.

## 3. Descargar el padrón

Descargar `padrón_reducido_RUC.zip` desde:

https://www.sunat.gob.pe/descargaPRR/mrc137_padron_reducido.html

## 4. Importar o actualizar

```bash
SUPABASE_URL=https://PROYECTO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=CLAVE_PRIVADA \
npm run import:sunat-ruc -- /ruta/padrón_reducido_RUC.zip 2026-08-12
```

La clave `service_role` es privada. No debe guardarse en `.env.local`, subirse a Git
ni exponerse en Vercel. El importador procesa el archivo por lotes y actualiza los
RUC existentes sin duplicarlos.

## Operación

- Repetir la descarga/importación cuando SUNAT publique una nueva versión.
- El frontend consulta `lookup-ruc` automáticamente al completar 11 dígitos.
- Mientras se completa el despliegue, los RUC iniciados en 20 usan OpenRUC como
  respaldo temporal. Los RUC iniciados en 10 requieren que el padrón local esté cargado.
