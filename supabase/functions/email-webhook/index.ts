import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { type } = body;

    if (type === "email.received") {
      // Inbound email from Resend
      const { from, to, subject, html, text } = body.data || body;

      // Find business by to_email domain or address
      const toEmail = Array.isArray(to) ? to[0] : to;
      
      // Try to find a business with matching from_email in their settings or campaigns
      // For now, store with a lookup based on the to address
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, email")
        .not("email", "is", null);

      let businessId: string | null = null;

      // Match by business email domain
      if (businesses) {
        for (const biz of businesses) {
          if (biz.email && toEmail.includes(biz.email.split("@")[1])) {
            businessId = biz.id;
            break;
          }
        }
        // Fallback: use first business if only one exists
        if (!businessId && businesses.length === 1) {
          businessId = businesses[0].id;
        }
      }

      if (businessId) {
        await supabase.from("inbound_emails").insert({
          business_id: businessId,
          from_email: typeof from === "string" ? from : from?.email || from,
          from_name: typeof from === "object" ? from?.name : null,
          to_email: toEmail,
          subject: subject || "(No Subject)",
          body_html: html,
          body_text: text,
          raw_payload: body,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle delivery status webhooks
    if (type === "email.delivered" || type === "email.bounced" || type === "email.opened" || type === "email.clicked") {
      const emailId = body.data?.email_id;
      if (emailId) {
        const updates: Record<string, unknown> = {};
        if (type === "email.delivered") updates.status = "delivered";
        if (type === "email.bounced") updates.status = "bounced";
        if (type === "email.opened") updates.opened_at = new Date().toISOString();
        if (type === "email.clicked") updates.clicked_at = new Date().toISOString();

        await supabase
          .from("email_logs")
          .update(updates)
          .eq("resend_id", emailId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
