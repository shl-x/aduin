/**
 * src/app/api/verify/[id]/confirm/route.ts
 *
 * POST /api/verify/[id]/confirm   body: { confirmed: boolean, note?: string }
 *
 * Warga pelapor menanggapi aduan berstatus ai_verified:
 *   - confirmed = true  → status closed, closed_at diisi.
 *   - confirmed = false → status in_progress; alasan WAJIB.
 * Keduanya dicatat di citizen_confirmations. `closed` hanya boleh dicapai
 * dari ai_verified — status lain ditolak dengan HTTP 422.
 */

import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { transitionComplaintStatus } from "@/lib/services/complaint-status";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Harus login." }, { status: 401 });
  }
  if (profile.role !== "warga") {
    return NextResponse.json(
      { error: "Hanya warga pelapor yang dapat mengonfirmasi penyelesaian." },
      { status: 403 }
    );
  }

  let body: { confirmed?: unknown; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid." }, { status: 400 });
  }
  if (typeof body.confirmed !== "boolean") {
    return NextResponse.json({ error: "confirmed wajib bernilai true atau false." }, { status: 400 });
  }
  const confirmed = body.confirmed;
  const note = body.note?.trim() || null;
  if (!confirmed && !note) {
    return NextResponse.json({ error: "Alasan penolakan wajib diisi." }, { status: 400 });
  }

  const supabase = createClient();

  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, status, reporter_id")
    .eq("id", id)
    .maybeSingle();
  if (!complaint) {
    return NextResponse.json({ error: "Aduan tidak ditemukan." }, { status: 404 });
  }
  if (complaint.reporter_id !== profile.id) {
    return NextResponse.json({ error: "Aduan ini bukan milik Anda." }, { status: 403 });
  }
  if (complaint.status !== "ai_verified") {
    return NextResponse.json(
      {
        error:
          "Konfirmasi hanya bisa dilakukan untuk aduan yang sudah terverifikasi. Aduan hanya bisa ditutup dari status 'Terverifikasi AI'.",
      },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  const transition = await transitionComplaintStatus(
    supabase,
    id,
    "ai_verified",
    confirmed ? "closed" : "in_progress",
    confirmed ? { closed_at: now } : {}
  );
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: transition.httpStatus });
  }

  const { error: insertErr } = await supabase.from("citizen_confirmations").insert({
    complaint_id: id,
    confirmed,
    note,
    confirmed_at: now,
  });
  if (insertErr) {
    console.error(`[/api/verify/${id}/confirm] Gagal mencatat konfirmasi:`, insertErr.message);
  }

  return NextResponse.json({ ok: true, status: confirmed ? "closed" : "in_progress" });
}
