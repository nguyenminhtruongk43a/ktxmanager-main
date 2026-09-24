-- Add room_note column to room_units table for free-text notes per room
ALTER TABLE public.room_units
  ADD COLUMN IF NOT EXISTS room_note TEXT DEFAULT NULL;
