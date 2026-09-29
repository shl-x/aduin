/**
 * src/lib/services/triage.ts
 *
 * Pipeline triage — satu sumber kebenaran dipakai oleh:
 *   - POST /api/triage/[id]  (dipicu otomatis setelah aduan masuk, atau manual)
 *   - supabase/seed/triage-seed.ts (triase massal aduan seed berstatus pending)
 *
 * Alur (ARCHITECTURE.md §3 & §4.8):
 *   1. Panggil aduin-triage lewat runTriage().
 *   2. Gagal → complaints.status = 'triage_failed'.
 *   3. Sukses → simpan triage_results, isi effective_category/effective_opd_id,
 *      status = 'triaged', buat coordination_plan sederhana (plan_type='simple')
 *      berisi satu task ke effective_opd_id.
 *
 * Embedding (aduin-embed) sengaja belum dipanggil di sini — itu scope M3.
 * LANGFLOW_FLOW_EMBED_ID kosong di M2 sehingga langkah ini dilewati begitu saja
 * (tidak ada kode yang mereferensikannya sampai M3 dibangun).
 */

import { createClient } from "@/lib/supabase/client";
import { runTriage } from "@/lib/langflow/client";
import type { TriageOutput } from "@/lib/langflow/schemas";

export interface TriagePipelineResult {
  status: "triaged" | "triage_failed";
  triage?: TriageOutput;
}

export async function runTriagePipeline(complaintId: string): Promise<TriagePipelineResult> {
  const supabase = createClient();

  const { data: complaint, error: complaintErr } = await supabase
    .from("complaints")
    .select("id, text, photo_before_url, region:region_id(name)")
    .eq("id", complaintId)
    .single();

  if (complaintErr || !complaint) {
    throw new Error(`Aduan ${complaintId} tidak ditemukan: ${complaintErr?.message ?? "unknown"}`);
  }

  const region = complaint.region as unknown as { name: string } | null;
  const regionName = region?.name ?? "Tidak diketahui";

  const triage = await runTriage({
    complaint_text: complaint.text,
    region_name: regionName,
    photo_url: complaint.photo_before_url ?? null,
  });

  if (!triage) {
    await supabase.from("complaints").update({ status: "triage_failed" }).eq("id", complaintId);
    return { status: "triage_failed" };
  }

  const { data: opd } = await supabase
    .from("opd")
    .select("id")
    .eq("short_name", triage.opd_short_name)
    .single();

  if (!opd) {
    // Tidak seharusnya terjadi — semua OPD di OPD_SHORT_NAMES sudah di-seed.
    console.error(
      `[triage] OPD "${triage.opd_short_name}" tidak ditemukan di tabel opd untuk aduan ${complaintId}`
    );
    await supabase.from("complaints").update({ status: "triage_failed" }).eq("id", complaintId);
    return { status: "triage_failed" };
  }

  await supabase.from("triage_results").insert({
    complaint_id: complaintId,
    category: triage.category,
    opd_id: opd.id,
    urgency: triage.urgency,
    impact: triage.impact,
    handling_path: triage.handling_path,
    reason: triage.reason,
  });

  await supabase
    .from("complaints")
    .update({
      status: "triaged",
      effective_category: triage.category,
      effective_opd_id: opd.id,
    })
    .eq("id", complaintId);

  await createSimpleCoordinationPlan(supabase, complaintId, opd.id, triage);

  return { status: "triaged", triage };
}

/**
 * Membuat (atau mengganti) rencana koordinasi sederhana: satu task ke OPD
 * tujuan. Idempotent — aman dipanggil ulang saat operator re-triage manual
 * setelah kegagalan sebelumnya (ARCHITECTURE.md §3: triage_failed → triaged).
 */
async function createSimpleCoordinationPlan(
  supabase: ReturnType<typeof createClient>,
  complaintId: string,
  opdId: string,
  triage: TriageOutput
): Promise<void> {
  const { data: existingPlan } = await supabase
    .from("coordination_plans")
    .select("id")
    .eq("complaint_id", complaintId)
    .maybeSingle();

  if (existingPlan) {
    await supabase.from("tasks").delete().eq("plan_id", existingPlan.id);
  }

  const { data: plan, error: planErr } = await supabase
    .from("coordination_plans")
    .upsert(
      { complaint_id: complaintId, plan_type: "simple", summary: null, raw_response: null },
      { onConflict: "complaint_id" }
    )
    .select("id")
    .single();

  if (planErr || !plan) {
    console.error(`[triage] Gagal membuat coordination_plan untuk aduan ${complaintId}:`, planErr?.message);
    return;
  }

  await supabase.from("tasks").insert({
    plan_id: plan.id,
    opd_id: opdId,
    title: "Tindak lanjuti aduan",
    description: triage.reason,
    sequence: 1,
  });
}
