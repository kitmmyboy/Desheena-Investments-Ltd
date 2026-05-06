import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUSHY_SECRET_API_KEY = "adb4402ed1a8e20dbbcec7ac8d4a5ddf5806b65e503b40f054f60dbd8b0b8b43";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const now = new Date();
    
    // Check for collections in 3 days, 1 day, and today
    const intervals = [
      { days: 3, label: "in 3 days" },
      { days: 1, label: "tomorrow" },
      { days: 0, label: "today" }
    ];

    for (const interval of intervals) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + interval.days);
      const targetDay = targetDate.getDay();
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      // 1. Find schedules for this day
      const { data: schedules, error: schedError } = await supabase
        .from('collection_schedules')
        .select(`
          client_id,
          clients (
            name,
            zone,
            route_clients (
              route_id,
              routes (
                name,
                route_drivers (
                  user_id
                )
              )
            )
          )
        `)
        .or(`day_of_week.eq.${targetDay},specific_date.eq.${targetDateStr}`);

      if (schedError) throw schedError;

      for (const sched of schedules) {
        const client = sched.clients;
        const routeData = client.route_clients?.[0]?.routes;
        const driverId = routeData?.route_drivers?.[0]?.user_id;
        
        // --- Notify Client ---
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('client_id', sched.client_id)
          .maybeSingle();

        if (userData) {
          const title = 'Waste Collection Reminder';
          const body = `Your waste collection is scheduled for ${interval.label}. Please ensure it's ready.`;
          
          await createNotificationAndPush(
            userData.id,
            'collection_reminder',
            title,
            body,
            sched.client_id
          );
        }

        // --- Notify Driver ---
        if (driverId) {
          const title = 'Upcoming Collection';
          const body = `Collection for ${client.name} (${client.zone}) is scheduled for ${interval.label}.`;
          
          await createNotificationAndPush(
            driverId,
            'driver_collection_reminder',
            title,
            body,
            sched.client_id
          );
        }

        // --- Notify Admins ---
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .in('role', ['Admin', 'Operations_Manager']);

        if (admins) {
          for (const admin of admins) {
            await createNotificationAndPush(
              admin.id,
              'admin_collection_reminder',
              'System Reminder: Upcoming Collection',
              `Reminder: ${client.name} collection is ${interval.label}.`,
              sched.client_id
            );
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function createNotificationAndPush(userId: string, type: string, title: string, body: string, relatedId: string) {
  // 1. Store in DB
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    related_id: relatedId,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  // 2. Fetch Push Tokens (reusing fcm_tokens table for Pushy tokens)
  const { data: tokens } = await supabase
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', userId);

  if (tokens && tokens.length > 0) {
    const deviceTokens = tokens.map(t => t.token);
    
    // 3. Send Push via Pushy.me API
    try {
      const response = await fetch(`https://api.pushy.me/push?api_key=${PUSHY_SECRET_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: deviceTokens,
          data: {
            title,
            message: body,
            type,
            related_id: relatedId
          },
          notification: {
            title,
            body,
            sound: "default"
          }
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        console.error(`Pushy API error for user ${userId}:`, result);
      } else {
        console.log(`Push successfully sent to user ${userId} via Pushy.`);
      }
    } catch (err) {
      console.error(`Failed to send push to user ${userId}:`, err);
    }
  }
}
