-- ─── Bed Sync System ─────────────────────────────────────────────────────────
-- Manages physical beds with QR codes, two-way sync with workers table

-- 1. Add worker_status column to workers table (tracks KTX residency status)
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS worker_status TEXT DEFAULT 'active';

-- 2. Create beds table: one row per physical bed
CREATE TABLE IF NOT EXISTS public.beds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ktx           TEXT NOT NULL DEFAULT '',
  day           TEXT NOT NULL DEFAULT '',
  phong_so      TEXT NOT NULL DEFAULT '',
  giuong        TEXT NOT NULL DEFAULT '',
  -- QR code identifier (used in QR URL: /bed-scan?bed_id=<bed_qr_id>)
  bed_qr_id     TEXT UNIQUE NOT NULL,
  -- Linked worker (Mã NV) — null means bed is empty
  ma_nv         TEXT DEFAULT NULL,
  ho_va_ten     TEXT DEFAULT NULL,
  -- Status: 'empty' | 'occupied'
  status        TEXT DEFAULT 'empty',
  assigned_at   TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beds_ktx ON public.beds(ktx);
CREATE INDEX IF NOT EXISTS idx_beds_day ON public.beds(day);
CREATE INDEX IF NOT EXISTS idx_beds_phong_so ON public.beds(phong_so);
CREATE INDEX IF NOT EXISTS idx_beds_ma_nv ON public.beds(ma_nv);
CREATE INDEX IF NOT EXISTS idx_beds_bed_qr_id ON public.beds(bed_qr_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON public.beds(status);

-- 3. Create bed_history table: audit trail for all bed events
CREATE TABLE IF NOT EXISTS public.bed_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id        UUID NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
  bed_qr_id     TEXT NOT NULL,
  ktx           TEXT NOT NULL DEFAULT '',
  day           TEXT NOT NULL DEFAULT '',
  phong_so      TEXT NOT NULL DEFAULT '',
  giuong        TEXT NOT NULL DEFAULT '',
  event_type    TEXT NOT NULL, -- 'assigned' | 'checked_out' | 'reassigned'
  ma_nv         TEXT DEFAULT NULL,
  ho_va_ten     TEXT DEFAULT NULL,
  performed_by  TEXT DEFAULT NULL, -- admin account email/name
  note          TEXT DEFAULT '',
  event_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bed_history_bed_id ON public.bed_history(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_history_ma_nv ON public.bed_history(ma_nv);
CREATE INDEX IF NOT EXISTS idx_bed_history_event_at ON public.bed_history(event_at DESC);

-- 4. Auto-update updated_at on beds
CREATE OR REPLACE FUNCTION public.update_beds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS beds_updated_at_trigger ON public.beds;
CREATE TRIGGER beds_updated_at_trigger
  BEFORE UPDATE ON public.beds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_beds_updated_at();

-- 5. RLS for beds
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_access_beds" ON public.beds;
CREATE POLICY "open_access_beds"
  ON public.beds
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 6. RLS for bed_history
ALTER TABLE public.bed_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_access_bed_history" ON public.bed_history;
CREATE POLICY "open_access_bed_history"
  ON public.bed_history
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
