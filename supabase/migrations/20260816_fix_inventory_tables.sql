-- 1. Fix bottle_types: add missing distributedquantity column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bottle_types' AND column_name = 'distributedquantity') THEN
        ALTER TABLE public.bottle_types ADD COLUMN distributedquantity numeric DEFAULT 0;
    END IF;
END $$;

-- 2. Create empty_bottles_stock if it doesn't exist
CREATE TABLE IF NOT EXISTS public.empty_bottles_stock (
    id text PRIMARY KEY,
    bottletypeid text,
    bottletypename text,
    quantity numeric DEFAULT 0,
    lastupdated text,
    user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE public.empty_bottles_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.empty_bottles_stock;
CREATE POLICY "Allow all operations for authenticated users" 
ON public.empty_bottles_stock 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Create defective_stock if it doesn't exist
CREATE TABLE IF NOT EXISTS public.defective_stock (
    id text PRIMARY KEY,
    bottletypeid text,
    bottletypename text,
    quantity numeric DEFAULT 0,
    returnorderid text,
    lastupdated text,
    user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE public.defective_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.defective_stock;
CREATE POLICY "Allow all operations for authenticated users" 
ON public.defective_stock 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Create stock_history if it doesn't exist
CREATE TABLE IF NOT EXISTS public.stock_history (
    id text PRIMARY KEY,
    date text,
    bottletypeid text,
    bottletypename text,
    stocktype text,
    changetype text,
    previousquantity numeric DEFAULT 0,
    newquantity numeric DEFAULT 0,
    quantity numeric DEFAULT 0,
    note text,
    userid text,
    user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.stock_history;
CREATE POLICY "Allow all operations for authenticated users" 
ON public.stock_history 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
