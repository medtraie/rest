CREATE TABLE IF NOT EXISTS public.driver_sector_assignments (
    driver_id TEXT PRIMARY KEY,
    sector_id TEXT NOT NULL,
    sector_code TEXT,
    sector_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.driver_sector_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_sector_assignments'
          AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users"
            ON public.driver_sector_assignments
            FOR SELECT
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_sector_assignments'
          AND policyname = 'Enable insert for all users'
    ) THEN
        CREATE POLICY "Enable insert for all users"
            ON public.driver_sector_assignments
            FOR INSERT
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_sector_assignments'
          AND policyname = 'Enable update for all users'
    ) THEN
        CREATE POLICY "Enable update for all users"
            ON public.driver_sector_assignments
            FOR UPDATE
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_sector_assignments'
          AND policyname = 'Enable delete for all users'
    ) THEN
        CREATE POLICY "Enable delete for all users"
            ON public.driver_sector_assignments
            FOR DELETE
            USING (true);
    END IF;
END
$$;
