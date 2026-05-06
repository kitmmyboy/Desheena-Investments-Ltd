import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const now = new Date();
    const today = now.getDay(); // 0-6
    
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
        .or(`day_of_week.eq.${targetDay},specific_date.eq.${targetDate.toISOString().split('T')[0]}`);

      if (schedError) throw schedError;

      for (const sched of schedules) {
        const client = sched.clients;
        const routeData = client.route_clients?.[0]?.routes;
        const driverId = routeData?.route_drivers?.[0]?.user_id;
        
        // Notify Client (if portal account exists)
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('client_id', sched.client_id)
          .maybeSingle();

        if (userData) {
          await createNotification(
            userData.id,
            'collection_reminder',
            'Waste Collection Reminder',
            `Your waste collection is scheduled for ${interval.label}.`,
            sched.client_id
          );
        }

        // Notify Driver
        if (driverId) {
          await createNotification(
            driverId,
            'driver_collection_reminder',
            'Upcoming Collection',
            `Collection for ${client.name} (${client.zone}) is scheduled for ${interval.label}.`,
            sched.client_id
          );
        }

        // Notify Admins (all users with Admin role)
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .in('role', ['Admin', 'Operations_Manager']);

        if (admins) {
          for (const admin of admins) {
            await createNotification(
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

async function createNotification(userId: string, type: string, title: string, body: string, relatedId: string) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    related_id: relatedId,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  });
}
