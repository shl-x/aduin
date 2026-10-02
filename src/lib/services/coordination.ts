/**
 * src/lib/services/coordination.ts
 *
 * Helper rencana koordinasi OPD (M4) — dipakai oleh:
 *   - POST /api/coordination/[id]   (input aduin-opd-agent dari triage efektif)
 *   - PATCH /api/tasks/[taskId]     (cek ketergantungan sebelum tugas dimulai)
 *   - /aduan/[id] dan /tugas        (menampilkan tasks + dependensi)
 *
 * Semua fungsi menerima admin client (service role) — otorisasi per role
 * dilakukan di route handler / page sebelum fungsi ini dipanggil.
 */

import type { createClient } from "@/lib/supabase/client";
import type { TaskStatus } from "@/lib/constants/tasks";

type AdminClient = ReturnType<typeof createClient>;

export interface EffectiveTriage {
  category: string;
  opd_short_name: string;
  urgency: number;
  impact: string;
  handling_path: string;
  reason: string;
}

/**
 * Hasil triage efektif = triage AI terbaru yang sudah dikoreksi override
 * operator. Kategori & OPD diambil dari kolom effective_* di complaints
 * (sudah diperbarui oleh POST /api/triage/[id]/override); handling_path
 * tidak punya kolom effective, jadi diambil dari override terbaru.
 * @returns null jika aduan belum pernah berhasil di-triage.
 */
