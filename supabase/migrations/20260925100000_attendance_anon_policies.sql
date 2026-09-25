-- Allow anonymous (unauthenticated worker scan page) to read attendance_sessions by date
-- This is needed because the attendance page now looks up sessions by date without a session ID

DROP POLICY IF EXISTS "attendance_sessions_select_anon" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_select_anon"
  ON public.attendance_sessions FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous to select attendance_records (needed for upsert conflict check)
DROP POLICY IF EXISTS "attendance_records_select_anon" ON public.attendance_records;
CREATE POLICY "attendance_records_select_anon"
  ON public.attendance_records FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous to update attendance_records (needed for upsert on conflict update)
DROP POLICY IF EXISTS "attendance_records_update_anon" ON public.attendance_records;
CREATE POLICY "attendance_records_update_anon"
  ON public.attendance_records FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
