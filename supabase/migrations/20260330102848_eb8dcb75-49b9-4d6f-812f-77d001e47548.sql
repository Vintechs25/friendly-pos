
-- Restaurant tables
CREATE TABLE public.restaurant_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  table_number TEXT NOT NULL,
  name TEXT,
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available',
  floor TEXT DEFAULT 'Main',
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rt_select" ON public.restaurant_tables FOR SELECT USING (business_id = get_user_business_id(auth.uid()));
CREATE POLICY "rt_all" ON public.restaurant_tables FOR ALL USING (business_id = get_user_business_id(auth.uid()));

-- Kitchen orders (KOT)
CREATE TABLE public.kitchen_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.kitchen_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ko_select" ON public.kitchen_orders FOR SELECT USING (business_id = get_user_business_id(auth.uid()));
CREATE POLICY "ko_all" ON public.kitchen_orders FOR ALL USING (business_id = get_user_business_id(auth.uid()));

-- Kitchen order items
CREATE TABLE public.kitchen_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kitchen_order_id UUID NOT NULL REFERENCES public.kitchen_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kitchen_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "koi_select" ON public.kitchen_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.kitchen_orders ko WHERE ko.id = kitchen_order_items.kitchen_order_id AND ko.business_id = get_user_business_id(auth.uid()))
);
CREATE POLICY "koi_all" ON public.kitchen_order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.kitchen_orders ko WHERE ko.id = kitchen_order_items.kitchen_order_id AND ko.business_id = get_user_business_id(auth.uid()))
);

-- Add table_id to sales for table-based ordering
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'counter';

-- Enable realtime for kitchen orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_order_items;
