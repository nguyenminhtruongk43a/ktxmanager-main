-- ─── Enhanced Bed System ─────────────────────────────────────────────────────
-- Adds: pending_status for "Chờ mã", ngay_ra_ktx for workers, auto-assign support

-- 1. Add pending_status to beds (supports "Chờ mã" workers without official Mã NV)
ALTER TABLE public.beds
  ADD COLUMN IF NOT EXISTS pending_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS temp_identifier TEXT DEFAULT NULL;

-- pending_status: NULL = normal, 'cho_ma' = waiting for official Mã NV
-- temp_identifier: temporary name/ID used when worker has no Mã NV yet

-- 2. Add ngay_ra_ktx to workers if not already present
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS ngay_ra_ktx TEXT DEFAULT NULL;

-- 3. Add index for worker_status filtering (for "Cựu nhân sự" tab)
CREATE INDEX IF NOT EXISTS idx_workers_worker_status ON public.workers(worker_status);
CREATE INDEX IF NOT EXISTS idx_workers_ngay_ra_ktx ON public.workers(ngay_ra_ktx);

-- 4. Add event_type for pending link in bed_history
-- (no schema change needed, event_type is TEXT and supports 'pending_linked')

-- 5. Ensure beds table has all needed indexes
CREATE INDEX IF NOT EXISTS idx_beds_pending_status ON public.beds(pending_status);
