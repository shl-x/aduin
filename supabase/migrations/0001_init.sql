-- =============================================================================
-- Aduin — Migrasi Inisial
-- File    : supabase/migrations/0001_init.sql
-- Perintah: supabase db push  (atau terapkan manual di Supabase SQL editor)
--
-- Urutan eksekusi yang aman:
--   0. Ekstensi
--   1. Tabel dasar tanpa FK ke tabel lain: regions, opd
--   2. Tabel profiles (FK ke auth.users + opd)
--   3. Tabel clusters (FK ke regions)
--   4. Tabel complaints (FK ke regions, clusters, opd, auth.users)
--   5. Tabel-tabel turunan complaints (embeddings, triage, koordinasi, dst.)
--   6. Tabel alerts & alert_dismissals
--   7. Tabel ai_cache
--   8. Fungsi helper (get_my_role, get_my_opd_id) — setelah profiles ada
--   9. Fungsi + trigger on_auth_user_created — setelah profiles ada
--  10. ENABLE ROW LEVEL SECURITY + semua policy
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Ekstensi
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ---------------------------------------------------------------------------
-- 1. Tabel: regions
-- ---------------------------------------------------------------------------
CREATE TABLE public.regions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  level       text NOT NULL CHECK (level IN ('kecamatan', 'desa')),
  parent_id   uuid REFERENCES public.regions(id),
  lat         double precision,
  lng         double precision,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_regions_level     ON public.regions (level);
CREATE INDEX idx_regions_parent_id ON public.regions (parent_id);

