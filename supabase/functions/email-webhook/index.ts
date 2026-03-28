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
    console.log("Webhook received:", JSON.stringify(body).substring(0, 500));

    const type = body.type;

    if (type === "email.received") {
      // Resend inbound email payload
      const data = body.data || body;
      const from = data.from;
      const to = data.to;
      const subject = data.subject;
      const html = data.html;
      const text = data.text;

      const toEmail = Array.isArray(to) ? to[0] : to;
      const fromEmail = typeof from === "string" ? from : from?.email || String(from);

      // Find the business: match by the "to" email address against business email
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, email")
        .not("email", "is", null);

      let businessId: string | null = null;

      if (businesses) {
        // Exact match on business email first
        for (const biz of businesses) {
          if (biz.email && toEmail.toLowerCase().includes(biz.email.toLowerCase())) {
            businessId = biz.id;
            break;
          }
        }
        // Then try domain match
        if (!businessId) {
          for (const biz of businesses) {
            if (biz.email) {
              const bizDomain = biz.email.split("@")[1]?.toLowerCase();
              if (bizDomain && toEmail.toLowerCase().includes(bizDomain)) {
                businessId = biz.id;
                break;
              }
            }
          }
        }
        // Fallback: if only one business exists
        if (!businessId && businesses.length === 1) {
          businessId = businesses[0].id;
        }
      }

      console.log("Matched business:", businessId, "for to:", toEmail);

      if (businessId) {
        const { error } = await supabase.from("inbound_emails").insert({
          business_id: businessId,
          from_email: fromEmail,
          from_name: typeof from === "object" ? from?.name : null,
          to_email: toEmail,
          subject: subject || "(No Subject)",
          body_html: html,
          body_text: text,
          raw_payload: body,
        });
        if (error) console.error("Insert error:", error);
      } else {
        console.error("No matching business found for:", toEmail);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle delivery status webhooks
    if (["email.delivered", "email.bounced", "email.opened", "email.clicked"].includes(type)) {
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
