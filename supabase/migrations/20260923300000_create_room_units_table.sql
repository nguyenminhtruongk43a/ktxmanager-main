-- Migration: Create dedicated room_units table for storing room unit configuration
-- Columns: ktx (TEXT), day_nha (TEXT), phong_so (TEXT), unit (TEXT)
-- UNIQUE constraint on (ktx, day_nha, phong_so) to enable upsert
-- Timestamp: 20260923300000

CREATE TABLE IF NOT EXISTS public.room_units (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ktx text NOT NULL,
  day_nha text NOT NULL,
  phong_so text NOT NULL,
  unit text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT room_units_ktx_day_nha_phong_so_key UNIQUE (ktx, day_nha, phong_so)
);

-- Enable RLS
ALTER TABLE public.room_units ENABLE ROW LEVEL SECURITY;

-- Allow anon to SELECT (needed before session is fully ready)
DROP POLICY IF EXISTS "anon_select_room_units" ON public.room_units;
CREATE POLICY "anon_select_room_units"
ON public.room_units
FOR SELECT
TO anon
USING (true);

-- Allow anon to INSERT (admin may use anon key)
DROP POLICY IF EXISTS "anon_insert_room_units" ON public.room_units;
CREATE POLICY "anon_insert_room_units"
ON public.room_units
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to UPDATE
DROP POLICY IF EXISTS "anon_update_room_units" ON public.room_units;
CREATE POLICY "anon_update_room_units"
ON public.room_units
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon to DELETE
DROP POLICY IF EXISTS "anon_delete_room_units" ON public.room_units;
CREATE POLICY "anon_delete_room_units"
ON public.room_units
FOR DELETE
TO anon
USING (true);

-- Allow authenticated to SELECT
DROP POLICY IF EXISTS "authenticated_select_room_units" ON public.room_units;
CREATE POLICY "authenticated_select_room_units"
ON public.room_units
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated to INSERT
DROP POLICY IF EXISTS "authenticated_insert_room_units" ON public.room_units;
CREATE POLICY "authenticated_insert_room_units"
ON public.room_units
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated to UPDATE
DROP POLICY IF EXISTS "authenticated_update_room_units" ON public.room_units;
CREATE POLICY "authenticated_update_room_units"
ON public.room_units
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated to DELETE
DROP POLICY IF EXISTS "authenticated_delete_room_units" ON public.room_units;
CREATE POLICY "authenticated_delete_room_units"
ON public.room_units
FOR DELETE
TO authenticated
USING (true);
