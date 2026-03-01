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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle STK Push callback
    const stkCallback = body?.Body?.stkCallback;
    if (stkCallback) {
      const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

      if (ResultCode === 0 && CallbackMetadata?.Item) {
        const items = CallbackMetadata.Item;
        const mpesaReceipt = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
        const mpesaAmount = items.find((i: any) => i.Name === 'Amount')?.Value;
        const mpesaPhone = items.find((i: any) => i.Name === 'PhoneNumber')?.Value;

        // Update payment record
        await supabase
          .from('payments')
          .update({
            payment_status: 'confirmed',
            mpesa_receipt_number: mpesaReceipt,
          })
          .eq('mpesa_checkout_request_id', CheckoutRequestID);

        // Update mpesa_transactions record
        await supabase
          .from('mpesa_transactions')
          .update({
            status: 'matched',
            mpesa_receipt_number: mpesaReceipt,
            phone: mpesaPhone?.toString(),
            amount: mpesaAmount,
            raw_callback: body,
          })
          .eq('checkout_request_id', CheckoutRequestID);
      } else {
        // Payment failed
        await supabase
          .from('payments')
          .update({ payment_status: 'failed' })
          .eq('mpesa_checkout_request_id', CheckoutRequestID);

        await supabase
          .from('mpesa_transactions')
          .update({
            status: 'unmatched',
            raw_callback: body,
          })
          .eq('checkout_request_id', CheckoutRequestID);
      }

      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle C2B (Buy Goods / Till) confirmation callback
    // Safaricom sends: TransID, TransAmount, BillRefNumber, MSISDN, FirstName, etc.
    const transId = body?.TransID;
    if (transId) {
      const businessShortcode = body?.BusinessShortCode;
      const amount = parseFloat(body?.TransAmount || '0');
      const phone = body?.MSISDN;
      const customerName = [body?.FirstName, body?.MiddleName, body?.LastName].filter(Boolean).join(' ');

      // Find which business this shortcode belongs to
      let businessId: string | null = null;
      if (businessShortcode) {
        const { data: config } = await supabase
          .from('business_payment_configs')
          .select('business_id')
          .eq('payment_type', 'mpesa')
          .or(`shortcode.eq.${businessShortcode},till_number.eq.${businessShortcode}`)
          .eq('is_active', true)
          .single();
        businessId = config?.business_id || null;
      }

      if (businessId) {
        // Check for duplicate transaction
        const { data: existing } = await supabase
          .from('mpesa_transactions')
          .select('id')
          .eq('business_id', businessId)
          .eq('transaction_id', transId)
          .single();

        if (existing) {
          // Duplicate - mark it
          await supabase
            .from('mpesa_transactions')
            .update({ status: 'duplicate', raw_callback: body })
            .eq('id', existing.id);
        } else {
          // New incoming till payment
          await supabase.from('mpesa_transactions').insert({
            business_id: businessId,
            transaction_id: transId,
            phone,
            customer_name: customerName || null,
            amount,
            status: 'unmatched',
            transaction_type: 'till',
            mpesa_receipt_number: transId,
            raw_callback: body,
          });
        }
      }

      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
        headers: { 'Content-Type': 'application/json' },
      });
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
