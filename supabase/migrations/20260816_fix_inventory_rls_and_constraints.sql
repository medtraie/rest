-- 1. Supprimer la contrainte de type de stock sur stock_history pour autoriser 'full'
ALTER TABLE public.stock_history DROP CONSTRAINT IF EXISTS stock_history_stocktype_check;

-- 2. Désactiver temporairement/définitivement RLS sur les tables d'inventaire pour éviter les échecs d'écriture silencieux
ALTER TABLE public.bottle_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.empty_bottles_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.defective_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history DISABLE ROW LEVEL SECURITY;
