/**
 * supabase/seed/triage-seed.ts
 *
 * Dua mode:
 *
 *   1. Default — backfill triage_results untuk SEMUA aduan seed yang belum
 *      punya hasil triase, bukan cuma yang berstatus 'pending'.
 *      supabase/seed/complaints.ts memberi banyak aduan status lanjutan
 *      (triaged/in_progress/ai_verified/needs_review/closed) dengan
 *      effective_category/effective_opd_id yang cuma DISALIN dari
 *      label_manual sebagai placeholder — tanpa baris triage_results
 *      sungguhan, sehingga kartu "Kenapa AI memutuskan ini" di /aduan/[id]
 *      kosong untuk aduan-aduan itu.
 *
 *        npx tsx --env-file=.env.local supabase/seed/triage-seed.ts
 *
 *   2. --retriage-mismatch — triage ULANG hanya aduan seed yang triage_results
 *      terbarunya TIDAK cocok dengan label_manual (mis. setelah prompt
 *      aduin-triage diperbarui di Langflow). Cache ai_cache untuk input yang
 *      sama sengaja dihapus dulu (invalidateCache) sebelum memanggil ulang —
 *      kalau tidak, runTriage() akan diam-diam mengembalikan hasil lama dari
 *      cache karena input (complaint_text/region_name/photo_url) tidak
 *      berubah walau prompt di Langflow sudah berubah.
 *
 *        npx tsx --env-file=.env.local supabase/seed/triage-seed.ts --retriage-mismatch
 *
 * Aturan yang berlaku di KEDUA mode (jangan sampai menyimpang tanpa alasan kuat):
 *  - Aduan berstatus 'triage_failed' selalu dilewati — dipertahankan sebagai
 *    demo state, bukan sesuatu yang di-backfill/di-retriage.
 *  - effective_category/effective_opd_id HANYA diperbarui ke hasil AI jika
 *    aduan itu belum pernah di-override operator (triage_overrides kosong)
 *    — override manual tidak boleh ditimpa.
 *  - Satu-satunya transisi status yang diizinkan: pending -> triaged, dan itu
 *    HANYA terjadi di mode default (backfill). Mode --retriage-mismatch tidak
 *    pernah menyentuh kolom status sama sekali (semua kandidatnya sudah
 *    punya triage_results, jadi statusnya sudah settled).
 *  - TIDAK membuat/mengubah coordination_plans atau tasks — itu tanggung
 *    jawab pipeline live (runTriagePipeline via POST /api/triage/[id]),
 *    bukan skrip seed ini.
 *  - Aman dijalankan berulang kali: mode default re-triage otomatis apa pun
 *    yang masih belum punya triage_results (retry aduan yang gagal di run
 *    sebelumnya); mode --retriage-mismatch selalu menghitung ulang daftar
 *    mismatch dari state DB terkini.
 *
 * Di akhir (kedua mode), mencetak akurasi (total + per kategori + daftar
 * yang tidak cocok) dari SELURUH aduan seed yang punya triage_results,
 * bukan cuma yang baru diproses di run ini.
 */

import { createClient } from "../../src/lib/supabase/client";
import { runTriage, invalidateCache } from "../../src/lib/langflow/client";
import { CATEGORY_SLUGS, type TriageOutput } from "../../src/lib/langflow/schemas";

const CONCURRENCY = 3;

type SupabaseAdminClient = ReturnType<typeof createClient>;

async function main(): Promise<void> {
  const supabase = createClient();
  const retriageMismatch = process.argv.includes("--retriage-mismatch");

  if (retriageMismatch) {
    await runRetriageMismatch(supabase);
  } else {
    await runBackfill(supabase);
  }

  await printAccuracyReport(supabase);
}

// ---------------------------------------------------------------------------
// Mode default — backfill aduan yang belum punya triage_results sama sekali
// ---------------------------------------------------------------------------

interface UntriagedComplaint {
  id: string;
  text: string;
  status: string;
  photoBeforeUrl: string | null;
  regionName: string;
}

