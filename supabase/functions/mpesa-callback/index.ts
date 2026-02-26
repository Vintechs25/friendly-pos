import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('M-Pesa callback received:', JSON.stringify(body));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      // Payment successful
      const items = CallbackMetadata.Item;
      const mpesaReceipt = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;

      // Update payment record
      await supabase
        .from('payments')
        .update({
          payment_status: 'confirmed',
          mpesa_receipt_number: mpesaReceipt,
        })
        .eq('mpesa_checkout_request_id', CheckoutRequestID);
    } else {
      // Payment failed
      await supabase
        .from('payments')
        .update({ payment_status: 'failed' })
        .eq('mpesa_checkout_request_id', CheckoutRequestID);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'Error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
