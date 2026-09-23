-- Migration: Ensure UNIQUE constraint on room_unit_assignments (ktx, day, phong_so)
-- This is idempotent — safe to run even if constraint already exists
-- Timestamp: 20260923200000

-- Drop constraint if it exists under a different name, then recreate it
DO $$
BEGIN
  -- Add unique constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'room_unit_assignments'
      AND c.contype = 'u'
      AND c.conname = 'room_unit_assignments_ktx_day_phong_so_key'
  ) THEN
    ALTER TABLE public.room_unit_assignments
      ADD CONSTRAINT room_unit_assignments_ktx_day_phong_so_key
      UNIQUE (ktx, day, phong_so);
  END IF;
END;
$$;
