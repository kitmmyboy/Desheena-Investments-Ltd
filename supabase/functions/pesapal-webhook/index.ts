import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Pesapal API helpers
// ---------------------------------------------------------------------------

/**
 * Obtains a short-lived Bearer token from Pesapal.
 * Returns null when credentials are not configured (dev/mock mode).
 */
async function getPesapalToken(): Promise<string | null> {
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    return null;
  }

  const res = await fetch(
    "https://pay.pesapal.com/v3/api/Auth/RequestToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Pesapal auth failed (" + res.status + "): " + text);
  }

  const json = await res.json();
  if (!json.token) {
    throw new Error("Pesapal auth: no token in response — " + JSON.stringify(json));
  }
  return json.token as string;
}

/**
 * Queries Pesapal's GetTransactionStatus endpoint to confirm payment.
 *
 * Pesapal status codes:
 *   COMPLETED  — payment successful
 *   FAILED     — payment failed
 *   INVALID    — invalid request
 *   REVERSED   — payment reversed
 */
async function getTransactionStatus(
  orderTrackingId: string,
  token: string
): Promise<{
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  account_number: string;
  payment_status_code: string;
  currency: string;
  error: { error_type: string | null; code: string | null; message: string | null };
  status: string;
}> {
  const res = await fetch(
    "https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(orderTrackingId),
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error("GetTransactionStatus failed (" + res.status + "): " + text);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// SMS helper
// ---------------------------------------------------------------------------

/**
 * Calls the send-sms Edge Function to send an SMS notification.
 * Fails silently so payment processing is not blocked by SMS errors.
 */
async function sendSms(
  supabaseUrl: string,
  serviceRoleKey: string,
  phone: string,
  message: string,
  eventType: string,
  referenceId?: string
): Promise<void> {
  try {
    const sendSmsUrl = supabaseUrl + "/functions/v1/send-sms";
    const res = await fetch(sendSmsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + serviceRoleKey,
      },
      body: JSON.stringify({ phone, message, event_type: eventType, reference_id: referenceId }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[pesapal-webhook] send-sms returned non-OK status " + res.status + ": " + text);
    } else {
      const result = await res.json();
      if (!result.success) {
        console.error("[pesapal-webhook] send-sms failed: " + result.error);
      } else {
        console.log("[pesapal-webhook] SMS sent, message_id=" + result.message_id);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pesapal-webhook] Failed to call send-sms: " + msg);
  }
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Pesapal sends a GET callback with query params, and may also POST.
  // We must always return 200 to acknowledge receipt.

  const url = new URL(req.url);

  // Extract Pesapal callback parameters
  // Pesapal v3 IPN sends: OrderTrackingId, OrderMerchantReference, OrderNotificationType
  const orderTrackingId =
    url.searchParams.get("OrderTrackingId") ??
    url.searchParams.get("orderTrackingId") ??
    null;
  const merchantReference =
    url.searchParams.get("OrderMerchantReference") ??
    url.searchParams.get("orderMerchantReference") ??
    null;

  // For POST callbacks, also try to parse the body
  let bodyParams: Record<string, string> = {};
  if (req.method === "POST") {
    try {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        bodyParams = await req.json();
      } else {
        const text = await req.text();
        for (const [k, v] of new URLSearchParams(text)) {
          bodyParams[k] = v;
        }
      }
    } catch {
      // ignore parse errors — we still need to return 200
    }
  }

  const trackingId = orderTrackingId ?? bodyParams["OrderTrackingId"] ?? null;
  const invoiceId = merchantReference ?? bodyParams["OrderMerchantReference"] ?? null;

  console.log("[pesapal-webhook] Received callback:", {
    method: req.method,
    trackingId,
    invoiceId,
  });

  // Always acknowledge Pesapal immediately
  const ack = () =>
    new Response(JSON.stringify({ status: "200", message: "IPN received" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  if (!trackingId || !invoiceId) {
    console.warn(
      "[pesapal-webhook] Missing trackingId or invoiceId — ignoring callback."
    );
    return ack();
  }

  // Build Supabase admin client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // --- MOCK mode: Pesapal credentials not configured ---
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  if (!consumerKey) {
    console.warn(
      "[pesapal-webhook] Running in mock mode — Pesapal credentials not configured. " +
        "Treating callback as a confirmed payment for testing purposes."
    );

    // In mock mode, treat any callback as a successful payment
    await handleConfirmedPayment(supabase, supabaseUrl, serviceRoleKey, invoiceId, trackingId, 0, "UGX", "mock");
    return ack();
  }

  // --- LIVE mode: validate with Pesapal ---
  try {
    const token = await getPesapalToken();
    if (!token) {
      console.error("[pesapal-webhook] Could not obtain Pesapal token.");
      return ack();
    }

    const statusData = await getTransactionStatus(trackingId, token);

    console.log("[pesapal-webhook] Transaction status:", {
      invoiceId,
      trackingId,
      paymentStatus: statusData.payment_status_description,
      statusCode: statusData.payment_status_code,
    });

    if (statusData.payment_status_description === "Completed") {
      await handleConfirmedPayment(
        supabase,
        supabaseUrl,
        serviceRoleKey,
        invoiceId,
        trackingId,
        statusData.amount,
        statusData.currency,
        statusData.payment_method
      );
    } else {
      // Failed or cancelled payment
      await handleFailedPayment(
        supabase,
        invoiceId,
        trackingId,
        statusData.payment_status_description,
        statusData.error?.code ?? null
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[pesapal-webhook] Error processing callback:", message);
    // Still return 200 to prevent Pesapal from retrying indefinitely
  }

  return ack();
});

// ---------------------------------------------------------------------------
// Payment outcome handlers
// ---------------------------------------------------------------------------

async function handleConfirmedPayment(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  invoiceId: string,
  transactionRef: string,
  amount: number,
  currency: string,
  paymentMethod: string
): Promise<void> {
  // 1. Fetch the invoice to get client_id, amount, and client phone
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      client_id,
      amount,
      status,
      invoice_period,
      due_date,
      clients (
        id,
        name,
        phone
      )
    `)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    console.error(
      "[pesapal-webhook] Invoice not found:",
      invoiceId,
      invoiceError?.message
    );
    return;
  }

  if (invoice.status === "paid") {
    console.log(
      "[pesapal-webhook] Invoice already marked paid, skipping:",
      invoiceId
    );
    return;
  }

  // 2. Update invoice status to 'paid'
  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (updateError) {
    console.error(
      "[pesapal-webhook] Failed to update invoice status:",
      updateError.message
    );
    return;
  }

  // 3. Create a payment record
  const paymentAmount = amount > 0 ? amount : Number(invoice.amount);
  const { error: paymentError } = await supabase.from("payments").insert({
    id: crypto.randomUUID(),
    invoice_id: invoiceId,
    client_id: invoice.client_id,
    amount: paymentAmount,
    currency: currency || "UGX",
    payment_method: "pesapal",
    transaction_ref: transactionRef,
    paid_at: new Date().toISOString(),
    status: "completed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (paymentError) {
    console.error(
      "[pesapal-webhook] Failed to create payment record:",
      paymentError.message
    );
    // Don't return — invoice is already marked paid; log and continue
  }

  // 4. Send SMS receipt to client (Requirement 12.3)
  const client = (invoice as any).clients;
  const clientPhone = client?.phone ?? null;
  const clientName = client?.name ?? "Valued Customer";

  if (clientPhone) {
    const paymentDate = new Date().toISOString().split('T')[0];
    const smsMessage =
      "Dear " + clientName + ", payment of UGX " + Number(paymentAmount).toLocaleString() +
      " received for invoice" +
      (invoice.invoice_period ? " " + invoice.invoice_period : "") +
      ". Ref: " + invoiceId + ". Date: " + paymentDate +
      ". Thank you for paying Desheena Investments Ltd.";

    await sendSms(supabaseUrl, serviceRoleKey, clientPhone, smsMessage, "payment_confirmed", invoiceId);
  } else {
    console.log("[pesapal-webhook] Client " + clientName + " has no phone, skipping SMS receipt.");
  }

  console.log(
    "[pesapal-webhook] Payment confirmed and recorded:",
    { invoiceId, transactionRef, amount: paymentAmount }
  );
}

async function handleFailedPayment(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string,
  transactionRef: string,
  statusDescription: string,
  errorCode: string | null
): Promise<void> {
  // Invoice status remains 'unpaid' — we only log the failed attempt
  const { error: paymentError } = await supabase.from("payments").insert({
    id: crypto.randomUUID(),
    invoice_id: invoiceId,
    client_id: await getClientIdForInvoice(supabase, invoiceId),
    amount: 0,
    currency: "UGX",
    payment_method: "pesapal",
    transaction_ref: transactionRef,
    status: "failed",
    pesapal_error: errorCode
      ? statusDescription + " (code: " + errorCode + ")"
      : statusDescription,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (paymentError) {
    console.error(
      "[pesapal-webhook] Failed to log failed payment attempt:",
      paymentError.message
    );
  }

  console.log(
    "[pesapal-webhook] Payment failed/cancelled — invoice status retained as unpaid:",
    { invoiceId, transactionRef, statusDescription, errorCode }
  );
}

async function getClientIdForInvoice(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string
): Promise<string> {
  const { data } = await supabase
    .from("invoices")
    .select("client_id")
    .eq("id", invoiceId)
    .single();
  return data?.client_id ?? "00000000-0000-0000-0000-000000000000";
}