-- ---------------------------------------------------------------------------
-- 2. Tabel: opd
-- ---------------------------------------------------------------------------
CREATE TABLE public.opd (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  short_name   text NOT NULL,
  contact_info jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Tabel: profiles  (FK → auth.users, opd)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  role        text NOT NULL DEFAULT 'warga'
                CHECK (role IN ('warga', 'operator', 'petugas_opd', 'pimpinan')),
  opd_id      uuid REFERENCES public.opd(id),
  is_demo     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. Tabel: clusters  (FK → regions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.clusters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text,
  category      text,
  region_id     uuid REFERENCES public.regions(id),
  centroid_lat  double precision,
  centroid_lng  double precision,
  member_count  integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clusters_region_id   ON public.clusters (region_id);
CREATE INDEX idx_clusters_category    ON public.clusters (category);
CREATE INDEX idx_clusters_last_seen   ON public.clusters (last_seen_at);

-- ---------------------------------------------------------------------------
-- 5. Tabel: complaints  (FK → regions, clusters, opd, auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.complaints (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text               text NOT NULL,
  status             text NOT NULL DEFAULT 'pending',
  region_id          uuid REFERENCES public.regions(id),
  lat                double precision,
  lng                double precision,
  photo_before_url   text,
  photo_after_url    text,
  reporter_id        uuid REFERENCES auth.users(id),
  reported_at        timestamptz NOT NULL DEFAULT now(),
  closed_at          timestamptz,
  label_manual       text,
  is_seed            boolean NOT NULL DEFAULT false,
  cluster_id         uuid REFERENCES public.clusters(id),
  effective_category text,
  effective_opd_id   uuid REFERENCES public.opd(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaints_status             ON public.complaints (status);
CREATE INDEX idx_complaints_region_id          ON public.complaints (region_id);
CREATE INDEX idx_complaints_cluster_id         ON public.complaints (cluster_id);
CREATE INDEX idx_complaints_reported_at        ON public.complaints (reported_at);
CREATE INDEX idx_complaints_is_seed            ON public.complaints (is_seed);
CREATE INDEX idx_complaints_label_manual       ON public.complaints (label_manual);
CREATE INDEX idx_complaints_effective_category ON public.complaints (effective_category);
CREATE INDEX idx_complaints_effective_opd_id   ON public.complaints (effective_opd_id);

-- ---------------------------------------------------------------------------
-- 6. Tabel: complaint_embeddings  (FK → complaints)
-- ---------------------------------------------------------------------------
CREATE TABLE public.complaint_embeddings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id   uuid NOT NULL UNIQUE REFERENCES public.complaints(id) ON DELETE CASCADE,
  embedding      vector(768),
  model_version  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaint_embeddings_complaint_id ON public.complaint_embeddings (complaint_id);
-- HNSW index untuk cosine similarity (dibangun setelah data ada)
CREATE INDEX idx_complaint_embeddings_hnsw
  ON public.complaint_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 7. Tabel: triage_results  (FK → complaints, opd)
-- ---------------------------------------------------------------------------
CREATE TABLE public.triage_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  category      text NOT NULL,
  opd_id        uuid REFERENCES public.opd(id),
  urgency       smallint NOT NULL CHECK (urgency BETWEEN 1 AND 5),
  impact        text NOT NULL CHECK (impact IN ('rendah', 'sedang', 'tinggi')),
  handling_path text NOT NULL CHECK (handling_path IN ('quick_fix', 'bertahap', 'butuh_data')),
  reason        text NOT NULL,
  raw_response  jsonb,
  from_cache    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_triage_results_complaint_id ON public.triage_results (complaint_id);
CREATE INDEX idx_triage_results_opd_id       ON public.triage_results (opd_id);
CREATE INDEX idx_triage_results_category     ON public.triage_results (category);

-- ---------------------------------------------------------------------------
-- 8. Tabel: triage_overrides  (FK → complaints, auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.triage_overrides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id     uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  operator_id      uuid NOT NULL REFERENCES auth.users(id),
  field_overridden text NOT NULL CHECK (field_overridden IN ('category', 'opd', 'handling_path')),
  old_value        text NOT NULL,
  new_value        text NOT NULL,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_triage_overrides_complaint_id ON public.triage_overrides (complaint_id);
CREATE INDEX idx_triage_overrides_operator_id  ON public.triage_overrides (operator_id);

-- ---------------------------------------------------------------------------
-- 9. Tabel: coordination_plans  (FK → complaints, auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.coordination_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL UNIQUE REFERENCES public.complaints(id) ON DELETE CASCADE,
  plan_type    text NOT NULL DEFAULT 'simple' CHECK (plan_type IN ('simple', 'ai_generated')),
  summary      text,
  raw_response jsonb,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coordination_plans_complaint_id ON public.coordination_plans (complaint_id);
CREATE INDEX idx_coordination_plans_plan_type    ON public.coordination_plans (plan_type);

-- ---------------------------------------------------------------------------
-- 10. Tabel: tasks  (FK → coordination_plans, opd)
-- ---------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES public.coordination_plans(id) ON DELETE CASCADE,
  opd_id       uuid NOT NULL REFERENCES public.opd(id),
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'belum_mulai'
                 CHECK (status IN ('belum_mulai', 'proses', 'selesai')),
  sequence     smallint NOT NULL,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_plan_id ON public.tasks (plan_id);
CREATE INDEX idx_tasks_opd_id  ON public.tasks (opd_id);
CREATE INDEX idx_tasks_status  ON public.tasks (status);

-- ---------------------------------------------------------------------------
-- 11. Tabel: task_dependencies  (FK → tasks × 2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.task_dependencies (
  task_id            uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, depends_on_task_id)
);

-- ---------------------------------------------------------------------------
-- 12. Tabel: verifications  (FK → complaints, auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.verifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  photo_after_url text NOT NULL,
  ai_status       text NOT NULL CHECK (ai_status IN ('ai_verified', 'needs_review')),
  ai_reason       text NOT NULL,
  manual_approval boolean,
  approved_by     uuid REFERENCES auth.users(id),
  approval_note   text,
  raw_response    jsonb,
  from_cache      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verifications_complaint_id ON public.verifications (complaint_id);
CREATE INDEX idx_verifications_ai_status    ON public.verifications (ai_status);

-- ---------------------------------------------------------------------------
-- 13. Tabel: citizen_confirmations  (FK → complaints)
-- ---------------------------------------------------------------------------
CREATE TABLE public.citizen_confirmations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  confirmed    boolean NOT NULL,
  note         text,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_citizen_confirmations_complaint_id ON public.citizen_confirmations (complaint_id);

-- ---------------------------------------------------------------------------
-- 14. Tabel: alerts  (FK → regions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.alerts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category           text NOT NULL,
  region_id          uuid REFERENCES public.regions(id),
  count_24h          integer NOT NULL,
  mean_14d           double precision NOT NULL,
  std_14d            double precision NOT NULL,
  z_score            double precision NOT NULL,
  ai_summary         text,
  ai_recommendations jsonb,
  summary_status     text NOT NULL DEFAULT 'pending_retry'
                       CHECK (summary_status IN ('done', 'pending_retry')),
  is_seed            boolean NOT NULL DEFAULT false,
  triggered_at       timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_region_id      ON public.alerts (region_id);
CREATE INDEX idx_alerts_category       ON public.alerts (category);
CREATE INDEX idx_alerts_triggered_at   ON public.alerts (triggered_at);
CREATE INDEX idx_alerts_is_seed        ON public.alerts (is_seed);
CREATE INDEX idx_alerts_summary_status ON public.alerts (summary_status);

-- ---------------------------------------------------------------------------
-- 15. Tabel: alert_dismissals  (FK → alerts, auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.alert_dismissals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id     uuid NOT NULL UNIQUE REFERENCES public.alerts(id) ON DELETE CASCADE,
  operator_id  uuid NOT NULL REFERENCES auth.users(id),
  note         text,
  dismissed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_dismissals_alert_id    ON public.alert_dismissals (alert_id);
CREATE INDEX idx_alert_dismissals_operator_id ON public.alert_dismissals (operator_id);

-- ---------------------------------------------------------------------------
-- 16. Tabel: ai_cache  (FK → complaints)
-- ---------------------------------------------------------------------------
CREATE TABLE public.ai_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_name    text NOT NULL,
  input_hash   text NOT NULL,
  output       jsonb NOT NULL,
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  UNIQUE (flow_name, input_hash)
);

CREATE INDEX idx_ai_cache_flow_input   ON public.ai_cache (flow_name, input_hash);
CREATE INDEX idx_ai_cache_complaint_id ON public.ai_cache (complaint_id);

-- =============================================================================
-- Fungsi helper  (dibuat SETELAH public.profiles sudah ada)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 8a. Helper: ambil role pengguna saat ini (dipakai oleh RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 8b. Helper: ambil opd_id pengguna saat ini (dipakai oleh RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_opd_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT opd_id FROM public.profiles WHERE id = auth.uid();
$$;

-- =============================================================================
-- Trigger: isi profil default saat user baru dibuat di auth.users
-- (dibuat SETELAH public.profiles sudah ada)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'warga')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.regions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opd                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clusters             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_overrides     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_dismissals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache             ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- regions & opd: semua peran bisa SELECT
-- ---------------------------------------------------------------------------
CREATE POLICY "regions: semua bisa baca"
  ON public.regions FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "opd: semua bisa baca"
  ON public.opd FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE POLICY "profiles: baca milik sendiri (warga, petugas_opd)"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.get_my_role() IN ('operator', 'pimpinan')
  );

CREATE POLICY "profiles: update milik sendiri"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- complaints
-- ---------------------------------------------------------------------------
CREATE POLICY "complaints: warga baca milik sendiri"
  ON public.complaints FOR SELECT
  USING (
    (public.get_my_role() = 'warga'        AND reporter_id = auth.uid())
    OR public.get_my_role() IN ('operator', 'pimpinan')
    OR (public.get_my_role() = 'petugas_opd'
        AND effective_opd_id = public.get_my_opd_id())
  );

CREATE POLICY "complaints: warga insert"
  ON public.complaints FOR INSERT
  WITH CHECK (public.get_my_role() = 'warga');

CREATE POLICY "complaints: operator update"
  ON public.complaints FOR UPDATE
  USING (public.get_my_role() = 'operator');

-- ---------------------------------------------------------------------------
-- triage_results
-- ---------------------------------------------------------------------------
CREATE POLICY "triage_results: select"
  ON public.triage_results FOR SELECT
  USING (
    public.get_my_role() IN ('operator', 'pimpinan')
    OR (public.get_my_role() = 'warga'
        AND EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id AND c.reporter_id = auth.uid()
        ))
    OR (public.get_my_role() = 'petugas_opd'
        AND EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id
            AND c.effective_opd_id = public.get_my_opd_id()
        ))
  );

-- ---------------------------------------------------------------------------
-- triage_overrides
-- ---------------------------------------------------------------------------
CREATE POLICY "triage_overrides: operator insert + select all"
  ON public.triage_overrides FOR INSERT
  WITH CHECK (public.get_my_role() = 'operator');

CREATE POLICY "triage_overrides: operator + pimpinan select"
  ON public.triage_overrides FOR SELECT
  USING (public.get_my_role() IN ('operator', 'pimpinan'));

-- ---------------------------------------------------------------------------
-- coordination_plans
-- ---------------------------------------------------------------------------
CREATE POLICY "coordination_plans: operator insert + select"
  ON public.coordination_plans FOR INSERT
  WITH CHECK (public.get_my_role() = 'operator');

CREATE POLICY "coordination_plans: select"
  ON public.coordination_plans FOR SELECT
  USING (
    public.get_my_role() IN ('operator', 'pimpinan')
    OR (public.get_my_role() = 'petugas_opd'
        AND EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id
            AND c.effective_opd_id = public.get_my_opd_id()
        ))
  );

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE POLICY "tasks: select"
  ON public.tasks FOR SELECT
  USING (
    public.get_my_role() IN ('operator', 'pimpinan')
    OR (public.get_my_role() = 'petugas_opd'
        AND opd_id = public.get_my_opd_id())
  );

CREATE POLICY "tasks: petugas_opd update milik OPD-nya"
  ON public.tasks FOR UPDATE
  USING (
    public.get_my_role() = 'petugas_opd'
    AND opd_id = public.get_my_opd_id()
  );

-- ---------------------------------------------------------------------------
-- task_dependencies
-- ---------------------------------------------------------------------------
CREATE POLICY "task_dependencies: select"
  ON public.task_dependencies FOR SELECT
  USING (
    public.get_my_role() IN ('operator', 'pimpinan')
    OR (public.get_my_role() = 'petugas_opd'
        AND EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE t.id = task_id AND t.opd_id = public.get_my_opd_id()
        ))
  );

-- ---------------------------------------------------------------------------
-- verifications
-- ---------------------------------------------------------------------------
CREATE POLICY "verifications: petugas_opd insert"
  ON public.verifications FOR INSERT
  WITH CHECK (public.get_my_role() = 'petugas_opd');

CREATE POLICY "verifications: select"
  ON public.verifications FOR SELECT
  USING (
    public.get_my_role() IN ('operator', 'pimpinan')
    OR (public.get_my_role() = 'warga'
        AND EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id AND c.reporter_id = auth.uid()
        ))
    OR (public.get_my_role() = 'petugas_opd'
        AND EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id
            AND c.effective_opd_id = public.get_my_opd_id()
        ))
  );

CREATE POLICY "verifications: operator update (review)"
  ON public.verifications FOR UPDATE
  USING (public.get_my_role() = 'operator');

-- ---------------------------------------------------------------------------
-- citizen_confirmations
-- ---------------------------------------------------------------------------
CREATE POLICY "citizen_confirmations: warga insert milik sendiri"
  ON public.citizen_confirmations FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'warga'
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.reporter_id = auth.uid()
    )
  );

CREATE POLICY "citizen_confirmations: operator + pimpinan select"
  ON public.citizen_confirmations FOR SELECT
  USING (public.get_my_role() IN ('operator', 'pimpinan'));

CREATE POLICY "citizen_confirmations: warga select milik sendiri"
  ON public.citizen_confirmations FOR SELECT
  USING (
    public.get_my_role() = 'warga'
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.reporter_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
CREATE POLICY "alerts: operator + pimpinan select"
  ON public.alerts FOR SELECT
  USING (public.get_my_role() IN ('operator', 'pimpinan'));

-- ---------------------------------------------------------------------------
-- alert_dismissals
-- ---------------------------------------------------------------------------
CREATE POLICY "alert_dismissals: operator insert"
  ON public.alert_dismissals FOR INSERT
  WITH CHECK (public.get_my_role() = 'operator');

CREATE POLICY "alert_dismissals: operator select"
  ON public.alert_dismissals FOR SELECT
  USING (public.get_my_role() = 'operator');

-- ---------------------------------------------------------------------------
-- ai_cache
-- ---------------------------------------------------------------------------
CREATE POLICY "ai_cache: operator select"
  ON public.ai_cache FOR SELECT
  USING (public.get_my_role() = 'operator');

-- ---------------------------------------------------------------------------
-- clusters
-- ---------------------------------------------------------------------------
CREATE POLICY "clusters: semua kecuali warga bisa baca"
  ON public.clusters FOR SELECT
  USING (public.get_my_role() IN ('operator', 'petugas_opd', 'pimpinan'));

-- ---------------------------------------------------------------------------
-- complaint_embeddings
-- ---------------------------------------------------------------------------
CREATE POLICY "complaint_embeddings: operator select"
  ON public.complaint_embeddings FOR SELECT
  USING (public.get_my_role() = 'operator');
