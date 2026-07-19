-- Disable RLS temporarily to allow inserts
ALTER TABLE public.factory_invoices DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS but allow everything (uncomment if you prefer this):
-- DROP POLICY IF EXISTS "factory_invoices_insert_auth" ON public.factory_invoices;
-- CREATE POLICY "factory_invoices_insert_all" ON public.factory_invoices FOR INSERT WITH CHECK (true);
