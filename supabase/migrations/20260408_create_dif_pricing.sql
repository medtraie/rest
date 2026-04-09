-- Create table for DIF pricing
CREATE TABLE IF NOT EXISTS public.dif_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT,
    designation TEXT,
    qte_dif DECIMAL(10,2) DEFAULT 0,
    prix_dif DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.dif_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.dif_pricing FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.dif_pricing FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.dif_pricing FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.dif_pricing FOR DELETE USING (true);

-- Insert seed data
INSERT INTO public.dif_pricing (code, designation, qte_dif, prix_dif) VALUES
('6003', 'TISSIR GAZ CHARGES 3 KG', 0, 0.50),
('6006', 'TISSIR GAZ CHANGES 6 KGS', 0, 0.50),
('6012', 'TISSIR GAZ CHARGES 12 KGS', 40, 1.50),
('6022', 'BNG TISSIR RECHARGE 12KG', 0, 1.00),
('6026', 'TISSIR GAZ CHARGE 6 KG ROBINE', 0, 0.50),
('6035', 'TISSIR GAZ CHARGES PROPANE 3!', 0, 0.00),
('6103', 'AFRIQUIA GAZ CHARGES 3 KG', 0, 0.50),
('6106', 'AFRIQUIA GAZ CHARGES 6 KGS', 0, 0.50),
('6112', 'AFRIQUIA GAZ CHARGES 12 KGS', 0, 1.50),
('6122', 'RECHARGE BNG AFRIQUIA 12KG', 0, 1.00),
('6126', 'AFRIQUIA GAZ CHARGE 6 KG ROBI', 40, 20.00),
('6135', 'AFRIQUIA GAZ CHARGE PROPANE', 0, 0.00),
('6203', 'CMH GAZ CHARGES 3 KGS', 0, 0.00),
('6206', 'CMHGAZ CHARGES 6 KGS', 0, 0.00);