async function runBackfill(supabase: SupabaseAdminClient): Promise<void> {
  const queue = await findUntriagedSeedComplaints(supabase);

  if (queue.length === 0) {
    console.log("Semua aduan seed (selain triage_failed) sudah punya triage_results.\n");
    return;
  }

  console.log(`🚀 Men-triage ${queue.length} aduan seed (konkurensi ${CONCURRENCY})...\n`);

  const [opdIdByShortName, overriddenComplaintIds] = await Promise.all([
    fetchOpdIdByShortName(supabase),
    fetchOverriddenComplaintIds(supabase),
  ]);

  let done = 0;
  let failed = 0;

  async function worker(items: UntriagedComplaint[]): Promise<void> {
    for (const item of items) {
      done++;
      const triage = await runTriage({
        complaint_text: item.text,
        region_name: item.regionName,
        photo_url: item.photoBeforeUrl,
      });

      if (!triage) {
        failed++;
        console.log(`  [${done}/${queue.length}] ✗ triase gagal — ${item.id}`);
        continue;
      }

      const opdId = opdIdByShortName.get(triage.opd_short_name);
      if (!opdId) {
        failed++;
        console.log(`  [${done}/${queue.length}] ✗ OPD "${triage.opd_short_name}" tidak ditemukan — ${item.id}`);
        continue;
      }

      const insertErr = await insertTriageResult(supabase, item.id, opdId, triage);
      if (insertErr) {
        failed++;
        console.log(`  [${done}/${queue.length}] ✗ gagal insert triage_results — ${item.id}: ${insertErr}`);
        continue;
      }

      const updatePayload: Record<string, unknown> = {};
      if (!overriddenComplaintIds.has(item.id)) {
        updatePayload.effective_category = triage.category;
        updatePayload.effective_opd_id = opdId;
      }
      if (item.status === "pending") {
        updatePayload.status = "triaged";
      }
      if (Object.keys(updatePayload).length > 0) {
        await supabase.from("complaints").update(updatePayload).eq("id", item.id);
      }

      console.log(`  [${done}/${queue.length}] ✓ ${triage.category} — ${item.id}`);
    }
  }

  const workers: UntriagedComplaint[][] = Array.from({ length: CONCURRENCY }, () => []);
  queue.forEach((item, i) => workers[i % CONCURRENCY].push(item));
  await Promise.all(workers.map((w) => worker(w)));

  console.log(`\n   Diproses run ini: ${done} (gagal: ${failed})`);
}

async function findUntriagedSeedComplaints(supabase: SupabaseAdminClient): Promise<UntriagedComplaint[]> {
  const { data: triageRows, error: triageErr } = await supabase
    .from("triage_results")
    .select("complaint_id");
  if (triageErr) throw new Error(`Gagal membaca triage_results: ${triageErr.message}`);
  const alreadyTriaged = new Set((triageRows ?? []).map((r) => r.complaint_id as string));

  const { data: complaints, error: complaintsErr } = await supabase
    .from("complaints")
    .select("id, text, status, photo_before_url, region:region_id(name)")
    .eq("is_seed", true)
    .neq("status", "triage_failed");
  if (complaintsErr) throw new Error(`Gagal membaca complaints: ${complaintsErr.message}`);

  return (complaints ?? [])
    .filter((c) => !alreadyTriaged.has(c.id as string))
    .map((c) => {
      const region = c.region as unknown as { name: string } | null;
      return {
        id: c.id as string,
        text: c.text as string,
        status: c.status as string,
        photoBeforeUrl: (c.photo_before_url as string | null) ?? null,
        regionName: region?.name ?? "Tidak diketahui",
      };
    });
}

// ---------------------------------------------------------------------------
// Mode --retriage-mismatch — triage ulang aduan yang hasil AI-nya meleset
// ---------------------------------------------------------------------------

