CREATE TABLE IF NOT EXISTS public.driver_commission_settings (
    user_id UUID NOT NULL,
    driver_id TEXT NOT NULL,
    sa_j NUMERIC DEFAULT 0,
    sa_v NUMERIC DEFAULT 0,
    comm NUMERIC DEFAULT 0,
    salaire NUMERIC DEFAULT 0,
    primes NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, driver_id)
);

ALTER TABLE public.driver_commission_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_commission_settings'
          AND policyname = 'driver_commission_settings_select_own'
    ) THEN
        CREATE POLICY "driver_commission_settings_select_own"
            ON public.driver_commission_settings
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_commission_settings'
          AND policyname = 'driver_commission_settings_insert_own'
    ) THEN
        CREATE POLICY "driver_commission_settings_insert_own"
            ON public.driver_commission_settings
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_commission_settings'
          AND policyname = 'driver_commission_settings_update_own'
    ) THEN
        CREATE POLICY "driver_commission_settings_update_own"
            ON public.driver_commission_settings
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_commission_settings'
          AND policyname = 'driver_commission_settings_delete_own'
    ) THEN
        CREATE POLICY "driver_commission_settings_delete_own"
            ON public.driver_commission_settings
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END
$$;
