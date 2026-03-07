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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Get user's business_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.business_id) {
      return new Response(JSON.stringify({ error: "No business found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessId = profile.business_id;

    if (action === "send_single") {
      // Send a single email
      const { to, subject, html, text, from_email, from_name, email_type } = body;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: from_name ? `${from_name} <${from_email}>` : from_email,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        // Log failure
        await supabase.from("email_logs").insert({
          business_id: businessId,
          to_email: Array.isArray(to) ? to[0] : to,
          from_email,
          subject,
          email_type: email_type || "transactional",
          status: "failed",
          error_message: JSON.stringify(resendData),
        });

        return new Response(JSON.stringify({ error: "Failed to send email", details: resendData }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log success
      await supabase.from("email_logs").insert({
        business_id: businessId,
        resend_id: resendData.id,
        to_email: Array.isArray(to) ? to[0] : to,
        from_email,
        subject,
        email_type: email_type || "transactional",
        status: "sent",
      });

      return new Response(JSON.stringify({ success: true, id: resendData.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_bulk") {
      // Send bulk campaign
      const { campaign_id, recipients, subject, html, text, from_email, from_name } = body;

      let totalSent = 0;
      let totalFailed = 0;
      const batchSize = 50;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        const promises = batch.map(async (recipient: { email: string; name?: string }) => {
          try {
            const resendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: from_name ? `${from_name} <${from_email}>` : from_email,
                to: [recipient.email],
                subject,
                html,
                text,
              }),
            });

            const data = await resendRes.json();

            await supabase.from("email_logs").insert({
              business_id: businessId,
              campaign_id,
              resend_id: resendRes.ok ? data.id : null,
              to_email: recipient.email,
              to_name: recipient.name,
              from_email,
              subject,
              email_type: "campaign",
              status: resendRes.ok ? "sent" : "failed",
              error_message: resendRes.ok ? null : JSON.stringify(data),
            });

            if (resendRes.ok) totalSent++;
            else totalFailed++;
          } catch {
            totalFailed++;
          }
        });

        await Promise.all(promises);
      }

      // Update campaign stats
      if (campaign_id) {
        await supabase
          .from("email_campaigns")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            total_recipients: recipients.length,
            total_sent: totalSent,
            total_failed: totalFailed,
          })
          .eq("id", campaign_id);
      }

      return new Response(
        JSON.stringify({ success: true, total_sent: totalSent, total_failed: totalFailed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
