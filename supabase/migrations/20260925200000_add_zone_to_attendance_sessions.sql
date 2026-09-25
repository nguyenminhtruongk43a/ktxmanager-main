-- Add zone columns to attendance_sessions for per-dãy/phòng QR support
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS zone_ktx   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS zone_day   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS zone_phong TEXT DEFAULT '';

-- Drop old unique index on session_date (one per date) and replace with
-- a unique index on (session_date, zone_ktx, zone_day, zone_phong)
-- so multiple zone-specific sessions can coexist on the same date.
DROP INDEX IF EXISTS idx_attendance_sessions_date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_sessions_date_zone
  ON public.attendance_sessions (session_date, zone_ktx, zone_day, zone_phong);
