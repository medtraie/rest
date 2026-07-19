-- Create factory_invoices table
CREATE TABLE IF NOT EXISTS public.factory_invoices (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    bl_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_sent NUMERIC NOT NULL DEFAULT 0,
    total_received NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.factory_invoices ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factory_invoices' AND policyname = 'factory_invoices_select_all') THEN
        CREATE POLICY "factory_invoices_select_all" ON public.factory_invoices FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factory_invoices' AND policyname = 'factory_invoices_insert_auth') THEN
        CREATE POLICY "factory_invoices_insert_auth" ON public.factory_invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factory_invoices' AND policyname = 'factory_invoices_update_auth') THEN
        CREATE POLICY "factory_invoices_update_auth" ON public.factory_invoices FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factory_invoices' AND policyname = 'factory_invoices_delete_auth') THEN
        CREATE POLICY "factory_invoices_delete_auth" ON public.factory_invoices FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;
