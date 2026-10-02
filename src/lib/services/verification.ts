/**
 * src/lib/services/verification.ts
 *
 * Helper verifikasi penyelesaian (M5) — dipakai oleh:
 *   - POST /api/verify/[id]        (cek semua tugas selesai sebelum unggah bukti)
 *   - /tugas                       (daftar aduan yang menunggu bukti penyelesaian)
 *   - /aduan/[id] dan /lapor       (foto sebelum/sesudah + hasil AI + riwayat)
 *
 * Semua fungsi menerima admin client (service role) — otorisasi per role
 * dilakukan di route handler / page sebelum fungsi ini dipanggil.
 */

import type { createClient } from "@/lib/supabase/client";

type AdminClient = ReturnType<typeof createClient>;

export interface PlanProgress {
  total: number;
  done: number;
}

/** Jumlah tugas & tugas selesai per aduan (seluruh OPD dalam rencana). */
export async function getPlanProgress(
  supabase: AdminClient,
  complaintIds: string[]
): Promise<Map<string, PlanProgress>> {
  const result = new Map<string, PlanProgress>();
  if (complaintIds.length === 0) return result;

  const { data, error } = await supabase
    .from("coordination_plans")
    .select("complaint_id, tasks(status)")
    .in("complaint_id", complaintIds);
  if (error) throw new Error(`Gagal memuat progres tugas: ${error.message}`);

  for (const plan of data ?? []) {
    const tasks = (plan.tasks ?? []) as { status: string }[];
    result.set(plan.complaint_id, {
      total: tasks.length,
      done: tasks.filter((t) => t.status === "selesai").length,
    });
  }
  return result;
}

/** true jika rencana aduan punya ≥1 tugas dan semuanya selesai. */
export function isPlanComplete(progress: PlanProgress | undefined): boolean {
  return !!progress && progress.total > 0 && progress.done === progress.total;
}

export interface VerificationRow {
  id: string;
  complaint_id: string;
  photo_after_url: string;
  ai_status: "ai_verified" | "needs_review";
  ai_reason: string;
  manual_approval: boolean | null;
  approval_note: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface ConfirmationRow {
  id: string;
  complaint_id: string;
  confirmed: boolean;
  note: string | null;
  confirmed_at: string;
}

export interface VerificationHistory {
  verifications: VerificationRow[];
  confirmations: ConfirmationRow[];
}

/** Semua verifikasi & konfirmasi warga untuk sekumpulan aduan, terbaru dulu. */
export async function getVerificationHistory(
  supabase: AdminClient,
  complaintIds: string[]
): Promise<Map<string, VerificationHistory>> {
  const result = new Map<string, VerificationHistory>();
  if (complaintIds.length === 0) return result;
  for (const id of complaintIds) result.set(id, { verifications: [], confirmations: [] });

  const [{ data: verifications, error: vErr }, { data: confirmations, error: cErr }] =
    await Promise.all([
      supabase
        .from("verifications")
        .select(
          "id, complaint_id, photo_after_url, ai_status, ai_reason, manual_approval, approval_note, approved_by, created_at"
        )
        .in("complaint_id", complaintIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("citizen_confirmations")
        .select("id, complaint_id, confirmed, note, confirmed_at")
        .in("complaint_id", complaintIds)
        .order("confirmed_at", { ascending: false }),
    ]);
  if (vErr) throw new Error(`Gagal memuat verifikasi: ${vErr.message}`);
  if (cErr) throw new Error(`Gagal memuat konfirmasi warga: ${cErr.message}`);

  for (const v of (verifications ?? []) as VerificationRow[]) {
    result.get(v.complaint_id)?.verifications.push(v);
  }
  for (const c of (confirmations ?? []) as ConfirmationRow[]) {
    result.get(c.complaint_id)?.confirmations.push(c);
  }
  return result;
}

export interface ReturnNote {
  source: "operator" | "warga";
  note: string;
  at: string;
}

/**
 * Catatan pengembalian terbaru (operator "Kembalikan ke Petugas" atau warga
 * "Tolak") — ditampilkan ke petugas agar tahu apa yang perlu diperbaiki.
 */
export function latestReturnNote(history: VerificationHistory | undefined): ReturnNote | null {
  if (!history) return null;
  const candidates: ReturnNote[] = [
    ...history.verifications
      .filter((v) => v.manual_approval === false && v.approval_note)
      .map((v) => ({ source: "operator" as const, note: v.approval_note!, at: v.created_at })),
    ...history.confirmations
      .filter((c) => !c.confirmed && c.note)
      .map((c) => ({ source: "warga" as const, note: c.note!, at: c.confirmed_at })),
  ];
  candidates.sort((a, b) => b.at.localeCompare(a.at));
  return candidates[0] ?? null;
}

export interface CompletionCandidate {
  id: string;
  text: string;
  status: string;
  region_name: string | null;
  photo_after_url: string | null;
  progress: PlanProgress;
  latest_verification: VerificationRow | null;
  return_note: ReturnNote | null;
}

const COMPLETION_STATUSES = ["in_progress", "needs_review", "ai_verified"];

/**
 * Aduan yang melibatkan OPD ini (minimal satu tugas di rencananya) dan
 * berada di tahap penyelesaian — untuk seksi "Bukti Penyelesaian" di /tugas.
 */
export async function getCompletionCandidatesForOpd(
  supabase: AdminClient,
  opdId: string
): Promise<CompletionCandidate[]> {
  const { data: taskRows, error: taskErr } = await supabase
    .from("tasks")
    .select("plan:plan_id(complaint_id)")
    .eq("opd_id", opdId);
  if (taskErr) throw new Error(`Gagal memuat tugas OPD: ${taskErr.message}`);

  const complaintIds = [
    ...new Set(
      ((taskRows ?? []) as unknown as { plan: { complaint_id: string } | null }[])
        .map((r) => r.plan?.complaint_id)
        .filter((id): id is string => !!id)
    ),
  ];
  if (complaintIds.length === 0) return [];

  const { data: complaints, error: cErr } = await supabase
    .from("complaints")
    .select("id, text, status, photo_after_url, updated_at, region:region_id(name)")
    .in("id", complaintIds)
    .in("status", COMPLETION_STATUSES)
    .order("updated_at", { ascending: false });
  if (cErr) throw new Error(`Gagal memuat aduan: ${cErr.message}`);
  if (!complaints || complaints.length === 0) return [];

  const ids = complaints.map((c) => c.id);
  const [progress, history] = await Promise.all([
    getPlanProgress(supabase, ids),
    getVerificationHistory(supabase, ids),
  ]);

  return complaints.map((c) => {
    const region = c.region as unknown as { name: string } | null;
    const h = history.get(c.id);
    return {
      id: c.id,
      text: c.text,
      status: c.status,
      region_name: region?.name ?? null,
      photo_after_url: c.photo_after_url,
      progress: progress.get(c.id) ?? { total: 0, done: 0 },
      latest_verification: h?.verifications[0] ?? null,
      return_note: latestReturnNote(h),
    };
  });
}
