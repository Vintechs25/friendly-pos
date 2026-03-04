
-- Add shift management settings to business_settings
ALTER TABLE public.business_settings
ADD COLUMN require_shift boolean NOT NULL DEFAULT false,
ADD COLUMN require_cash_counting boolean NOT NULL DEFAULT true;
