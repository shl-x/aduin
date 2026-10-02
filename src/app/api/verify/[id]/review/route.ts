/**
 * src/app/api/verify/[id]/review/route.ts
 *
 * POST /api/verify/[id]/review   body: { action: "approve" | "return", note?: string }
 *
 * Operator meninjau aduan berstatus needs_review:
 *   - approve → status ai_verified; verifikasi terakhir dicatat
 *               manual_approval = true, approved_by, approval_note.
 *   - return  → status in_progress; catatan WAJIB, dicatat sebagai
 *               manual_approval = false agar petugas tahu alasannya.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { transitionComplaintStatus } from "@/lib/services/complaint-status";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const role = await getSessionRole();
  if (role !== "operator") {
    return NextResponse.json(
      { error: "Hanya operator yang dapat meninjau verifikasi." },
      { status: 403 }
    );
  }

  const supabaseSSR = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login." }, { status: 401 });
  }

  let body: { action?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  const action = body.action;
  const note = body.note?.trim() || null;
  if (action !== "approve" && action !== "return") {
    return NextResponse.json({ error: 'action wajib "approve" atau "return".' }, { status: 400 });
  }
  if (action === "return" && !note) {
    return NextResponse.json(
      { error: "Catatan wajib diisi saat mengembalikan ke petugas." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!complaint) {
    return NextResponse.json({ error: "Aduan tidak ditemukan." }, { status: 404 });
  }
  // Tinjauan operator hanya berlaku dari needs_review (in_progress → ai_verified
  // juga legal di state machine, tetapi itu jalur sistem, bukan operator).
  if (complaint.status !== "needs_review") {
    return NextResponse.json(
      { error: "Hanya aduan berstatus 'Perlu Ditinjau' yang bisa disetujui atau dikembalikan." },
      { status: 422 }
    );
  }

  const { data: verification } = await supabase
    .from("verifications")
    .select("id")
    .eq("complaint_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!verification) {
    return NextResponse.json(
      { error: "Belum ada foto bukti penyelesaian dari petugas untuk ditinjau." },
      { status: 422 }
    );
  }

  const transition = await transitionComplaintStatus(
    supabase,
    id,
    "needs_review",
    action === "approve" ? "ai_verified" : "in_progress"
  );
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: transition.httpStatus });
  }

  const { error: updateErr } = await supabase
    .from("verifications")
    .update({
      manual_approval: action === "approve",
      approved_by: user.id,
      approval_note: note,
    })
    .eq("id", verification.id);
  if (updateErr) {
    console.error(`[/api/verify/${id}/review] Gagal mencatat tinjauan:`, updateErr.message);
  }

  return NextResponse.json({
    ok: true,
    status: action === "approve" ? "ai_verified" : "in_progress",
  });
}