async function runRetriageMismatch(supabase: SupabaseAdminClient): Promise<void> {
  const [evaluations, opdIdByShortName, overriddenComplaintIds] = await Promise.all([
    fetchLatestSeedTriageEvaluations(supabase),
    fetchOpdIdByShortName(supabase),
    fetchOverriddenComplaintIds(supabase),
  ]);

  const mismatches = evaluations.filter(
    (e) => e.aiCategory !== e.labelManual && !overriddenComplaintIds.has(e.complaintId)
  );

  if (mismatches.length === 0) {
    console.log("Tidak ada aduan seed yang mismatch (di luar yang di-override) untuk di-retriage.\n");
    return;
  }

  console.log(`🔁 Retriage ${mismatches.length} aduan seed yang mismatch (konkurensi ${CONCURRENCY})...\n`);

  let done = 0;
  let nowMatch = 0;
  let stillMismatch = 0;
  let failed = 0;

  async function worker(items: TriageEvaluation[]): Promise<void> {
    for (const item of items) {
      done++;

      const input = {
        complaint_text: item.text,
        region_name: item.regionName,
        photo_url: item.photoBeforeUrl,
      };

      // Wajib: tanpa ini runTriage() akan diam-diam mengembalikan hasil
      // lama dari ai_cache walau prompt di Langflow sudah diperbarui.
      await invalidateCache("triage", input);
      const triage = await runTriage(input);

      if (!triage) {
        failed++;
        console.log(`  [${done}/${mismatches.length}] ✗ triase ulang gagal — ${item.complaintId}`);
        continue;
      }

      const opdId = opdIdByShortName.get(triage.opd_short_name);
      if (!opdId) {
        failed++;
        console.log(
          `  [${done}/${mismatches.length}] ✗ OPD "${triage.opd_short_name}" tidak ditemukan — ${item.complaintId}`
        );
        continue;
      }

      const insertErr = await insertTriageResult(supabase, item.complaintId, opdId, triage);
      if (insertErr) {
        failed++;
        console.log(`  [${done}/${mismatches.length}] ✗ gagal insert triage_results — ${item.complaintId}: ${insertErr}`);
        continue;
      }

      // Kandidat sudah difilter dari yang punya override, jadi selalu aman
      // diperbarui. Status TIDAK disentuh — lihat aturan di komentar atas file.
      await supabase
        .from("complaints")
        .update({ effective_category: triage.category, effective_opd_id: opdId })
        .eq("id", item.complaintId);

      const isMatchNow = triage.category === item.labelManual;
      if (isMatchNow) nowMatch++;
      else stillMismatch++;

      console.log(
        `  [${done}/${mismatches.length}] ${isMatchNow ? "✓" : "↻"} label_manual: ${item.labelManual} → AI: ${triage.category}` +
          (isMatchNow ? " (sekarang cocok)" : " (masih tidak cocok)") +
          ` — ${item.complaintId}`
      );
    }
  }

  const workers: TriageEvaluation[][] = Array.from({ length: CONCURRENCY }, () => []);
  mismatches.forEach((item, i) => workers[i % CONCURRENCY].push(item));
  await Promise.all(workers.map((w) => worker(w)));

  console.log(
    `\n   Diproses: ${done} — sekarang cocok: ${nowMatch}, masih tidak cocok: ${stillMismatch}, gagal: ${failed}`
  );
}

// ---------------------------------------------------------------------------
// Helper bersama
// ---------------------------------------------------------------------------

async function fetchOpdIdByShortName(supabase: SupabaseAdminClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("opd").select("id, short_name");
  if (error) throw new Error(`Gagal membaca opd: ${error.message}`);
  return new Map((data ?? []).map((o) => [o.short_name as string, o.id as string]));
}

async function fetchOverriddenComplaintIds(supabase: SupabaseAdminClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("triage_overrides").select("complaint_id");
  if (error) throw new Error(`Gagal membaca triage_overrides: ${error.message}`);
  return new Set((data ?? []).map((o) => o.complaint_id as string));
}

async function insertTriageResult(
  supabase: SupabaseAdminClient,
  complaintId: string,
  opdId: string,
  triage: TriageOutput
): Promise<string | null> {
  const { error } = await supabase.from("triage_results").insert({
    complaint_id: complaintId,
    category: triage.category,
    opd_id: opdId,
    urgency: triage.urgency,
    impact: triage.impact,
    handling_path: triage.handling_path,
    reason: triage.reason,
  });
  return error?.message ?? null;
}

