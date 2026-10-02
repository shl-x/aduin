/**
 * src/app/api/alert/[alertId]/dismiss/route.ts
 *
 * POST /api/alert/[alertId]/dismiss   body: { note: string }
 *
 * Operator menutup alert (catatan wajib). Disimpan ke alert_dismissals
 * (UNIQUE per alert) — alert hilang dari daftar aktif.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> }
): Promise<NextResponse> {
  const { alertId } = await params;

  const role = await getSessionRole();
  if (role !== "operator") {
    return NextResponse.json({ error: "Hanya operator yang dapat menutup alert." }, { status: 403 });
  }
  const supabaseSSR = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login." }, { status: 401 });
  }

  let body: { note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid." }, { status: 400 });
  }
  const note = body.note?.trim();
  if (!note) {
    return NextResponse.json({ error: "Catatan penutupan wajib diisi." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: alert } = await supabase.from("alerts").select("id").eq("id", alertId).maybeSingle();
  if (!alert) {
    return NextResponse.json({ error: "Alert tidak ditemukan." }, { status: 404 });
  }

  const { error } = await supabase
    .from("alert_dismissals")
    .insert({ alert_id: alertId, operator_id: user.id, note });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Alert ini sudah ditutup." }, { status: 409 });
    }
    console.error(`[/api/alert/${alertId}/dismiss]`, error.message);
    return NextResponse.json({ error: "Gagal menutup alert." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
