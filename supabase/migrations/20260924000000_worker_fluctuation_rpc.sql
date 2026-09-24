-- Migration: Worker Fluctuation RPC Functions
-- Timestamp: 20260924000000
-- Purpose: Compute real net worker growth/fluctuation directly from workers table
-- Uses created_at for additions, ngay_ra_ktx for departures (soft-delete proxy)

-- ─── Add deleted_at column for soft-delete tracking ───────────────────────────
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_workers_created_at ON public.workers(created_at);
CREATE INDEX IF NOT EXISTS idx_workers_deleted_at ON public.workers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_workers_ktx ON public.workers(ktx);

-- ─── RPC: Get daily worker fluctuation ────────────────────────────────────────
-- Returns per-day counts of workers added (tang) and removed (giam)
-- Filters by optional date range, ktx, and day (building)
-- cutoff_hour: 0-23, default 14 (2 PM). Pass -1 for real-time (no cutoff)
CREATE OR REPLACE FUNCTION public.get_worker_fluctuation(
  p_date_from DATE DEFAULT NULL,
  p_date_to   DATE DEFAULT NULL,
  p_ktx       TEXT DEFAULT NULL,
  p_day       TEXT DEFAULT NULL,
  p_cutoff_hour INTEGER DEFAULT 14
)
RETURNS TABLE(
  ngay        DATE,
  so_tang     BIGINT,
  so_giam     BIGINT,
  bien_dong_rong BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tz TEXT := 'Asia/Ho_Chi_Minh';
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      COALESCE(p_date_from, (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE - INTERVAL '29 days'),
      COALESCE(p_date_to,   (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE),
      INTERVAL '1 day'
    )::DATE AS d
  ),
  additions AS (
    SELECT
      (created_at AT TIME ZONE v_tz)::DATE AS ngay_them,
      COUNT(*) AS cnt
    FROM public.workers
    WHERE
      (p_ktx IS NULL OR ktx = p_ktx)
      AND (p_day IS NULL OR day = p_day)
      AND (p_date_from IS NULL OR (created_at AT TIME ZONE v_tz)::DATE >= p_date_from)
      AND (p_date_to   IS NULL OR (created_at AT TIME ZONE v_tz)::DATE <= p_date_to)
      AND (
        p_cutoff_hour = -1
        OR EXTRACT(HOUR FROM (created_at AT TIME ZONE v_tz)) < p_cutoff_hour
        OR (created_at AT TIME ZONE v_tz)::DATE < (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE
      )
    GROUP BY 1
  ),
  removals AS (
    SELECT
      (deleted_at AT TIME ZONE v_tz)::DATE AS ngay_xoa,
      COUNT(*) AS cnt
    FROM public.workers
    WHERE
      deleted_at IS NOT NULL
      AND (p_ktx IS NULL OR ktx = p_ktx)
      AND (p_day IS NULL OR day = p_day)
      AND (p_date_from IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE >= p_date_from)
      AND (p_date_to   IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE <= p_date_to)
      AND (
        p_cutoff_hour = -1
        OR EXTRACT(HOUR FROM (deleted_at AT TIME ZONE v_tz)) < p_cutoff_hour
        OR (deleted_at AT TIME ZONE v_tz)::DATE < (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE
      )
    GROUP BY 1
  )
  SELECT
    ds.d                                          AS ngay,
    COALESCE(a.cnt, 0)                            AS so_tang,
    COALESCE(r.cnt, 0)                            AS so_giam,
    COALESCE(a.cnt, 0) - COALESCE(r.cnt, 0)      AS bien_dong_rong
  FROM date_series ds
  LEFT JOIN additions a ON a.ngay_them = ds.d
  LEFT JOIN removals  r ON r.ngay_xoa  = ds.d
  WHERE COALESCE(a.cnt, 0) > 0 OR COALESCE(r.cnt, 0) > 0
  ORDER BY ds.d;
END;
$$;

-- ─── RPC: Get worker fluctuation summary ──────────────────────────────────────
-- Returns aggregate totals for the selected period
CREATE OR REPLACE FUNCTION public.get_worker_fluctuation_summary(
  p_date_from   DATE DEFAULT NULL,
  p_date_to     DATE DEFAULT NULL,
  p_ktx         TEXT DEFAULT NULL,
  p_day         TEXT DEFAULT NULL,
  p_cutoff_hour INTEGER DEFAULT 14
)
RETURNS TABLE(
  tong_tang         BIGINT,
  tong_giam         BIGINT,
  bien_dong_rong    BIGINT,
  so_ngay_co_bien_dong BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tz TEXT := 'Asia/Ho_Chi_Minh';
BEGIN
  RETURN QUERY
  SELECT
    (
      SELECT COUNT(*) FROM public.workers
      WHERE
        (p_ktx IS NULL OR ktx = p_ktx)
        AND (p_day IS NULL OR day = p_day)
        AND (p_date_from IS NULL OR (created_at AT TIME ZONE v_tz)::DATE >= p_date_from)
        AND (p_date_to   IS NULL OR (created_at AT TIME ZONE v_tz)::DATE <= p_date_to)
        AND (
          p_cutoff_hour = -1
          OR EXTRACT(HOUR FROM (created_at AT TIME ZONE v_tz)) < p_cutoff_hour
          OR (created_at AT TIME ZONE v_tz)::DATE < (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE
        )
    )::BIGINT AS tong_tang,
    (
      SELECT COUNT(*) FROM public.workers
      WHERE
        deleted_at IS NOT NULL
        AND (p_ktx IS NULL OR ktx = p_ktx)
        AND (p_day IS NULL OR day = p_day)
        AND (p_date_from IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE >= p_date_from)
        AND (p_date_to   IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE <= p_date_to)
        AND (
          p_cutoff_hour = -1
          OR EXTRACT(HOUR FROM (deleted_at AT TIME ZONE v_tz)) < p_cutoff_hour
          OR (deleted_at AT TIME ZONE v_tz)::DATE < (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE
        )
    )::BIGINT AS tong_giam,
    (
      SELECT COUNT(*) FROM public.workers
      WHERE
        (p_ktx IS NULL OR ktx = p_ktx)
        AND (p_day IS NULL OR day = p_day)
        AND (p_date_from IS NULL OR (created_at AT TIME ZONE v_tz)::DATE >= p_date_from)
        AND (p_date_to   IS NULL OR (created_at AT TIME ZONE v_tz)::DATE <= p_date_to)
        AND (
          p_cutoff_hour = -1
          OR EXTRACT(HOUR FROM (created_at AT TIME ZONE v_tz)) < p_cutoff_hour
          OR (created_at AT TIME ZONE v_tz)::DATE < (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE
        )
    )::BIGINT
    -
    (
      SELECT COUNT(*) FROM public.workers
      WHERE
        deleted_at IS NOT NULL
        AND (p_ktx IS NULL OR ktx = p_ktx)
        AND (p_day IS NULL OR day = p_day)
        AND (p_date_from IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE >= p_date_from)
        AND (p_date_to   IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE <= p_date_to)
        AND (
          p_cutoff_hour = -1
          OR EXTRACT(HOUR FROM (deleted_at AT TIME ZONE v_tz)) < p_cutoff_hour
          OR (deleted_at AT TIME ZONE v_tz)::DATE < (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE
        )
    )::BIGINT AS bien_dong_rong,
    (
      SELECT COUNT(DISTINCT ngay) FROM (
        SELECT (created_at AT TIME ZONE v_tz)::DATE AS ngay FROM public.workers
        WHERE
          (p_ktx IS NULL OR ktx = p_ktx)
          AND (p_day IS NULL OR day = p_day)
          AND (p_date_from IS NULL OR (created_at AT TIME ZONE v_tz)::DATE >= p_date_from)
          AND (p_date_to   IS NULL OR (created_at AT TIME ZONE v_tz)::DATE <= p_date_to)
        UNION ALL
        SELECT (deleted_at AT TIME ZONE v_tz)::DATE AS ngay FROM public.workers
        WHERE
          deleted_at IS NOT NULL
          AND (p_ktx IS NULL OR ktx = p_ktx)
          AND (p_day IS NULL OR day = p_day)
          AND (p_date_from IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE >= p_date_from)
          AND (p_date_to   IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE <= p_date_to)
      ) sub
    )::BIGINT AS so_ngay_co_bien_dong;
END;
$$;

-- ─── Trigger: auto-set deleted_at when worker is soft-deleted ─────────────────
-- NOTE: Hard deletes won't set deleted_at. This column is for future soft-delete support.
-- For now, the application should set deleted_at before deleting to track departures.
