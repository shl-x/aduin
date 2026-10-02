-- =============================================================================
-- Aduin — Migrasi 0004: early warning (z-score) + geser timeline demo
-- File    : supabase/migrations/0004_early_warning.sql
-- Perintah: supabase db push  (atau terapkan manual di Supabase SQL editor)
--
-- 1. alert_window_stats — statistik lonjakan per (effective_category, region_id)
--    sesuai ARCHITECTURE.md §5.2. Dipanggil dari src/lib/analytics/early-warning.ts.
-- 2. shift_seed_timeline — menggeser semua timestamp data seed dengan selisih
--    yang sama (dipakai supabase/seed/refresh-demo-timeline.ts).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. alert_window_stats
--
-- Jendela waktu (semua relatif terhadap p_now, dikirim dari aplikasi):
--   - count_24h : aduan dengan reported_at di (p_now - 24 jam, p_now]
--   - baseline  : generate_series(p_now - 14 hari, p_now - 1 hari, 1 hari)
--                 → TEPAT 14 titik. Setiap titik `day_end` mewakili jendela
--                 24 jam (day_end - 1 hari, day_end]. Ke-14 jendela berurutan
--                 tanpa celah dan tidak tumpang tindih dengan count_24h.
--                 LEFT JOIN membuat hari tanpa aduan dihitung 0.
--   - std_14d   : STDDEV_POP dengan batas bawah 1.0 agar z tidak meledak
--                 saat baseline nol.
--
-- Tanpa filter: mengembalikan semua kombinasi yang punya ≥1 aduan dalam
-- 24 jam terakhir (kombinasi tanpa aduan baru tidak mungkin memicu alert).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alert_window_stats(
  p_now         timestamptz,
  p_category    text DEFAULT NULL,
  p_region_id   uuid DEFAULT NULL
)
RETURNS TABLE (
  category      text,
  region_id     uuid,
  count_24h     integer,
  mean_14d      double precision,
  std_14d       double precision,
  baseline_days integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH combos AS (
    SELECT c.effective_category AS category, c.region_id, COUNT(*)::int AS count_24h
    FROM public.complaints c
    WHERE c.effective_category IS NOT NULL
      AND c.region_id IS NOT NULL
      AND c.reported_at >  p_now - INTERVAL '24 hours'
      AND c.reported_at <= p_now
      AND (p_category  IS NULL OR c.effective_category = p_category)
      AND (p_region_id IS NULL OR c.region_id = p_region_id)
    GROUP BY 1, 2
  ),
  days AS (
    SELECT gs AS day_end
    FROM generate_series(
      p_now - INTERVAL '14 days',
      p_now - INTERVAL '1 day',
      INTERVAL '1 day'
    ) AS gs
  ),
  daily AS (
    SELECT cb.category, cb.region_id, d.day_end, COUNT(x.id)::int AS cnt
    FROM combos cb
    CROSS JOIN days d
    LEFT JOIN public.complaints x
      ON  x.effective_category = cb.category
      AND x.region_id          = cb.region_id
      AND x.reported_at >  d.day_end - INTERVAL '1 day'
      AND x.reported_at <= d.day_end
    GROUP BY cb.category, cb.region_id, d.day_end
  )
  SELECT
    cb.category,
    cb.region_id,
    cb.count_24h,
    COALESCE(AVG(dl.cnt), 0)::double precision                         AS mean_14d,
    GREATEST(COALESCE(STDDEV_POP(dl.cnt), 0), 1.0)::double precision   AS std_14d,
    COUNT(dl.day_end)::int                                             AS baseline_days
  FROM combos cb
  JOIN daily dl ON dl.category = cb.category AND dl.region_id = cb.region_id
  GROUP BY cb.category, cb.region_id, cb.count_24h;
$$;

-- ---------------------------------------------------------------------------
-- 2. shift_seed_timeline
--
-- Menambahkan p_delta ke semua timestamp yang terkait data seed, dalam satu
-- transaksi, sehingga pola relatif antar-aduan tetap sama. Cakupan:
--   complaints (is_seed) dan semua turunannya, cluster yang dirujuk aduan
--   seed, serta alerts seed + dismissal-nya.
-- Mengembalikan jumlah aduan yang digeser.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shift_seed_timeline(p_delta interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  CREATE TEMP TABLE _seed_ids ON COMMIT DROP AS
    SELECT id FROM public.complaints WHERE is_seed;

  UPDATE public.complaints
     SET reported_at = reported_at + p_delta,
         closed_at   = closed_at   + p_delta,
         created_at  = created_at  + p_delta,
         updated_at  = updated_at  + p_delta
   WHERE id IN (SELECT id FROM _seed_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.triage_results       SET created_at   = created_at   + p_delta WHERE complaint_id IN (SELECT id FROM _seed_ids);
  UPDATE public.triage_overrides     SET created_at   = created_at   + p_delta WHERE complaint_id IN (SELECT id FROM _seed_ids);
  UPDATE public.complaint_embeddings SET created_at   = created_at   + p_delta WHERE complaint_id IN (SELECT id FROM _seed_ids);
  UPDATE public.verifications        SET created_at   = created_at   + p_delta WHERE complaint_id IN (SELECT id FROM _seed_ids);
  UPDATE public.citizen_confirmations SET confirmed_at = confirmed_at + p_delta WHERE complaint_id IN (SELECT id FROM _seed_ids);
  UPDATE public.coordination_plans   SET created_at   = created_at   + p_delta WHERE complaint_id IN (SELECT id FROM _seed_ids);

  UPDATE public.tasks t
     SET created_at   = t.created_at   + p_delta,
         updated_at   = t.updated_at   + p_delta,
         completed_at = t.completed_at + p_delta
    FROM public.coordination_plans p
   WHERE t.plan_id = p.id AND p.complaint_id IN (SELECT id FROM _seed_ids);

  UPDATE public.task_dependencies td
     SET created_at = td.created_at + p_delta
    FROM public.tasks t
    JOIN public.coordination_plans p ON p.id = t.plan_id
   WHERE td.task_id = t.id AND p.complaint_id IN (SELECT id FROM _seed_ids);

  UPDATE public.clusters
     SET first_seen_at = first_seen_at + p_delta,
         last_seen_at  = last_seen_at  + p_delta,
         created_at    = created_at    + p_delta,
         updated_at    = updated_at    + p_delta
   WHERE id IN (SELECT cluster_id FROM public.complaints WHERE id IN (SELECT id FROM _seed_ids) AND cluster_id IS NOT NULL);

  UPDATE public.alert_dismissals
     SET dismissed_at = dismissed_at + p_delta
   WHERE alert_id IN (SELECT id FROM public.alerts WHERE is_seed);
  UPDATE public.alerts
     SET triggered_at = triggered_at + p_delta,
         created_at   = created_at   + p_delta
   WHERE is_seed;

  RETURN v_count;
END;
$$;

-- Hanya server (service role) yang boleh memanggil kedua fungsi ini.
REVOKE ALL ON FUNCTION public.alert_window_stats(timestamptz, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_window_stats(timestamptz, text, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.shift_seed_timeline(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shift_seed_timeline(interval) TO service_role;
