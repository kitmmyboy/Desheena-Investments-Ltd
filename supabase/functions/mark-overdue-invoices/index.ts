import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Calls the send-sms Edge Function to send an SMS notification.
 * Fails silently so overdue marking is not blocked by SMS errors.
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
      console.error("[mark-overdue-invoices] send-sms returned non-OK status " + res.status + ": " + text);
    } else {
      const result = await res.json();
      if (!result.success) {
        console.error("[mark-overdue-invoices] send-sms failed: " + result.error);
      } else {
        console.log("[mark-overdue-invoices] SMS sent, message_id=" + result.message_id);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mark-overdue-invoices] Failed to call send-sms: " + msg);
  }
}

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the mark_overdue_invoices() PostgreSQL function via RPC
    const { data: markedCount, error: rpcError } = await supabase
      .rpc("mark_overdue_invoices");

    if (rpcError) {
      console.error("Error calling mark_overdue_invoices:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const count: number = markedCount ?? 0;
    console.log("Marked " + count + " invoice(s) as overdue.");

    if (count > 0) {
      // Fetch the newly overdue invoices along with client phone numbers
      // We look for invoices updated in the last 60 seconds to catch only the ones just marked
      const { data: overdueInvoices, error: fetchError } = await supabase
        .from("invoices")
        .select(`
          id,
          client_id,
          amount,
          due_date,
          invoice_period,
          clients (
            id,
            name,
            phone
          )
        `)
        .eq("status", "overdue")
        .gte("updated_at", new Date(Date.now() - 60 * 1000).toISOString());

      if (fetchError) {
        console.error("Error fetching overdue invoices:", fetchError);
      } else if (overdueInvoices && overdueInvoices.length > 0) {
        for (const invoice of overdueInvoices) {
          const client = (invoice as any).clients;
          const phone = client?.phone ?? null;
          const clientName = client?.name ?? "Valued Customer";

          if (!phone) {
            console.log("[mark-overdue-invoices] Client " + clientName + " has no phone, skipping SMS.");
            continue;
          }

          // Send overdue reminder SMS (Requirement 12.2)
          const smsMessage =
            "Dear " + clientName + ", your Desheena waste collection invoice" +
            (invoice.invoice_period ? " for " + invoice.invoice_period : "") +
            " of UGX " + Number(invoice.amount).toLocaleString() +
            " is now OVERDUE (due " + invoice.due_date + "). " +
            "Please pay immediately to avoid service suspension. Ref: " + invoice.id;

          await sendSms(supabaseUrl, supabaseServiceKey, phone, smsMessage, "invoice_overdue", invoice.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ marked_overdue: count }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
