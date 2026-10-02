-- =============================================================================
-- Aduin — Migrasi 0003: penggantian rencana koordinasi secara atomik
-- File    : supabase/migrations/0003_coordination_rpc.sql
-- Perintah: supabase db push  (atau terapkan manual di Supabase SQL editor)
--
-- ARCHITECTURE.md §4.8: rencana `ai_generated` menggantikan rencana
-- sederhana — plan lama + tasks lama dihapus, plan baru + tasks +
-- dependencies diinsert dalam SATU transaksi. supabase-js tidak mendukung
-- transaksi multi-statement, jadi logika ini berada di fungsi plpgsql yang
-- dipanggil lewat supabase.rpc() dari POST /api/coordination/[id].
--
-- Seluruh body fungsi berjalan dalam satu transaksi: jika satu statement
-- gagal (mis. opd_short_name tidak ada di tabel opd), semua perubahan
-- di-rollback dan rencana lama tetap utuh.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.replace_coordination_plan(
  p_complaint_id uuid,
  p_summary      text,
  p_raw_response jsonb,
  p_created_by   uuid,
  p_tasks        jsonb  -- [{sequence, title, description, opd_short_name, depends_on: [int]}]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id  uuid;
  v_task     jsonb;
  v_task_id  uuid;
  v_opd_id   uuid;
  v_dep      jsonb;
  v_seq_map  jsonb := '{}'::jsonb;  -- sequence (text) → task id
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.complaints WHERE id = p_complaint_id) THEN
    RAISE EXCEPTION 'Aduan % tidak ditemukan', p_complaint_id;
  END IF;

  -- tasks & task_dependencies ikut terhapus lewat ON DELETE CASCADE.
  DELETE FROM public.coordination_plans WHERE complaint_id = p_complaint_id;

  INSERT INTO public.coordination_plans (complaint_id, plan_type, summary, raw_response, created_by)
  VALUES (p_complaint_id, 'ai_generated', p_summary, p_raw_response, p_created_by)
  RETURNING id INTO v_plan_id;

  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
    SELECT id INTO v_opd_id FROM public.opd WHERE short_name = v_task->>'opd_short_name';
    IF v_opd_id IS NULL THEN
      RAISE EXCEPTION 'OPD "%" tidak ditemukan di tabel opd', v_task->>'opd_short_name';
    END IF;

    INSERT INTO public.tasks (plan_id, opd_id, title, description, sequence)
    VALUES (
      v_plan_id,
      v_opd_id,
      v_task->>'title',
      v_task->>'description',
      (v_task->>'sequence')::smallint
    )
    RETURNING id INTO v_task_id;

    v_seq_map := v_seq_map || jsonb_build_object(v_task->>'sequence', v_task_id);
  END LOOP;

  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
    FOR v_dep IN SELECT * FROM jsonb_array_elements(COALESCE(v_task->'depends_on', '[]'::jsonb)) LOOP
      IF NOT (v_seq_map ? (v_dep #>> '{}')) THEN
        RAISE EXCEPTION 'depends_on % tidak merujuk ke sequence yang ada', v_dep #>> '{}';
      END IF;
      INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
      VALUES (
        (v_seq_map->>(v_task->>'sequence'))::uuid,
        (v_seq_map->>(v_dep #>> '{}'))::uuid
      );
    END LOOP;
  END LOOP;

  RETURN v_plan_id;
END;
$$;

-- Hanya server (service role) yang boleh memanggil fungsi ini — otorisasi
-- operator dicek di route handler sebelum rpc() dipanggil.
REVOKE ALL ON FUNCTION public.replace_coordination_plan(uuid, text, jsonb, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_coordination_plan(uuid, text, jsonb, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_coordination_plan(uuid, text, jsonb, uuid, jsonb) TO service_role;
