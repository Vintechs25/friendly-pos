
-- Add extended fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS minimum_price numeric DEFAULT 0;

-- Create product_variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name text NOT NULL,
  variant_value text NOT NULL,
  sku text,
  barcode text,
  price_adjustment numeric NOT NULL DEFAULT 0,
  cost_adjustment numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create stock_adjustments table
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  quantity integer NOT NULL,
  reason text NOT NULL,
  notes text,
  adjusted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS for product_variants
CREATE POLICY "Users can view variants in their business"
  ON public.product_variants FOR SELECT
  USING (
    product_id IN (
      SELECT id FROM public.products WHERE business_id = get_user_business_id(auth.uid())
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Owners/managers/inventory can manage variants"
  ON public.product_variants FOR ALL
  USING (
    product_id IN (
      SELECT id FROM public.products WHERE business_id = get_user_business_id(auth.uid())
    )
    AND (
      has_role(auth.uid(), 'business_owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'inventory_officer'::app_role)
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM public.products WHERE business_id = get_user_business_id(auth.uid())
    )
    AND (
      has_role(auth.uid(), 'business_owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'inventory_officer'::app_role)
    )
  );

-- RLS for stock_adjustments
CREATE POLICY "Users can view adjustments in their business"
  ON public.stock_adjustments FOR SELECT
  USING (
    business_id = get_user_business_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Owners/managers/inventory can create adjustments"
  ON public.stock_adjustments FOR INSERT
  WITH CHECK (
    business_id = get_user_business_id(auth.uid())
    AND (
      has_role(auth.uid(), 'business_owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'inventory_officer'::app_role)
    )
  );