// ---------------------------------------------------------------------------
// triage_results terbaru per aduan seed (dipakai oleh laporan akurasi DAN
// mode --retriage-mismatch untuk menentukan kandidat)
// ---------------------------------------------------------------------------

interface TriageEvaluation {
  complaintId: string;
  text: string;
  labelManual: string;
  photoBeforeUrl: string | null;
  regionName: string;
  aiCategory: string;
}

interface RawTriageJoinRow {
  complaint_id: string;
  category: string;
  complaint: {
    text: string;
    label_manual: string | null;
    photo_before_url: string | null;
    is_seed: boolean;
    region: { name: string } | null;
  } | null;
}

async function fetchLatestSeedTriageEvaluations(supabase: SupabaseAdminClient): Promise<TriageEvaluation[]> {
  const { data, error } = await supabase
    .from("triage_results")
    .select(
      "complaint_id, category, created_at, complaint:complaint_id(text, label_manual, photo_before_url, is_seed, region:region_id(name))"
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal membaca triage_results: ${error.message}`);

  // Dedupe per complaint_id, ambil baris terbaru (relevan jika suatu aduan
  // punya >1 baris triage_results, mis. sudah pernah di-retriage).
  const seen = new Set<string>();
  const evaluations: TriageEvaluation[] = [];

  for (const row of (data ?? []) as unknown as RawTriageJoinRow[]) {
    if (seen.has(row.complaint_id)) continue;
    seen.add(row.complaint_id);

    const complaint = row.complaint;
    if (!complaint || !complaint.is_seed || !complaint.label_manual) continue;

    evaluations.push({
      complaintId: row.complaint_id,
      text: complaint.text,
      labelManual: complaint.label_manual,
      photoBeforeUrl: complaint.photo_before_url,
      regionName: complaint.region?.name ?? "Tidak diketahui",
      aiCategory: row.category,
    });
  }

  return evaluations;
}

// ---------------------------------------------------------------------------
// Laporan akurasi
// ---------------------------------------------------------------------------

async function printAccuracyReport(supabase: SupabaseAdminClient): Promise<void> {
  const evaluations = await fetchLatestSeedTriageEvaluations(supabase);

  if (evaluations.length === 0) {
    console.log("\nBelum ada aduan seed dengan triage_results untuk dihitung akurasinya.");
    return;
  }

  let correct = 0;
  const perCategory = new Map<string, { total: number; correct: number }>();
  const mismatches: { text: string; labelManual: string; aiCategory: string }[] = [];

  for (const row of evaluations) {
    const isMatch = row.aiCategory === row.labelManual;
    if (isMatch) correct++;

    const bucket = perCategory.get(row.labelManual) ?? { total: 0, correct: 0 };
    bucket.total++;
    if (isMatch) bucket.correct++;
    perCategory.set(row.labelManual, bucket);

    if (!isMatch) {
      mismatches.push({
        text: row.text.length > 70 ? `${row.text.slice(0, 70)}…` : row.text,
        labelManual: row.labelManual,
        aiCategory: row.aiCategory,
      });
    }
  }

  console.log(`\n📊 Akurasi triage — seluruh aduan seed dengan triage_results (${evaluations.length} aduan):`);
  console.log(`   Total: ${correct}/${evaluations.length} (${((correct / evaluations.length) * 100).toFixed(1)}%)\n`);

  console.log("   Per kategori (label_manual):");
  for (const slug of CATEGORY_SLUGS) {
    const bucket = perCategory.get(slug);
    if (!bucket) continue;
    const pct = ((bucket.correct / bucket.total) * 100).toFixed(1);
    console.log(`     ${slug.padEnd(22)} ${bucket.correct}/${bucket.total} (${pct}%)`);
  }

  if (mismatches.length > 0) {
    console.log(`\n   Aduan yang tidak cocok (${mismatches.length}):`);
    for (const m of mismatches) {
      console.log(`     - "${m.text}" | label_manual: ${m.labelManual} | AI: ${m.aiCategory}`);
    }
  }
}

main().catch((err) => {
  console.error("\n❌ triage-seed gagal:", err);
  process.exitCode = 1;
});
