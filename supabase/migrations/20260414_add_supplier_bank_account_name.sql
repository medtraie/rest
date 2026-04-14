ALTER TABLE IF EXISTS public.suppliers
ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