export async function getEffectiveTriage(
  supabase: AdminClient,
  complaintId: string
): Promise<EffectiveTriage | null> {
  const [{ data: complaint }, { data: triage }, { data: pathOverride }] = await Promise.all([
    supabase
      .from("complaints")
      .select("effective_category, opd:effective_opd_id(short_name)")
      .eq("id", complaintId)
      .maybeSingle(),
    supabase
      .from("triage_results")
      .select("category, urgency, impact, handling_path, reason, opd:opd_id(short_name)")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("triage_overrides")
      .select("new_value")
      .eq("complaint_id", complaintId)
      .eq("field_overridden", "handling_path")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!complaint || !triage) return null;

  const effectiveOpd = complaint.opd as unknown as { short_name: string } | null;
  const triageOpd = triage.opd as unknown as { short_name: string } | null;
  const opdShortName = effectiveOpd?.short_name ?? triageOpd?.short_name;
  if (!opdShortName) return null;

  return {
    category: complaint.effective_category ?? triage.category,
    opd_short_name: opdShortName,
    urgency: triage.urgency,
    impact: triage.impact,
    handling_path: pathOverride?.new_value ?? triage.handling_path,
    reason: triage.reason,
  };
}

export interface TaskDependencyView {
  id: string;
  sequence: number;
  title: string;
  status: TaskStatus;
  opd_short_name: string | null;
}

export interface TaskView {
  id: string;
  plan_id: string;
  sequence: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  completed_at: string | null;
  updated_at: string;
  opd: { id: string; short_name: string; name: string } | null;
  depends_on: TaskDependencyView[];
  /** true jika masih belum_mulai dan ada dependensi yang belum selesai. */
  waiting: boolean;
}

export interface CoordinationPlanView {
  id: string;
  plan_type: "simple" | "ai_generated";
  summary: string | null;
  created_at: string;
  tasks: TaskView[];
}

const TASK_COLUMNS =
  "id, plan_id, sequence, title, description, status, completed_at, updated_at, opd:opd_id(id, short_name, name)";

interface RawTaskRow {
  id: string;
  plan_id: string;
  sequence: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  completed_at: string | null;
  updated_at: string;
  opd: { id: string; short_name: string; name: string } | null;
}

/**
 * Melengkapi baris tasks dengan daftar dependensinya + flag `waiting`.
 * Dependensi diambil dengan dua query terpisah (bukan embed) karena
 * task_dependencies punya dua FK ke tasks.
 */
export async function attachDependencies(
  supabase: AdminClient,
  rows: RawTaskRow[]
): Promise<TaskView[]> {
  if (rows.length === 0) return [];

  const { data: deps, error: depsErr } = await supabase
    .from("task_dependencies")
    .select("task_id, depends_on_task_id")
    .in(
      "task_id",
      rows.map((r) => r.id)
    );
  if (depsErr) throw new Error(`Gagal memuat ketergantungan tugas: ${depsErr.message}`);

  const depIds = [...new Set((deps ?? []).map((d) => d.depends_on_task_id as string))];
  const depTasks = new Map<string, TaskDependencyView>();
  if (depIds.length > 0) {
    const { data: depRows, error: depRowsErr } = await supabase
      .from("tasks")
      .select("id, sequence, title, status, opd:opd_id(short_name)")
      .in("id", depIds);
    if (depRowsErr) throw new Error(`Gagal memuat tugas prasyarat: ${depRowsErr.message}`);
    for (const d of depRows ?? []) {
      const opd = d.opd as unknown as { short_name: string } | null;
      depTasks.set(d.id, {
        id: d.id,
        sequence: d.sequence,
        title: d.title,
        status: d.status as TaskStatus,
        opd_short_name: opd?.short_name ?? null,
      });
    }
  }

  return rows.map((row) => {
    const dependsOn = (deps ?? [])
      .filter((d) => d.task_id === row.id)
      .map((d) => depTasks.get(d.depends_on_task_id as string))
      .filter((d): d is TaskDependencyView => d !== undefined)
      .sort((a, b) => a.sequence - b.sequence);
    return {
      ...row,
      depends_on: dependsOn,
      waiting: row.status === "belum_mulai" && dependsOn.some((d) => d.status !== "selesai"),
    };
  });
}

/** Rencana koordinasi aduan beserta tasks terurut, atau null jika belum ada. */
export async function getCoordinationPlan(
  supabase: AdminClient,
  complaintId: string
): Promise<CoordinationPlanView | null> {
  const { data: plan, error: planErr } = await supabase
    .from("coordination_plans")
    .select("id, plan_type, summary, created_at")
    .eq("complaint_id", complaintId)
    .maybeSingle();
  if (planErr) throw new Error(`Gagal memuat rencana koordinasi: ${planErr.message}`);
  if (!plan) return null;

  const { data: rows, error: tasksErr } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("plan_id", plan.id)
    .order("sequence", { ascending: true });
  if (tasksErr) throw new Error(`Gagal memuat tugas: ${tasksErr.message}`);

  return {
    id: plan.id,
    plan_type: plan.plan_type as CoordinationPlanView["plan_type"],
    summary: plan.summary,
    created_at: plan.created_at,
    tasks: await attachDependencies(supabase, (rows ?? []) as unknown as RawTaskRow[]),
  };
}

export interface OpdTaskView extends TaskView {
  complaint: {
    id: string;
    text: string;
    status: string;
    region_name: string | null;
  } | null;
}

/** Semua tugas milik satu OPD, terbaru dulu, lengkap dengan konteks aduan. */
export async function getTasksForOpd(supabase: AdminClient, opdId: string): Promise<OpdTaskView[]> {
  const { data: rows, error } = await supabase
    .from("tasks")
    .select(
      `${TASK_COLUMNS}, plan:plan_id(complaint:complaint_id(id, text, status, region:region_id(name)))`
    )
    .eq("opd_id", opdId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Gagal memuat tugas OPD: ${error.message}`);

  const raw = (rows ?? []) as unknown as (RawTaskRow & {
    plan: {
      complaint: {
        id: string;
        text: string;
        status: string;
        region: { name: string } | null;
      } | null;
    } | null;
  })[];

  const withDeps = await attachDependencies(supabase, raw);
  return withDeps.map((task, i) => {
    const c = raw[i].plan?.complaint ?? null;
    return {
      ...task,
      complaint: c
        ? { id: c.id, text: c.text, status: c.status, region_name: c.region?.name ?? null }
        : null,
    };
  });
}
