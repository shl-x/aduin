/**
 * src/app/api/verify/[id]/route.ts
 *
 * POST /api/verify/[id]   multipart/form-data: photo=<file gambar>
 *
 * Petugas OPD mengunggah foto bukti penyelesaian. Syarat: aduan berstatus
 * in_progress, OPD petugas terlibat dalam rencana koordinasinya, dan SEMUA
 * tugas di rencana sudah selesai.
 *
 * Foto diunggah oleh server (service role) ke bucket aduan-photos — klien
 * tidak mengirim URL, sehingga Langflow hanya pernah mengunduh foto dari
 * Storage kita sendiri.
 *
 * Alur: simpan photo_after_url → panggil aduin-verify → simpan ke
 * verifications → status aduan in_progress → ai_verified | needs_review.
 * Jika flow gagal/timeout: verifikasi disimpan sebagai needs_review dengan
 * alasan baku (docs/LANGFLOW_FLOWS.md §Flow 5 — Fallback).
 */

import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { runVerify } from "@/lib/langflow/client";
import { canTransition, transitionComplaintStatus } from "@/lib/services/complaint-status";
import { getPlanProgress, isPlanComplete } from "@/lib/services/verification";

const FALLBACK_REASON = "Verifikasi AI gagal; memerlukan tinjauan manual.";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Harus login." }, { status: 401 });
  }
  if (profile.role !== "petugas_opd" || !profile.opd_id) {
    return NextResponse.json(
      { error: "Hanya petugas OPD yang dapat mengunggah bukti penyelesaian." },
      { status: 403 }
    );
  }

  let photo: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("photo");
    photo = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "Body harus berupa multipart/form-data." }, { status: 400 });
  }
  if (!photo || photo.size === 0) {
    return NextResponse.json({ error: "Foto bukti penyelesaian wajib dilampirkan." }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[photo.type];
  if (!ext) {
    return NextResponse.json({ error: "Format foto harus JPG, PNG, atau WEBP." }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Ukuran foto maksimal 10 MB." }, { status: 400 });
  }

  const supabase = createClient();

  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, text, status, effective_category, photo_before_url")
    .eq("id", id)
    .maybeSingle();
  if (!complaint) {
    return NextResponse.json({ error: "Aduan tidak ditemukan." }, { status: 404 });
  }
  if (!canTransition(complaint.status, "needs_review")) {
    return NextResponse.json(
      { error: "Bukti penyelesaian hanya bisa diunggah untuk aduan berstatus 'Dikerjakan'." },
      { status: 422 }
    );
  }

  const { data: plan } = await supabase
    .from("coordination_plans")
    .select("id, tasks(opd_id)")
    .eq("complaint_id", id)
    .maybeSingle();
  const planTasks = (plan?.tasks ?? []) as { opd_id: string }[];
  if (!planTasks.some((t) => t.opd_id === profile.opd_id)) {
    return NextResponse.json(
      { error: "OPD Anda tidak memiliki tugas pada aduan ini." },
      { status: 403 }
    );
  }

  const progress = (await getPlanProgress(supabase, [id])).get(id);
  if (!isPlanComplete(progress)) {
    return NextResponse.json(
      {
        error: `Semua tugas harus selesai sebelum mengunggah bukti (${progress?.done ?? 0}/${progress?.total ?? 0} selesai).`,
      },
      { status: 422 }
    );
  }

  const path = `verifikasi/${id}/${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("aduan-photos")
    .upload(path, await photo.arrayBuffer(), { contentType: photo.type });
  if (uploadErr) {
    console.error(`[/api/verify/${id}] Gagal unggah foto:`, uploadErr.message);
    return NextResponse.json({ error: `Gagal mengunggah foto: ${uploadErr.message}` }, { status: 500 });
  }
  const photoAfterUrl = supabase.storage.from("aduan-photos").getPublicUrl(path).data.publicUrl;

  const { error: photoErr } = await supabase
    .from("complaints")
    .update({ photo_after_url: photoAfterUrl, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (photoErr) {
    console.error(`[/api/verify/${id}] Gagal menyimpan photo_after_url:`, photoErr.message);
    return NextResponse.json({ error: "Gagal menyimpan foto bukti." }, { status: 500 });
  }

  const result = await runVerify({
    complaint_text: complaint.text,
    category: complaint.effective_category ?? "",
    photo_before_url: complaint.photo_before_url ?? null,
    photo_after_url: photoAfterUrl,
  });

  const aiStatus = result.ok ? result.data.ai_status : "needs_review";
  const aiReason = result.ok ? result.data.ai_reason : FALLBACK_REASON;

  const { error: verifyErr } = await supabase.from("verifications").insert({
    complaint_id: id,
    photo_after_url: photoAfterUrl,
    ai_status: aiStatus,
    ai_reason: aiReason,
    raw_response: result.ok ? result.data : { error: result.error },
  });
  if (verifyErr) {
    console.error(`[/api/verify/${id}] Gagal menyimpan verifikasi:`, verifyErr.message);
    return NextResponse.json({ error: "Gagal menyimpan hasil verifikasi." }, { status: 500 });
  }

  const transition = await transitionComplaintStatus(supabase, id, complaint.status, aiStatus);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: transition.httpStatus });
  }

  return NextResponse.json({
    ok: true,
    ai_status: aiStatus,
    ai_reason: aiReason,
    ai_failed: !result.ok,
    photo_after_url: photoAfterUrl,
  });
}
