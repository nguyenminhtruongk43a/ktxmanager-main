-- Migration: Fix Worker Deletion Tracking for Accurate Fluctuation Reports
-- Timestamp: 20260924100000
-- Problem: Hard-deleting workers removes the row entirely, so deleted_at is lost.
--          RPC functions querying workers WHERE deleted_at IS NOT NULL always return 0.
-- Solution: Persist deletion records in a separate log table before hard-deleting.

-- ─── Create worker_deletion_log table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.worker_deletion_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     TEXT        NOT NULL,
  ho_va_ten     TEXT,
  ma_nv         TEXT,
  ktx           TEXT,
  day           TEXT,
  deleted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_deletion_log_deleted_at ON public.worker_deletion_log(deleted_at);
CREATE INDEX IF NOT EXISTS idx_worker_deletion_log_ktx       ON public.worker_deletion_log(ktx);
CREATE INDEX IF NOT EXISTS idx_worker_deletion_log_day       ON public.worker_deletion_log(day);

ALTER TABLE public.worker_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_worker_deletion_log" ON public.worker_deletion_log;
CREATE POLICY "authenticated_manage_worker_deletion_log"
  ON public.worker_deletion_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Update RPC: get_worker_fluctuation ───────────────────────────────────────
-- Now uses worker_deletion_log for removals (persists after hard delete)
CREATE OR REPLACE FUNCTION public.get_worker_fluctuation(
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_ktx         TEXT    DEFAULT NULL,
  p_day         TEXT    DEFAULT NULL,
  p_cutoff_hour INTEGER DEFAULT 14
)
RETURNS TABLE(
  ngay           DATE,
  so_tang        BIGINT,
  so_giam        BIGINT,
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
    -- Use worker_deletion_log: records persist even after hard delete
    SELECT
      (deleted_at AT TIME ZONE v_tz)::DATE AS ngay_xoa,
      COUNT(*) AS cnt
    FROM public.worker_deletion_log
    WHERE
      (p_ktx IS NULL OR ktx = p_ktx)
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

-- ─── Update RPC: get_worker_fluctuation_summary ───────────────────────────────
-- Now uses worker_deletion_log for tong_giam (persists after hard delete)
CREATE OR REPLACE FUNCTION public.get_worker_fluctuation_summary(
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_ktx         TEXT    DEFAULT NULL,
  p_day         TEXT    DEFAULT NULL,
  p_cutoff_hour INTEGER DEFAULT 14
)
RETURNS TABLE(
  tong_tang            BIGINT,
  tong_giam            BIGINT,
  bien_dong_rong       BIGINT,
  so_ngay_co_bien_dong BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tz      TEXT   := 'Asia/Ho_Chi_Minh';
  v_tang    BIGINT;
  v_giam    BIGINT;
BEGIN
  -- Count additions from workers table
  SELECT COUNT(*) INTO v_tang
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
    );

  -- Count removals from worker_deletion_log (persists after hard delete)
  SELECT COUNT(*) INTO v_giam
  FROM public.worker_deletion_log
  WHERE
    (p_ktx IS NULL OR ktx = p_ktx)
    AND (p_day IS NULL OR day = p_day)
    AND (p_date_from IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE >= p_date_from)
    AND (p_date_to   IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE <= p_date_to)
    AND (
      p_cutoff_hour = -1
      OR EXTRACT(HOUR FROM (deleted_at AT TIME ZONE v_tz)) < p_cutoff_hour
      OR (deleted_at AT TIME ZONE v_tz)::DATE < (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::DATE
    );

  RETURN QUERY
  SELECT
    v_tang                AS tong_tang,
    v_giam                AS tong_giam,
    (v_tang - v_giam)     AS bien_dong_rong,
    (
      SELECT COUNT(DISTINCT ngay) FROM (
        SELECT (created_at AT TIME ZONE v_tz)::DATE AS ngay
        FROM public.workers
        WHERE
          (p_ktx IS NULL OR ktx = p_ktx)
          AND (p_day IS NULL OR day = p_day)
          AND (p_date_from IS NULL OR (created_at AT TIME ZONE v_tz)::DATE >= p_date_from)
          AND (p_date_to   IS NULL OR (created_at AT TIME ZONE v_tz)::DATE <= p_date_to)
        UNION ALL
        SELECT (deleted_at AT TIME ZONE v_tz)::DATE AS ngay
        FROM public.worker_deletion_log
        WHERE
          (p_ktx IS NULL OR ktx = p_ktx)
          AND (p_day IS NULL OR day = p_day)
          AND (p_date_from IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE >= p_date_from)
          AND (p_date_to   IS NULL OR (deleted_at AT TIME ZONE v_tz)::DATE <= p_date_to)
      ) sub
    )::BIGINT             AS so_ngay_co_bien_dong;
END;
$$;
