import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, phone, amount, account_reference, sale_id, checkout_request_id, business_id } = await req.json();

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch per-business M-Pesa credentials
    const { data: config, error: configError } = await supabase
      .from('business_payment_configs')
      .select('*')
      .eq('business_id', business_id)
      .eq('payment_type', 'mpesa')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      // Fall back to global env vars
      const MPESA_CONSUMER_KEY = Deno.env.get('MPESA_CONSUMER_KEY');
      const MPESA_CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET');
      const MPESA_SHORTCODE = Deno.env.get('MPESA_SHORTCODE');
      const MPESA_PASSKEY = Deno.env.get('MPESA_PASSKEY');
      const MPESA_ENV = Deno.env.get('MPESA_ENV') || 'sandbox';

      if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
        return new Response(
          JSON.stringify({ error: 'M-Pesa not configured for this business' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use global credentials as fallback
      return await processMpesaRequest({
        action, phone, amount, account_reference, checkout_request_id, business_id, sale_id,
        consumerKey: MPESA_CONSUMER_KEY,
        consumerSecret: MPESA_CONSUMER_SECRET,
        shortcode: MPESA_SHORTCODE,
        passkey: MPESA_PASSKEY,
        environment: MPESA_ENV,
        supabaseUrl: SUPABASE_URL,
        supabase,
      });
    }

    // Use per-business credentials
    return await processMpesaRequest({
      action, phone, amount, account_reference, checkout_request_id, business_id, sale_id,
      consumerKey: config.consumer_key,
      consumerSecret: config.consumer_secret,
      shortcode: config.shortcode,
      passkey: config.passkey,
      environment: config.environment || 'sandbox',
      supabaseUrl: SUPABASE_URL,
      supabase,
    });
  } catch (error: unknown) {
    console.error('M-Pesa error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface MpesaRequestParams {
  action: string;
  phone?: string;
  amount?: number;
  account_reference?: string;
  checkout_request_id?: string;
  business_id: string;
  sale_id?: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  environment: string;
  supabaseUrl: string;
  supabase: any;
}

async function processMpesaRequest(params: MpesaRequestParams) {
  const {
    action, phone, amount, account_reference, checkout_request_id, business_id, sale_id,
    consumerKey, consumerSecret, shortcode, passkey, environment, supabaseUrl, supabase,
  } = params;

  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  // Get OAuth token
  const authStr = btoa(`${consumerKey}:${consumerSecret}`);
  const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${authStr}` },
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`M-Pesa auth failed [${tokenRes.status}]: ${JSON.stringify(tokenData)}`);
  }
  const accessToken = tokenData.access_token;

  if (action === 'stk_push') {
    if (!phone || !amount) {
      return new Response(
        JSON.stringify({ error: 'phone and amount are required for stk_push' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    let formattedPhone = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;

    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: account_reference || 'POS Sale',
        TransactionDesc: `Payment for ${account_reference || 'POS Sale'}`,
      }),
    });

    const stkData = await stkRes.json();
    if (!stkRes.ok || stkData.ResponseCode !== '0') {
      throw new Error(`STK Push failed: ${JSON.stringify(stkData)}`);
    }

    // Create mpesa_transaction record for tracking
    const txnId = `STK-${stkData.CheckoutRequestID}`;
    await supabase.from('mpesa_transactions').upsert({
      business_id,
      transaction_id: txnId,
      phone: formattedPhone,
      amount: Math.ceil(amount),
      status: 'unmatched',
      transaction_type: 'stk_push',
      checkout_request_id: stkData.CheckoutRequestID,
      matched_sale_id: sale_id || null,
    }, { onConflict: 'business_id,transaction_id' });

    return new Response(
      JSON.stringify({
        success: true,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        response_description: stkData.ResponseDescription,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'query') {
    if (!checkout_request_id) {
      return new Response(
        JSON.stringify({ error: 'checkout_request_id required for query' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const queryRes = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkout_request_id,
      }),
    });

    const queryData = await queryRes.json();

    return new Response(
      JSON.stringify({
        success: queryData.ResultCode === '0',
        result_code: queryData.ResultCode,
        result_desc: queryData.ResultDesc,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Invalid action. Use "stk_push" or "query"' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
