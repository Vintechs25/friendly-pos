
-- Extend payment_method_type enum with new values
ALTER TYPE public.payment_method_type ADD VALUE IF NOT EXISTS 'store_credit';
ALTER TYPE public.payment_method_type ADD VALUE IF NOT EXISTS 'gift_card';

-- Add payment_status column to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS mpesa_checkout_request_id text,
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number text;

-- Create gift_cards table
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  code text NOT NULL,
  initial_balance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gift cards in their business"
  ON public.gift_cards FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Owners/managers can manage gift cards"
  ON public.gift_cards FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'business_owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'business_owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Cashiers can update gift card balance"
  ON public.gift_cards FOR UPDATE TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) AND has_role(auth.uid(), 'cashier'::app_role));

-- Create safe_drops table
CREATE TABLE public.safe_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.cashier_shifts(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  amount numeric NOT NULL,
  notes text,
  dropped_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safe_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view safe drops in their business"
  ON public.safe_drops FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can insert safe drops for their business"
  ON public.safe_drops FOR INSERT TO authenticated
  WITH CHECK (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owners/managers can manage safe drops"
  ON public.safe_drops FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'business_owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
