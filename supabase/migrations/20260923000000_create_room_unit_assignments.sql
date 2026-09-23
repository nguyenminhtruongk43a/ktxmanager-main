-- Migration: Create room_unit_assignments table for admin-assigned unit labels per room
-- Timestamp: 20260923000000

CREATE TABLE IF NOT EXISTS public.room_unit_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ktx text NOT NULL,
  day text NOT NULL,
  phong_so text NOT NULL,
  don_vi text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (ktx, day, phong_so)
);

-- Enable RLS
ALTER TABLE public.room_unit_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all assignments
DROP POLICY IF EXISTS "authenticated_read_room_unit_assignments" ON public.room_unit_assignments;
CREATE POLICY "authenticated_read_room_unit_assignments"
ON public.room_unit_assignments
FOR SELECT
TO authenticated
USING (true);

-- Allow anon to read (for JS client before session is ready)
DROP POLICY IF EXISTS "anon_read_room_unit_assignments" ON public.room_unit_assignments;
CREATE POLICY "anon_read_room_unit_assignments"
ON public.room_unit_assignments
FOR SELECT
TO anon
USING (true);

-- Allow authenticated users to insert
DROP POLICY IF EXISTS "authenticated_insert_room_unit_assignments" ON public.room_unit_assignments;
CREATE POLICY "authenticated_insert_room_unit_assignments"
ON public.room_unit_assignments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update
DROP POLICY IF EXISTS "authenticated_update_room_unit_assignments" ON public.room_unit_assignments;
CREATE POLICY "authenticated_update_room_unit_assignments"
ON public.room_unit_assignments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete
DROP POLICY IF EXISTS "authenticated_delete_room_unit_assignments" ON public.room_unit_assignments;
CREATE POLICY "authenticated_delete_room_unit_assignments"
ON public.room_unit_assignments
FOR DELETE
TO authenticated
USING (true);
