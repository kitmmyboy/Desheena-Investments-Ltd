import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentMonth {
  year: number;
  month: number;
  amount_paid: number;
  status: "paid" | "partial" | "unpaid" | "na";
}

interface ParsedClient {
  name: string;
  phone: string | null;
  email: string | null;
  division_office: string | null;
  location_text: string;
  zone: string | null;
  gps_lat: number;
  gps_lng: number;
  service_frequency: string;
  registration_fee: number;
  monthly_rate: number;
  contract_start_date: string;
  notes: string | null;
  payment_history: PaymentMonth[];
}

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  invoices_created: number;
  payments_created: number;
  error_messages: string[];
}

interface BatchImportRequest {
  clients: ParsedClient[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getMonthStartDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function getMonthEndDate(year: number, month: number): string {
  const nextMonth = new Date(year, month, 1);
  const lastDay = new Date(nextMonth.getTime() - 1);
  return lastDay.toISOString().split('T')[0];
}

function getDueDate(periodEnd: string): string {
  const endDate = new Date(periodEnd);
  endDate.setDate(endDate.getDate() + 14); // 14 days after period end
  return endDate.toISOString().split('T')[0];
}

function getFirstPaidPeriod(clientData: ParsedClient): { year: number; month: number } | null {
  const paidHistory = clientData.payment_history
    .filter((payment) => payment.status !== 'unpaid' && payment.status !== 'na' && payment.amount_paid > 0)
    .sort((a, b) => a.year - b.year || a.month - b.month);

  if (paidHistory.length === 0) {
    return null;
  }

  return { year: paidHistory[0].year, month: paidHistory[0].month };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

const responseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: responseHeaders,
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

  let requestBody: BatchImportRequest;
  try {
    requestBody = await req.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { clients } = requestBody;
  if (!Array.isArray(clients)) {
    return new Response(
      JSON.stringify({ error: 'clients must be an array' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let imported = 0;
  let duplicates = 0;
  let errors = 0;
  let invoices_created = 0;
  let payments_created = 0;
  const error_messages: string[] = [];

  for (const clientData of clients) {
    try {
      // Check for duplicates (same name + phone)
      let duplicateQuery = supabase
        .from('clients')
        .select('id')
        .eq('name', clientData.name);

      if (clientData.phone) {
        duplicateQuery = duplicateQuery.eq('phone', clientData.phone);
      }

      const { data: existing } = await duplicateQuery.limit(1);

      if (existing && existing.length > 0) {
        duplicates++;
        continue;
      }

      // Insert client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: clientData.name,
          phone: clientData.phone,
          email: clientData.email,
          location_text: clientData.location_text,
          gps_lat: clientData.gps_lat || null,
          gps_lng: clientData.gps_lng || null,
          zone: clientData.zone,
          service_frequency: clientData.service_frequency === 'monthly' ? 4 : 1, // Default to weekly if not monthly
          monthly_rate: clientData.monthly_rate,
          is_active: true,
        })
        .select('id')
        .single();

      if (clientError) {
        errors++;
        error_messages.push(`Client ${clientData.name}: ${clientError.message}`);
        continue;
      }

      // Determine contract start date from first actual payment if available
      const firstPaidPeriod = getFirstPaidPeriod(clientData);
      const contractStartDate = firstPaidPeriod
        ? getMonthStartDate(firstPaidPeriod.year, firstPaidPeriod.month)
        : clientData.contract_start_date;
      const contractYear = new Date(contractStartDate).getFullYear();
      const contractMonth = new Date(contractStartDate).getMonth() + 1;

      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          client_id: client.id,
          start_date: contractStartDate,
          billing_cycle: 'monthly',
          billing_model: 'flat',
          monthly_rate: clientData.monthly_rate,
          status: 'active',
        })
        .select('id')
        .single();

      if (contractError) {
        errors++;
        error_messages.push(`Contract for ${clientData.name}: ${contractError.message}`);
        continue;
      }

      // Process payment history - only from contract start date onwards
      for (const payment of clientData.payment_history) {
        // Skip if before contract start
        if (payment.year < contractYear || (payment.year === contractYear && payment.month < contractMonth)) {
          continue;
        }

        // Skip if not paid
        if (payment.status === 'unpaid' || payment.status === 'na' || payment.amount_paid <= 0) {
          continue;
        }

        const periodStart = getMonthStartDate(payment.year, payment.month);
        const periodEnd = getMonthEndDate(payment.year, payment.month);
        const dueDate = getDueDate(periodEnd);

        // Insert invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            client_id: client.id,
            contract_id: contract.id,
            period_start: periodStart,
            period_end: periodEnd,
            amount: clientData.monthly_rate,
            vat_amount: 0,
            total_amount: clientData.monthly_rate,
            due_date: dueDate,
            status: 'paid', // Since there's a payment
            generated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (invoiceError) {
          errors++;
          error_messages.push(`Invoice for ${clientData.name} ${payment.year}-${payment.month}: ${invoiceError.message}`);
          continue;
        }

        invoices_created++;

        // Insert payment
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            invoice_id: invoice.id,
            client_id: client.id,
            amount: payment.amount_paid,
            currency: 'UGX',
            payment_method: 'manual', // Historical import
            status: 'completed',
            paid_at: new Date().toISOString(),
          });

        if (paymentError) {
          errors++;
          error_messages.push(`Payment for ${clientData.name} ${payment.year}-${payment.month}: ${paymentError.message}`);
          continue;
        }

        payments_created++;
      }

      imported++;

    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      error_messages.push(`Unexpected error for ${clientData.name}: ${msg}`);
    }
  }

  const result: ImportResult = {
    imported,
    duplicates,
    errors,
    invoices_created,
    payments_created,
    error_messages,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});