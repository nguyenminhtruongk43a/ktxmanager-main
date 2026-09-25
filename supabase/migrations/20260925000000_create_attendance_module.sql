-- ─── QR Attendance Module ────────────────────────────────────────────────────
-- attendance_sessions: one session per date, opened by admin
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date  DATE NOT NULL,
  opened_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at     TIMESTAMPTZ DEFAULT now(),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_sessions_date
  ON public.attendance_sessions (session_date);

-- attendance_records: one record per worker per session
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  session_date  DATE NOT NULL,
  ma_nv         TEXT NOT NULL,
  ho_va_ten     TEXT NOT NULL,
  ktx           TEXT DEFAULT '',
  day           TEXT DEFAULT '',
  phong_so      TEXT DEFAULT '',
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  status        TEXT DEFAULT 'present',
  ghi_chu       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Unique: one check-in per employee per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_session_manv
  ON public.attendance_records (session_id, ma_nv);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id
  ON public.attendance_records (session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session_date
  ON public.attendance_records (session_date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records  ENABLE ROW LEVEL SECURITY;

-- attendance_sessions: authenticated users can read; only authenticated can insert/update
DROP POLICY IF EXISTS "attendance_sessions_select" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_select"
  ON public.attendance_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "attendance_sessions_insert" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_insert"
  ON public.attendance_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_sessions_update" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_update"
  ON public.attendance_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_sessions_delete" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_delete"
  ON public.attendance_sessions FOR DELETE
  TO authenticated
  USING (true);

-- attendance_records: public can insert (worker scan page is unauthenticated)
DROP POLICY IF EXISTS "attendance_records_select" ON public.attendance_records;
CREATE POLICY "attendance_records_select"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "attendance_records_insert_public" ON public.attendance_records;
CREATE POLICY "attendance_records_insert_public"
  ON public.attendance_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_records_update" ON public.attendance_records;
CREATE POLICY "attendance_records_update"
  ON public.attendance_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_records_delete" ON public.attendance_records;
CREATE POLICY "attendance_records_delete"
  ON public.attendance_records FOR DELETE
  TO authenticated
  USING (true);
