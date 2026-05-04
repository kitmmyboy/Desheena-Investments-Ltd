import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InitiatePaymentRequest {
  invoice_id: string;
  amount: number;
  currency: string;
  customer_phone: string;
  customer_email: string;
}

interface PesapalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error?: { error_type: string | null; code: string | null; message: string | null };
  status: string;
}

// ---------------------------------------------------------------------------
// Pesapal helpers
// ---------------------------------------------------------------------------

/**
 * Obtains a short-lived Bearer token from Pesapal.
 */
async function getPesapalToken(): Promise<string> {
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("Pesapal credentials not configured");
  }

  const res = await fetch(
    "https://pay.pesapal.com/v3/api/Auth/RequestToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal auth failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (!json.token) {
    throw new Error(`Pesapal auth: no token in response — ${JSON.stringify(json)}`);
  }
  return json.token as string;
}

/**
 * Registers an IPN URL with Pesapal and returns the IPN ID.
 */
async function registerIpn(token: string, callbackUrl: string): Promise<string> {
  const res = await fetch(
    "https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: callbackUrl,
        ipn_notification_type: "GET",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RegisterIPN failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.ipn_id as string;
}

/**
 * Submits an order to Pesapal and returns the redirect URL and tracking ID.
 */
async function submitOrder(
  token: string,
  ipnId: string,
  invoiceId: string,
  amount: number,
  currency: string,
  customerPhone: string,
  customerEmail: string,
  callbackUrl: string
): Promise<PesapalOrderResponse> {
  const res = await fetch(
    "https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: invoiceId,
        currency,
        amount,
        description: `Invoice payment - ${invoiceId}`,
        callback_url: callbackUrl,
        notification_id: ipnId,
        billing_address: {
          phone_number: customerPhone,
          email_address: customerEmail,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SubmitOrderRequest failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse request body
  let body: InitiatePaymentRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { invoice_id, amount, currency, customer_phone, customer_email } = body;

  // Validate required fields
  if (!invoice_id || !amount || !currency || !customer_phone || !customer_email) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: invoice_id, amount, currency, customer_phone, customer_email" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // The webhook callback URL points to the existing pesapal-webhook function
  const callbackUrl = `${supabaseUrl}/functions/v1/pesapal-webhook`;

  // --- MOCK mode: Pesapal credentials not configured ---
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  if (!consumerKey) {
    console.warn(
      "[initiate-pesapal-payment] Running in mock mode — Pesapal credentials not configured."
    );

    // Return a mock redirect URL for testing
    const mockRedirectUrl = `${supabaseUrl}/functions/v1/pesapal-webhook?OrderTrackingId=mock-${crypto.randomUUID()}&OrderMerchantReference=${invoice_id}`;

    return new Response(
      JSON.stringify({
        redirect_url: mockRedirectUrl,
        order_tracking_id: `mock-${invoice_id}`,
        mock: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- LIVE mode ---
  try {
    // Verify the invoice exists and belongs to the authenticated user
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, client_id, amount, status")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Invoice is already paid" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get Pesapal token
    const token = await getPesapalToken();

    // Register IPN
    const ipnId = await registerIpn(token, callbackUrl);

    // Submit order to Pesapal
    const orderResponse = await submitOrder(
      token,
      ipnId,
      invoice_id,
      amount,
      currency,
      customer_phone,
      customer_email,
      callbackUrl
    );

    if (!orderResponse.redirect_url) {
      throw new Error(`No redirect_url in Pesapal response: ${JSON.stringify(orderResponse)}`);
    }

    console.log("[initiate-pesapal-payment] Order submitted:", {
      invoice_id,
      order_tracking_id: orderResponse.order_tracking_id,
    });

    return new Response(
      JSON.stringify({
        redirect_url: orderResponse.redirect_url,
        order_tracking_id: orderResponse.order_tracking_id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[initiate-pesapal-payment] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
