import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * retry-sms Edge Function
 *
 * Scans the sms_log table for failed SMS entries that:
 *   - have delivery_status = 'failed'
 *   - have attempt_count < 3
 *   - were created within the last 24 hours
 *
 * For each qualifying entry, re-attempts delivery via Africa's Talking.
 * Updates the sms_log row with the new attempt_count, delivery_status,
 * africas_talking_id (on success), and error_code (on failure).
 *
 * This function is intended to be called by a pg_cron job or a scheduled
 * invocation (e.g., every hour) to handle transient delivery failures.
 *
 * Requirements: 12.4, 12.5
 */

// ---------------------------------------------------------------------------
// Africa's Talking SMS sender
// ---------------------------------------------------------------------------

/**
 * Sends a single SMS via Africa's Talking API.
 * Returns the AT message ID on success, or throws on failure.
 *
 * Sandbox vs production is controlled by AT_ENVIRONMENT env var:
 *   - "sandbox" → https://api.sandbox.africastalking.com/version1/messaging
 *   - anything else (or unset) → https://api.africastalking.com/version1/messaging
 */
async function sendViaAfricasTalking(
  phone: string,
  message: string
): Promise<string> {
  const apiKey = Deno.env.get("AT_API_KEY");
  const username = Deno.env.get("AT_USERNAME");
  const senderId = Deno.env.get("AT_SENDER_ID");
  const environment = Deno.env.get("AT_ENVIRONMENT") ?? "production";

  if (!apiKey || !username) {
    throw new Error("AT_API_KEY or AT_USERNAME not configured");
  }

  const baseUrl =
    environment === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

  const params = new URLSearchParams();
  params.set("username", username);
  params.set("to", phone);
  params.set("message", message);
  if (senderId) {
    params.set("from", senderId);
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      apiKey: apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

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
    throw new Error(
      "Failed to parse Africa's Talking response: " + responseText
    );
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
      "Africa's Talking delivery failed for " +
        phone +
        ": status=" +
        recipient.status +
        ", code=" +
        recipient.statusCode
    );
  }

  return recipient.messageId ?? crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // Allow POST (from pg_cron or manual trigger) and GET (for health checks)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const apiKey = Deno.env.get("AT_API_KEY");

  // In mock mode (no AT_API_KEY), skip actual retries but report what would be retried
  if (!apiKey) {
    console.log(
      "[retry-sms] MOCK MODE — AT_API_KEY not set. Skipping actual retries."
    );
    return new Response(
      JSON.stringify({
        retried: 0,
        succeeded: 0,
        failed: 0,
        skipped_mock_mode: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch failed SMS entries within the last 24 hours with fewer than 3 attempts
  // Requirement 12.5: max 3 retries within 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: failedEntries, error: fetchError } = await supabase
    .from("sms_log")
    .select(
      "id, recipient_phone, message_content, event_type, attempt_count, created_at"
    )
    .eq("delivery_status", "failed")
    .lt("attempt_count", 3)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (fetchError) {
    console.error("[retry-sms] Failed to fetch failed SMS entries:", fetchError.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch failed SMS entries", details: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!failedEntries || failedEntries.length === 0) {
    console.log("[retry-sms] No failed SMS entries to retry.");
    return new Response(
      JSON.stringify({ retried: 0, succeeded: 0, failed: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(
    "[retry-sms] Found " + failedEntries.length + " failed SMS entries to retry."
  );

  let succeeded = 0;
  let failed = 0;

  for (const entry of failedEntries) {
    const newAttemptCount = (entry.attempt_count ?? 1) + 1;

    try {
      const messageId = await sendViaAfricasTalking(
        entry.recipient_phone,
        entry.message_content
      );

      // Update log entry as successfully sent
      const { error: updateError } = await supabase
        .from("sms_log")
        .update({
          delivery_status: "sent",
          africas_talking_id: messageId,
          attempt_count: newAttemptCount,
          error_code: null,
          last_retry_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);

      if (updateError) {
        console.error(
          "[retry-sms] Failed to update sms_log after successful retry for id=" +
            entry.id +
            ": " +
            updateError.message
        );
      } else {
        console.log(
          "[retry-sms] Retry succeeded for id=" +
            entry.id +
            ", phone=" +
            entry.recipient_phone +
            ", message_id=" +
            messageId +
            ", attempt=" +
            newAttemptCount
        );
      }

      succeeded++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Update log entry with new failure details
      const { error: updateError } = await supabase
        .from("sms_log")
        .update({
          delivery_status: "failed",
          attempt_count: newAttemptCount,
          error_code: errorMessage.substring(0, 500),
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);

      if (updateError) {
        console.error(
          "[retry-sms] Failed to update sms_log after failed retry for id=" +
            entry.id +
            ": " +
            updateError.message
        );
      } else {
        console.warn(
          "[retry-sms] Retry attempt " +
            newAttemptCount +
            "/3 failed for id=" +
            entry.id +
            ", phone=" +
            entry.recipient_phone +
            ": " +
            errorMessage
        );
      }

      failed++;
    }
  }

  console.log(
    "[retry-sms] Retry run complete. Total=" +
      failedEntries.length +
      ", Succeeded=" +
      succeeded +
      ", Failed=" +
      failed
  );

  return new Response(
    JSON.stringify({
      retried: failedEntries.length,
      succeeded,
      failed,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Connection": "keep-alive" },
    }
  );
});
