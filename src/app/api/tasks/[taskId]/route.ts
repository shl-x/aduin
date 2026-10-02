/**
 * src/app/api/tasks/[taskId]/route.ts
 *
 * PATCH /api/tasks/[taskId]   body: { status: "proses" | "selesai" }
 *
 * Petugas OPD memperbarui status sub-tugas milik OPD-nya. Transisi hanya
 * maju satu langkah: belum_mulai → proses → selesai. Tugas yang
 * ketergantungannya belum selesai tidak bisa dimulai (HTTP 422).
 *
 * Saat tugas pertama sebuah aduan dimulai, complaints.status berubah dari
 * 'triaged' ke 'in_progress' (ARCHITECTURE.md §3).
 */

import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from "@/lib/constants/tasks";
import { attachDependencies } from "@/lib/services/coordination";

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  belum_mulai: "proses",
  proses: "selesai",
  selesai: null,
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
): Promise<NextResponse> {
  const { taskId } = await params;

  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Harus login." }, { status: 401 });
  }
  if (profile.role !== "petugas_opd" || !profile.opd_id) {
    return NextResponse.json(
      { error: "Hanya petugas OPD yang dapat memperbarui status tugas." },
      { status: 403 }
    );
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  const nextStatus = body.status as TaskStatus | undefined;
  if (!nextStatus || !TASK_STATUSES.includes(nextStatus)) {
    return NextResponse.json(
      { error: `status wajib salah satu dari: ${TASK_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, plan_id, sequence, title, description, status, completed_at, updated_at, opd_id, plan:plan_id(complaint_id)"
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  if (task.opd_id !== profile.opd_id) {
    return NextResponse.json({ error: "Tugas ini bukan milik OPD Anda." }, { status: 403 });
  }

  const currentStatus = task.status as TaskStatus;
  if (NEXT_STATUS[currentStatus] !== nextStatus) {
    return NextResponse.json(
      {
        error: `Status tidak bisa diubah dari "${TASK_STATUS_LABELS[currentStatus]}" ke "${TASK_STATUS_LABELS[nextStatus]}".`,
      },
      { status: 422 }
    );
  }

  if (currentStatus === "belum_mulai") {
    const [withDeps] = await attachDependencies(supabase, [
      { ...task, status: currentStatus, opd: null },
    ]);
    const pending = withDeps.depends_on.filter((d) => d.status !== "selesai");
    if (pending.length > 0) {
      return NextResponse.json(
        {
          error: `Tugas masih menunggu: ${pending.map((d) => `#${d.sequence} ${d.title}`).join(", ")} belum selesai.`,
        },
        { status: 422 }
      );
    }
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("tasks")
    .update({
      status: nextStatus,
      updated_at: now,
      completed_at: nextStatus === "selesai" ? now : null,
    })
    .eq("id", taskId)
    // Optimistic lock: tidak ada baris ter-update jika status sudah diubah orang lain.
    .eq("status", currentStatus)
    .select("id");

  if (updateErr) {
    console.error(`[/api/tasks/${taskId}] Gagal update status:`, updateErr.message);
    return NextResponse.json({ error: "Gagal menyimpan status tugas." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Status tugas sudah diubah oleh pengguna lain. Muat ulang halaman." },
      { status: 409 }
    );
  }

  const plan = task.plan as unknown as { complaint_id: string } | null;
  if (nextStatus === "proses" && plan) {
    // Hanya transisi triaged → in_progress; status lain tidak disentuh.
    const { error: complaintErr } = await supabase
      .from("complaints")
      .update({ status: "in_progress", updated_at: now })
      .eq("id", plan.complaint_id)
      .eq("status", "triaged");
    if (complaintErr) {
      console.error(
        `[/api/tasks/${taskId}] Gagal memperbarui status aduan ${plan.complaint_id}:`,
        complaintErr.message
      );
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
