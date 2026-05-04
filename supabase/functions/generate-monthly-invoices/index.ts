import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Service frequency to estimated monthly collections mapping
// service_frequency in clients table is stored as integer (collections per week)
// We convert to monthly estimate: weekly_freq * 4.33 (avg weeks per month)
function estimateMonthlyCollections(serviceFrequency: number | string | null): number {
  if (serviceFrequency === null || serviceFrequency === undefined) return 4;

  // Handle text-based frequency strings
  if (typeof serviceFrequency === 'string') {
    const freq = serviceFrequency.toLowerCase().trim();
    if (freq === 'daily') return 30;
    if (freq === 'twice per week' || freq === 'twice_per_week') return 8;
    if (freq === 'three times per week' || freq === 'three_times_per_week') return 13;
    if (freq === 'weekly') return 4;
    // Try parsing as number
    const parsed = parseInt(freq, 10);
    if (!isNaN(parsed)) return Math.round(parsed * 4.33);
    return 4;
  }

  // Handle integer frequency (collections per week)
  const freq = Number(serviceFrequency);
  if (isNaN(freq) || freq <= 0) return 4;
  if (freq === 1) return 4;   // weekly
  if (freq === 2) return 8;   // twice per week
  if (freq === 3) return 13;  // three times per week
  if (freq >= 7) return 30;   // daily
  // General case: multiply by ~4.33 weeks/month
  return Math.round(freq * 4.33);
}

/**
 * Calls the send-sms Edge Function to send an SMS notification.
 * Fails silently so invoice generation is not blocked by SMS errors.
 */
async function sendSms(
  supabaseUrl: string,
  serviceRoleKey: string,
  phone: string,
  message: string,
  eventType: string
): Promise<void> {
  try {
    const sendSmsUrl = supabaseUrl + "/functions/v1/send-sms";
    const res = await fetch(sendSmsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + serviceRoleKey,
      },
      body: JSON.stringify({ phone, message, event_type: eventType }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[generate-monthly-invoices] send-sms returned non-OK status " + res.status + ": " + text);
    } else {
      const result = await res.json();
      if (!result.success) {
        console.error("[generate-monthly-invoices] send-sms failed: " + result.error);
      } else {
        console.log("[generate-monthly-invoices] SMS sent, message_id=" + result.message_id);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-monthly-invoices] Failed to call send-sms: " + msg);
  }
}

Deno.serve(async (req: Request) => {
  // Only allow POST or GET (pg_cron uses POST)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 14);
  const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Invoice period: current month (e.g., "2026-05")
  const invoicePeriod = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, '0');

  // Period start = first day of current month, period end = last day of current month
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Fetch all active contracts with client info
  const { data: contracts, error: contractsError } = await supabase
    .from('contracts')
    .select(`
      id,
      client_id,
      billing_model,
      monthly_rate,
      per_collection_rate,
      clients (
        id,
        name,
        phone,
        service_frequency
      )
    `)
    .eq('status', 'active');

  if (contractsError) {
    console.error('Error fetching contracts:', contractsError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch contracts', details: contractsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!contracts || contracts.length === 0) {
    return new Response(
      JSON.stringify({ generated: 0, errors: [], message: 'No active contracts found' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let generated = 0;
  const errors: string[] = [];

  for (const contract of contracts) {
    try {
      const client = contract.clients as { id: string; name: string; phone: string | null; service_frequency: number | null } | null;

      if (!client) {
        errors.push('Contract ' + contract.id + ': client not found');
        continue;
      }

      // Calculate invoice amount based on billing model
      let amount: number;

      if (contract.billing_model === 'flat') {
        // Flat billing: amount = contract monthly_rate
        if (!contract.monthly_rate) {
          errors.push('Contract ' + contract.id + ' (client: ' + client.name + '): flat billing but no monthly_rate set');
          continue;
        }
        amount = Number(contract.monthly_rate);
      } else if (contract.billing_model === 'frequency') {
        // Frequency-based billing: amount = per_collection_rate x estimated monthly collections
        if (!contract.per_collection_rate) {
          errors.push('Contract ' + contract.id + ' (client: ' + client.name + '): frequency billing but no per_collection_rate set');
          continue;
        }
        const monthlyCollections = estimateMonthlyCollections(client.service_frequency);
        amount = Number(contract.per_collection_rate) * monthlyCollections;
      } else {
        errors.push('Contract ' + contract.id + ' (client: ' + client.name + '): unknown billing_model "' + contract.billing_model + '"');
        continue;
      }

      // Insert invoice record
      const { data: invoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          client_id: contract.client_id,
          contract_id: contract.id,
          amount: amount,
          vat_amount: 0,
          total_amount: amount,
          due_date: dueDateStr,
          status: 'unpaid',
          period_start: periodStartStr,
          period_end: periodEndStr,
          invoice_period: invoicePeriod,
          generated_at: today.toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        errors.push('Contract ' + contract.id + ' (client: ' + client.name + '): failed to insert invoice — ' + insertError.message);
        continue;
      }

      generated++;

      // Send SMS notification to client (Requirement 12.1)
      if (client.phone) {
        const smsMessage =
          'Dear ' + client.name + ', your Desheena waste collection invoice for ' + invoicePeriod +
          ' is UGX ' + Number(amount).toLocaleString() + '. Due date: ' + dueDateStr +
          '. Ref: ' + (invoice?.id ?? 'N/A') + '. Pay via Pesapal or contact us.';

        await sendSms(supabaseUrl, serviceRoleKey, client.phone, smsMessage, 'invoice_generated');
      } else {
        console.log('[generate-monthly-invoices] Client ' + client.name + ' has no phone number, skipping SMS.');
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push('Contract ' + contract.id + ': unexpected error — ' + message);
    }
  }

  console.log('Invoice generation complete. Generated: ' + generated + ', Errors: ' + errors.length);

  return new Response(
    JSON.stringify({ generated, errors }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' },
    }
  );
});
