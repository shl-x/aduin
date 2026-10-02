/**
 * src/app/api/coordination/[id]/route.ts
 *
 * POST /api/coordination/[id]
 *
 * Operator-only. Memanggil aduin-opd-agent dengan teks aduan, nama wilayah,
 * dan triage efektif (memperhitungkan override), lalu mengganti rencana
 * koordinasi aduan secara atomik lewat fungsi Postgres
 * replace_coordination_plan (supabase/migrations/0003_coordination_rpc.sql).
 *
 * Jika flow gagal / output tidak lolos Zod / RPC gagal, rencana lama tidak
 * tersentuh (docs/LANGFLOW_FLOWS.md §Flow 4 — Fallback).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { runOpdAgent } from "@/lib/langflow/client";
import { getCoordinationPlan, getEffectiveTriage } from "@/lib/services/coordination";

const GENERIC_ERROR = "Gagal membuat rencana koordinasi. Silakan coba lagi.";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const role = await getSessionRole();
  if (role !== "operator") {
    return NextResponse.json(
      { error: "Hanya operator yang dapat membuat rencana koordinasi." },
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

  const supabase = createClient();

  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, text, status, region:region_id(name)")
    .eq("id", id)
    .maybeSingle();

  if (!complaint) {
    return NextResponse.json({ error: "Aduan tidak ditemukan." }, { status: 404 });
  }

  if (complaint.status !== "triaged") {
    return NextResponse.json(
      { error: "Rencana koordinasi hanya bisa dibuat untuk aduan berstatus 'Sudah Ditriase'." },
      { status: 409 }
    );
  }

  // Jangan hapus progres petugas: jika ada tugas yang sudah dimulai,
  // mengganti rencana akan menghilangkan status tugas tersebut.
  let existingPlan;
  try {
    existingPlan = await getCoordinationPlan(supabase, id);
  } catch (err) {
    console.error(`[/api/coordination/${id}]`, err);
    return NextResponse.json({ error: "Gagal memuat rencana yang ada." }, { status: 500 });
  }
  if (existingPlan?.tasks.some((t) => t.status !== "belum_mulai")) {
    return NextResponse.json(
      { error: "Rencana tidak bisa diganti karena sudah ada tugas yang dimulai petugas OPD." },
      { status: 409 }
    );
  }

  const triage = await getEffectiveTriage(supabase, id);
  if (!triage) {
    return NextResponse.json(
      { error: "Aduan belum memiliki hasil triase — jalankan triage terlebih dahulu." },
      { status: 422 }
    );
  }

  const region = complaint.region as unknown as { name: string } | null;
  const result = await runOpdAgent({
    complaint_text: complaint.text,
    region_name: region?.name ?? "Tidak diketahui",
    triage,
  });

  if (!result.ok) {
    return NextResponse.json({ error: GENERIC_ERROR, detail: result.error }, { status: 502 });
  }

  const { error: rpcErr } = await supabase.rpc("replace_coordination_plan", {
    p_complaint_id: id,
    p_summary: result.data.summary,
    p_raw_response: result.data,
    p_created_by: user.id,
    p_tasks: result.data.tasks,
  });

  if (rpcErr) {
    console.error(`[/api/coordination/${id}] replace_coordination_plan gagal:`, rpcErr.message);
    const missingFn = rpcErr.code === "PGRST202" || rpcErr.message.includes("replace_coordination_plan");
    return NextResponse.json(
      {
        error: missingFn
          ? "Fungsi database replace_coordination_plan belum tersedia. Terapkan migrasi supabase/migrations/0003_coordination_rpc.sql."
          : GENERIC_ERROR,
        detail: rpcErr.message,
      },
      { status: 500 }
    );
  }

  const plan = await getCoordinationPlan(supabase, id).catch(() => null);
  return NextResponse.json({ ok: true, plan });
}
