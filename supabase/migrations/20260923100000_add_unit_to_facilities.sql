-- Migration: Add unit TEXT column to facilities table for admin-assigned room unit labels
-- Timestamp: 20260923100000

ALTER TABLE public.facilities
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT NULL;
