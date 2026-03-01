-- Force full schema cache reload by touching the sales table
COMMENT ON COLUMN public.sales.customer_name IS 'Customer name for the sale';
NOTIFY pgrst, 'reload schema';