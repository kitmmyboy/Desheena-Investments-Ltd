import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventType =
  | "invoice_generated"
  | "invoice_overdue"
  | "payment_confirmed"
  | "complaint_status_changed";

interface SendSmsRequest {
  phone: string;
  message: string;
  event_type: EventType;
}

interface SendSmsResponse {
  success: boolean;
  message_id: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Africa's Talking SMS sender
// ---------------------------------------------------------------------------

/**
 * Sends a single SMS via Africa's Talking API.
 * Returns the AT message ID on success, or throws on failure.
 *
 * API docs: https://developers.africastalking.com/docs/sms/sending
 * POST https://api.africastalking.com/version1/messaging
 * Headers: apiKey, Accept: application/json, Content-Type: application/x-www-form-urlencoded
 * Body: username, to, message, from (optional sender ID)
 */
async function sendViaAfricasTalking(
  phone: string,
  message: string
): Promise<string> {
  const apiKey = Deno.env.get("AT_API_KEY");
  const username = Deno.env.get("AT_USERNAME");
  const senderId = Deno.env.get("AT_SENDER_ID");

  if (!apiKey || !username) {
    throw new Error("AT_API_KEY or AT_USERNAME not configured");
  }

  // Build form-encoded body
  const params = new URLSearchParams();
  params.set("username", username);
  params.set("to", phone);
  params.set("message", message);
  if (senderId) {
    params.set("from", senderId);
  }

  const res = await fetch(
    "https://api.africastalking.com/version1/messaging",
    {
      method: "POST",
      headers: {
        apiKey: apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(
      "Africa's Talking API error (" + res.status + "): " + responseText
    );
  }

  let responseJson: {
    SMSMessageData?: {
      Recipients?: Array<{
        messageId?: string;
        statusCode?: number;
        status?: string;
        number?: string;
      }>;
      Message?: string;
    };
  };

  try {
    responseJson = JSON.parse(responseText);
  } catch {
    throw new Error("Failed to parse Africa's Talking response: " + responseText);
  }

  const recipients = responseJson?.SMSMessageData?.Recipients;
  if (!recipients || recipients.length === 0) {
    throw new Error(
      "Africa's Talking: no recipients in response — " + responseText
    );
  }

  const recipient = recipients[0];

  // statusCode 101 = success in Africa's Talking
  if (recipient.statusCode !== 101) {
    throw new Error(
      "Africa's Talking delivery failed for " + phone +
        ": status=" + recipient.status + ", code=" + recipient.statusCode
    );
  }

  return recipient.messageId ?? crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Retry helper with exponential backoff
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to send an SMS with up to 3 total attempts.
 * Delays: 1s before attempt 2, 2s before attempt 3 (exponential backoff).
 * Returns { messageId, attemptCount } on success.
 * Throws the last error if all attempts fail.
 *
 * Requirement 12.5: max 3 retries within 24 hours.
 */
async function sendWithRetry(
  phone: string,
  message: string
): Promise<{ messageId: string; attemptCount: number }> {
  const maxAttempts = 3;
  const delays = [0, 1000, 2000]; // delay before each attempt (ms): 0s, 1s, 2s
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (delays[attempt - 1] > 0) {
      await sleep(delays[attempt - 1]);
    }

    try {
      const messageId = await sendViaAfricasTalking(phone, message);
      return { messageId, attemptCount: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        "[send-sms] Attempt " + attempt + "/" + maxAttempts +
          " failed for " + phone + ": " + lastError.message
      );
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message_id: "", error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: SendSmsRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, message_id: "", error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { phone, message, event_type } = body;

  if (!phone || !message || !event_type) {
    return new Response(
      JSON.stringify({
        success: false,
        message_id: "",
        error: "Missing required fields: phone, message, event_type",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const validEventTypes: EventType[] = [
    "invoice_generated",
    "invoice_overdue",
    "payment_confirmed",
    "complaint_status_changed",
  ];
  if (!validEventTypes.includes(event_type)) {
    return new Response(
      JSON.stringify({
        success: false,
        message_id: "",
        error: "Invalid event_type. Must be one of: " + validEventTypes.join(", "),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build Supabase admin client for logging
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const apiKey = Deno.env.get("AT_API_KEY");

  // ---------------------------------------------------------------------------
  // MOCK MODE: AT_API_KEY not set — log as if sent successfully (for testing)
  // ---------------------------------------------------------------------------
  if (!apiKey) {
    console.log(
      "[send-sms] MOCK MODE — AT_API_KEY not set. Logging SMS as sent. " +
        "phone=" + phone + ", event_type=" + event_type + ", message=" + message
    );

    const mockMessageId = "mock-" + crypto.randomUUID();

    const { error: logError } = await supabase.from("sms_log").insert({
      recipient_phone: phone,
      message_content: message,
      event_type: event_type,
      delivery_status: "sent",
      africas_talking_id: mockMessageId,
      attempt_count: 1,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error("[send-sms] Failed to insert mock SMS log:", logError.message);
    }

    const response: SendSmsResponse = { success: true, message_id: mockMessageId };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---------------------------------------------------------------------------
  // LIVE MODE: Send via Africa's Talking with retry logic
  // ---------------------------------------------------------------------------
  try {
    const { messageId, attemptCount } = await sendWithRetry(phone, message);

    // Log successful send (Requirement 12.4)
    const { error: logError } = await supabase.from("sms_log").insert({
      recipient_phone: phone,
      message_content: message,
      event_type: event_type,
      delivery_status: "sent",
      africas_talking_id: messageId,
      attempt_count: attemptCount,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error("[send-sms] Failed to insert SMS log:", logError.message);
    }

    console.log(
      "[send-sms] SMS sent successfully. phone=" + phone +
        ", event_type=" + event_type +
        ", message_id=" + messageId +
        ", attempts=" + attemptCount
    );

    const response: SendSmsResponse = { success: true, message_id: messageId };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Log failure with error code (Requirement 12.4, 12.5)
    const { error: logError } = await supabase.from("sms_log").insert({
      recipient_phone: phone,
      message_content: message,
      event_type: event_type,
      delivery_status: "failed",
      africas_talking_id: null,
      attempt_count: 3, // exhausted all retries
      error_code: errorMessage.substring(0, 500),
      sent_at: null,
    });

    if (logError) {
      console.error("[send-sms] Failed to insert failure SMS log:", logError.message);
    }

    console.error(
      "[send-sms] All retry attempts failed for " + phone + ": " + errorMessage
    );

    const response: SendSmsResponse = {
      success: false,
      message_id: "",
      error: errorMessage,
    };
    return new Response(JSON.stringify(response), {
      status: 200, // Return 200 so callers can handle gracefully
      headers: { "Content-Type": "application/json" },
    });
  }
});
