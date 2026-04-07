-- Add optional code and color columns to bottle_types table
ALTER TABLE public.bottle_types
ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE public.bottle_types
ADD COLUMN IF NOT EXISTS color TEXT;
