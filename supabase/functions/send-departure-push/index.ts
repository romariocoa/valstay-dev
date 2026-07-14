import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:soporte@valstay.com';
const cronSecret = Deno.env.get('PUSH_CRON_SECRET');
const HOTEL_TIME_ZONE = 'America/Lima';

if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !cronSecret) {
  throw new Error('Faltan secretos de Supabase, VAPID o PUSH_CRON_SECRET');
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const supabase = createClient(supabaseUrl, serviceRoleKey);

function limaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = limaNow();
  const lastNightDate = new Date(`${now.date}T12:00:00Z`);
  lastNightDate.setUTCDate(lastNightDate.getUTCDate() - 1);
  const lastCompletedNight = lastNightDate.toISOString().slice(0, 10);
  const { data: hotels, error: hotelError } = await supabase
    .from('hotel_config')
    .select('tenant_id, notification_time')
    .eq('notifications_enabled', true);

  if (hotelError) throw hotelError;
  const results: Array<Record<string, unknown>> = [];

  for (const hotel of hotels ?? []) {
    const configuredTime = String(hotel.notification_time || '07:00').slice(0, 5);
    if (now.time < configuredTime) continue;

    const { data: stays, error: stayError } = await supabase
      .from('stays')
      .select('id, empresa, rooms(number)')
      .eq('tenant_id', hotel.tenant_id)
      .in('status', ['active', 'baja'])
      .lte('check_out_date', lastCompletedNight);
    if (stayError) throw stayError;

    // Do not consume today's delivery when there is nothing to notify. This
    // lets the cron retry if a departure is registered later the same day.
    if ((stays?.length ?? 0) === 0) {
      results.push({ tenant_id: hotel.tenant_id, stays: 0, sent: 0 });
      continue;
    }

    // Claim this tenant/day immediately before sending. The unique constraint
    // makes this atomic, so overlapping cron executions cannot send twice.
    const { error: claimError } = await supabase.from('push_delivery_log').insert({
      tenant_id: hotel.tenant_id,
      notice_date: now.date,
      sent_count: 0,
    });
    if (claimError?.code === '23505') continue;
    if (claimError) throw claimError;

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('tenant_id', hotel.tenant_id);
    if (subscriptionError) {
      await supabase.from('push_delivery_log').delete()
        .eq('tenant_id', hotel.tenant_id).eq('notice_date', now.date);
      throw subscriptionError;
    }

    let sentCount = 0;
    const departureDetails = (stays ?? []).map(stay =>
      `Habitación ${stay.rooms?.number ?? '—'} · ${stay.empresa?.trim() || 'Particular'}`
    ).join('\n');
    const payload = JSON.stringify({
      title: 'ValStay ·',
      body: `${stays!.length} ${stays!.length === 1 ? 'huésped sale' : 'huéspedes salen'} hoy\n${departureDetails}`,
      url: '/?section=stays',
      tag: `departures-${hotel.tenant_id}-${now.date}`,
    });

    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload);
        sentCount += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        } else {
          console.error('No se pudo enviar push', error);
        }
      }
    }

    if (sentCount > 0) {
      const { error: logError } = await supabase
        .from('push_delivery_log')
        .update({ sent_count: sentCount })
        .eq('tenant_id', hotel.tenant_id)
        .eq('notice_date', now.date);
      if (logError) throw logError;
    } else {
      // No device received the message. Release the claim so the next cron
      // execution can retry after a transient push-provider failure.
      const { error: releaseError } = await supabase
        .from('push_delivery_log')
        .delete()
        .eq('tenant_id', hotel.tenant_id)
        .eq('notice_date', now.date);
      if (releaseError) throw releaseError;
    }
    results.push({ tenant_id: hotel.tenant_id, stays: stays?.length ?? 0, sent: sentCount });
  }

  return Response.json({ date: now.date, time: now.time, results });
});
