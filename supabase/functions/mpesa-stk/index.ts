import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MPESA_CONSUMER_KEY = Deno.env.get('MPESA_CONSUMER_KEY');
    const MPESA_CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET');
    const MPESA_SHORTCODE = Deno.env.get('MPESA_SHORTCODE');
    const MPESA_PASSKEY = Deno.env.get('MPESA_PASSKEY');
    const MPESA_ENV = Deno.env.get('MPESA_ENV') || 'sandbox';

    if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
      return new Response(
        JSON.stringify({ error: 'M-Pesa credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, phone, amount, account_reference, sale_id, checkout_request_id } = await req.json();

    const baseUrl = MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    // Get OAuth token
    const authStr = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${authStr}` },
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`M-Pesa auth failed [${tokenRes.status}]: ${JSON.stringify(tokenData)}`);
    }
    const accessToken = tokenData.access_token;

    if (action === 'stk_push') {
      // Initiate STK Push
      const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
      const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);

      // Format phone: ensure 254 prefix
      let formattedPhone = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
      if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-callback`;

      const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.ceil(amount),
          PartyA: formattedPhone,
          PartyB: MPESA_SHORTCODE,
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
      // Query STK Push status
      const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
      const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);

      const queryRes = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
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
  } catch (error: unknown) {
    console.error('M-Pesa error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
