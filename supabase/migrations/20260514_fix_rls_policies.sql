-- Allow all authenticated users to read and write to bottle_types
ALTER TABLE public.bottle_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for users based on user_id" ON public.bottle_types;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.bottle_types;

CREATE POLICY "Allow all operations for authenticated users" 
ON public.bottle_types 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ensure totalquantity column exists and is numeric
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bottle_types' AND column_name = 'totalquantity') THEN
        ALTER TABLE public.bottle_types ADD COLUMN totalquantity numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bottle_types' AND column_name = 'remainingquantity') THEN
        ALTER TABLE public.bottle_types ADD COLUMN remainingquantity numeric DEFAULT 0;
    END IF;
END $$;

-- Fix factory_operations
ALTER TABLE public.factory_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for users based on user_id" ON public.factory_operations;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.factory_operations;

CREATE POLICY "Allow all operations for authenticated users" 
ON public.factory_operations 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
