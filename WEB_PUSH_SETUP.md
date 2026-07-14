# Activación de Web Push en ValStay

El código del navegador, la migración y la Edge Function ya forman parte del proyecto. Estos pasos se realizan una vez por cada proyecto de Supabase (dev y producción).

## 1. Generar claves VAPID

Ejecuta localmente:

```bash
npx web-push generate-vapid-keys
```

Conserva la clave privada únicamente como secreto. Nunca la agregues a Git ni a un archivo público.

## 2. Aplicar la migración

```bash
npx supabase db push
```

La migración `20260714030000_042_web_push_subscriptions.sql` crea las suscripciones, el registro diario y las funciones RPC seguras.

## 3. Configurar secretos de la Edge Function

```bash
npx supabase secrets set VAPID_PUBLIC_KEY="CLAVE_PUBLICA"
npx supabase secrets set VAPID_PRIVATE_KEY="CLAVE_PRIVADA"
npx supabase secrets set VAPID_SUBJECT="mailto:soporte@valstay.com"
npx supabase secrets set PUSH_CRON_SECRET="SECRETO_LARGO_ALEATORIO"
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son proporcionados automáticamente por Supabase dentro de las Edge Functions.
`PUSH_CRON_SECRET` es obligatorio: la función no inicia si falta y rechaza toda solicitud que no envíe el encabezado correcto.

## 4. Desplegar la función

```bash
npx supabase functions deploy send-departure-push --no-verify-jwt
```

## 5. Configurar Vercel

Agrega la siguiente variable en el proyecto de Vercel y vuelve a desplegar:

```text
VITE_WEB_PUSH_PUBLIC_KEY=CLAVE_PUBLICA
```

Usa la misma clave pública configurada en Supabase. La clave privada nunca debe estar en Vercel ni usar el prefijo `VITE_`.

## 6. Programar la función

En Supabase abre **Integrations → Cron → Jobs** y crea un trabajo que se ejecute cada minuto:

```text
* * * * *
```

Configura una solicitud HTTP `POST` a:

```text
https://PROJECT_REF.supabase.co/functions/v1/send-departure-push
```

Agrega este encabezado usando el mismo secreto del paso 3:

```text
x-cron-secret: SECRETO_LARGO_ALEATORIO
```

La función compara la hora actual de Lima con el horario de cada hotel. El registro `push_delivery_log` evita envíos duplicados durante el mismo día.

## 7. Registrar dispositivos

Después del despliegue, cada administrador o recepcionista debe entrar a ValStay desde su celular o computadora y pulsar **Activar notificaciones**. Cada navegador se registra por separado.

En celulares, instala ValStay en la pantalla de inicio cuando el sistema o navegador lo requiera para recibir avisos en segundo plano. En iPhone/iPad este paso es obligatorio para Web Push.

## 8. Verificación final

1. Confirma que el cron usa `POST` y envía `x-cron-secret`.
2. Activa las notificaciones en un dispositivo administrador o recepcionista.
3. Verifica que exista una fila en `push_subscriptions` para ese dispositivo.
4. Crea una salida pendiente y revisa los logs de `send-departure-push`.
5. Confirma una sola fila por hotel y fecha en `push_delivery_log`.
