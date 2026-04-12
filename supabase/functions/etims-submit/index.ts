import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.98.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const body = await req.json();
    const { sale_id } = body;

    if (!sale_id) {
      return new Response(JSON.stringify({ error: "sale_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sale with items
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("*, sale_items(*)")
      .eq("id", sale_id)
      .single();

    if (saleError || !sale) {
      return new Response(JSON.stringify({ error: "Sale not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get eTIMS settings for this business
    const { data: settings } = await supabase
      .from("etims_settings")
      .select("*")
      .eq("business_id", sale.business_id)
      .single();

    if (!settings || !settings.is_active) {
      return new Response(JSON.stringify({ error: "eTIMS not configured or inactive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already submitted
    const { data: existing } = await supabase
      .from("etims_transactions")
      .select("id, status")
      .eq("sale_id", sale_id)
      .single();

    if (existing?.status === "sent") {
      return new Response(JSON.stringify({ error: "Already submitted", etims_transaction: existing }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

    // Build eTIMS payload
    const etimsPayload = {
      kra_pin: settings.kra_pin,
      device_id: settings.device_id,
      invoice_number: invoiceNumber,
      invoice_date: sale.created_at,
      total_amount: sale.total,
      tax_amount: sale.tax_amount,
      items: (sale.sale_items || []).map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_amount: item.tax_amount,
        total: item.total,
      })),
    };

    // Submit to eTIMS API
    let controlCode = "";
    let qrCode = "";
    let status = "pending";
    let responseData: any = null;
    let errorMessage: string | null = null;

    try {
      // eTIMS API endpoint (sandbox vs production)
      const baseUrl = settings.environment === "production"
        ? "https://etims.kra.go.ke/api/v1"
        : "https://etims-sandbox.kra.go.ke/api/v1";

      const etimsResponse = await fetch(`${baseUrl}/invoice/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${settings.api_username}:${settings.api_password}`)}`,
        },
        body: JSON.stringify(etimsPayload),
      });

      const responseText = await etimsResponse.text();
      try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

      if (etimsResponse.ok && responseData.control_code) {
        controlCode = responseData.control_code;
        qrCode = responseData.qr_code || `https://etims.kra.go.ke/verify/${controlCode}`;
        status = "sent";
      } else {
        status = "failed";
        errorMessage = responseData.error || responseData.message || `HTTP ${etimsResponse.status}`;
      }
    } catch (apiError: any) {
      status = "failed";
      errorMessage = apiError.message || "Network error - eTIMS API unreachable";
      responseData = { error: errorMessage };
    }

    // Upsert etims_transactions record
    const txData = {
      sale_id,
      business_id: sale.business_id,
      invoice_number: invoiceNumber,
      control_code: controlCode || null,
      qr_code: qrCode || null,
      status,
      response_data: responseData,
      error_message: errorMessage,
      retry_count: existing ? (existing as any).retry_count + 1 : 0,
      submitted_at: status === "sent" ? new Date().toISOString() : null,
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("etims_transactions")
        .update(txData)
        .eq("id", existing.id)
        .select()
        .single();
      result = { data, error };
    } else {
      const { data, error } = await supabase
        .from("etims_transactions")
        .insert(txData)
        .select()
        .single();
      result = { data, error };
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: "Failed to store eTIMS record", details: result.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: status === "sent",
      status,
      etims_transaction: result.data,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("eTIMS submit error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
