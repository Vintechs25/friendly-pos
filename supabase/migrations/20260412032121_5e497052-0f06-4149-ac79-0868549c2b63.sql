
-- eTIMS settings per business
CREATE TABLE public.etims_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kra_pin text NOT NULL DEFAULT '',
  device_id text NOT NULL DEFAULT '',
  api_username text,
  api_password text,
  environment text NOT NULL DEFAULT 'sandbox',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

ALTER TABLE public.etims_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etims_settings_all" ON public.etims_settings FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()))
  WITH CHECK (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "etims_settings_select" ON public.etims_settings FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

CREATE TRIGGER update_etims_settings_updated_at
  BEFORE UPDATE ON public.etims_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- eTIMS transactions per sale
CREATE TABLE public.etims_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_number text,
  control_code text,
  qr_code text,
  status text NOT NULL DEFAULT 'pending',
  response_data jsonb,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(sale_id)
);

ALTER TABLE public.etims_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etims_tx_all" ON public.etims_transactions FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()))
  WITH CHECK (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "etims_tx_select" ON public.etims_transactions FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));
