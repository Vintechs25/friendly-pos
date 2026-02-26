
-- Cashier Shifts table
CREATE TABLE public.cashier_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  cashier_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  opening_cash numeric NOT NULL DEFAULT 0,
  closing_cash numeric,
  expected_cash numeric,
  cash_variance numeric,
  total_sales numeric NOT NULL DEFAULT 0,
  total_transactions integer NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shifts in their business" ON public.cashier_shifts
  FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Cashiers can insert shifts" ON public.cashier_shifts
  FOR INSERT TO authenticated
  WITH CHECK (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Cashiers can update their own shifts" ON public.cashier_shifts
  FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() OR has_role(auth.uid(), 'business_owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Refunds table
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  refund_number text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  refunded_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'voided')),
  restock_items boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view refunds in their business" ON public.refunds
  FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers and owners can create refunds" ON public.refunds
  FOR INSERT TO authenticated
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'business_owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- Refund items table
CREATE TABLE public.refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refunds(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view refund items" ON public.refund_items
  FOR SELECT TO authenticated
  USING (refund_id IN (SELECT id FROM public.refunds WHERE business_id = get_user_business_id(auth.uid())));

CREATE POLICY "Managers can insert refund items" ON public.refund_items
  FOR INSERT TO authenticated
  WITH CHECK (refund_id IN (SELECT id FROM public.refunds WHERE business_id = get_user_business_id(auth.uid())));
