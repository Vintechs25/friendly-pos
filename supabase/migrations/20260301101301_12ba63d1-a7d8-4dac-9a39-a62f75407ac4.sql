
-- Business payment configurations (per-business M-Pesa, card terminal settings)
CREATE TABLE public.business_payment_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('mpesa', 'card_terminal')),
  shortcode TEXT,
  consumer_key TEXT,
  consumer_secret TEXT,
  passkey TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  till_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, payment_type)
);

-- M-Pesa transactions (incoming till payments + STK results)
CREATE TABLE public.mpesa_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  phone TEXT,
  customer_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'overpaid', 'underpaid', 'duplicate')),
  matched_sale_id UUID REFERENCES public.sales(id),
  matched_by UUID,
  matched_at TIMESTAMP WITH TIME ZONE,
  transaction_type TEXT NOT NULL DEFAULT 'till' CHECK (transaction_type IN ('stk_push', 'till', 'buy_goods')),
  mpesa_receipt_number TEXT,
  checkout_request_id TEXT,
  raw_callback JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, transaction_id)
);

-- RLS for business_payment_configs
ALTER TABLE public.business_payment_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bpc_select" ON public.business_payment_configs
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "bpc_all" ON public.business_payment_configs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

-- RLS for mpesa_transactions
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mt_select" ON public.mpesa_transactions
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "mt_all" ON public.mpesa_transactions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

-- Enable realtime for mpesa_transactions (for live POS updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.mpesa_transactions;

-- Update trigger for business_payment_configs
CREATE TRIGGER update_bpc_updated_at
  BEFORE UPDATE ON public.business_payment_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
