/**
 * src/app/api/triage/[id]/override/route.ts
 *
 * POST /api/triage/[id]/override
 *
 * Operator-only. Mencatat koreksi manual ke triage_overrides, lalu
 * memperbarui complaints.effective_category / effective_opd_id bila field
 * yang di-override memiliki kolom "effective" (category, opd).
 * handling_path tidak punya kolom effective di complaints (ARCHITECTURE.md
 * §4.3) — override untuk field itu hanya tercatat sebagai audit log.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_SLUGS, OPD_SHORT_NAMES } from "@/lib/langflow/schemas";

const FIELDS = ["category", "opd", "handling_path"] as const;
type OverrideField = (typeof FIELDS)[number];

const HANDLING_PATHS = ["quick_fix", "bertahap", "butuh_data"] as const;

interface OverrideRequestBody {
  field?: string;
  value?: string;
  note?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const role = await getSessionRole();
  if (role !== "operator") {
    return NextResponse.json(
      { error: "Hanya operator yang dapat melakukan override." },
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

  let body: OverrideRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  const field = body.field as OverrideField | undefined;
  const value = body.value?.trim();

  if (!field || !FIELDS.includes(field) || !value) {
    return NextResponse.json({ error: "field dan value wajib diisi." }, { status: 400 });
  }

  if (field === "category" && !CATEGORY_SLUGS.includes(value as (typeof CATEGORY_SLUGS)[number])) {
    return NextResponse.json({ error: `Kategori "${value}" tidak dikenal.` }, { status: 400 });
  }
  if (field === "opd" && !OPD_SHORT_NAMES.includes(value as (typeof OPD_SHORT_NAMES)[number])) {
    return NextResponse.json({ error: `OPD "${value}" tidak dikenal.` }, { status: 400 });
  }
  if (field === "handling_path" && !HANDLING_PATHS.includes(value as (typeof HANDLING_PATHS)[number])) {
    return NextResponse.json({ error: `Jalur penanganan "${value}" tidak dikenal.` }, { status: 400 });
  }

  const supabase = createClient();

  const { data: complaint, error: complaintErr } = await supabase
    .from("complaints")
    .select("effective_category, effective_opd_id, opd:effective_opd_id(short_name)")
    .eq("id", id)
    .single();

  if (complaintErr || !complaint) {
    return NextResponse.json({ error: "Aduan tidak ditemukan." }, { status: 404 });
  }

  let oldValue = "";
  const updatePayload: Record<string, unknown> = {};

  if (field === "category") {
    oldValue = complaint.effective_category ?? "";
    updatePayload.effective_category = value;
  } else if (field === "opd") {
    const opd = complaint.opd as unknown as { short_name: string } | null;
    oldValue = opd?.short_name ?? "";
    const { data: opdRow } = await supabase.from("opd").select("id").eq("short_name", value).single();
    if (!opdRow) {
      return NextResponse.json({ error: `OPD "${value}" tidak ditemukan di database.` }, { status: 400 });
    }
    updatePayload.effective_opd_id = opdRow.id;
  } else {
    const { data: triageResult } = await supabase
      .from("triage_results")
      .select("handling_path")
      .eq("complaint_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    oldValue = triageResult?.handling_path ?? "";
  }

  const { error: overrideErr } = await supabase.from("triage_overrides").insert({
    complaint_id: id,
    operator_id: user.id,
    field_overridden: field,
    old_value: oldValue,
    new_value: value,
    note: body.note?.trim() || null,
  });

  if (overrideErr) {
    console.error(`[/api/triage/${id}/override] Gagal insert triage_overrides:`, overrideErr.message);
    return NextResponse.json({ error: "Gagal menyimpan override." }, { status: 500 });
  }

  if (Object.keys(updatePayload).length > 0) {
    await supabase.from("complaints").update(updatePayload).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
