-- Add room_label column to room_units table
-- This column stores a custom display name/label for each room, keyed by (ktx, day_nha, phong_so)

ALTER TABLE public.room_units
ADD COLUMN IF NOT EXISTS room_label TEXT;
