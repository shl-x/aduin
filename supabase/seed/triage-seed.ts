/**
 * supabase/seed/triage-seed.ts
 *
 * Backfill triage_results untuk SEMUA aduan seed yang belum punya hasil
 * triase — bukan cuma yang berstatus 'pending'. supabase/seed/complaints.ts
 * memberi banyak aduan status lanjutan (triaged/in_progress/ai_verified/
 * needs_review/closed) dengan effective_category/effective_opd_id yang
 * cuma DISALIN dari label_manual sebagai placeholder (lihat komentar di
 * complaints.ts) — tanpa baris triage_results sungguhan, sehingga kartu
 * "Kenapa AI memutuskan ini" di /aduan/[id] kosong untuk aduan-aduan itu.
 *
 * Aturan (jangan sampai menyimpang tanpa alasan kuat):
 *  - Target: is_seed = true, status != 'triage_failed', DAN belum punya
 *    baris triage_results. Status 'triage_failed' sengaja dilewati —
 *    dipertahankan sebagai demo state, bukan sesuatu yang di-backfill.
 *  - Sukses -> insert triage_results. effective_category/effective_opd_id
 *    HANYA diperbarui ke hasil AI jika aduan itu belum pernah di-override
 *    operator (triage_overrides kosong) — override manual tidak boleh
 *    ditimpa oleh backfill.
 *  - Satu-satunya transisi status yang diizinkan: pending -> triaged (saat
 *    sukses). Status lain (triaged/in_progress/ai_verified/needs_review/
 *    closed) TIDAK disentuh sama sekali.
 *  - TIDAK membuat/mengubah coordination_plans atau tasks — itu tanggung
 *    jawab pipeline live (runTriagePipeline via POST /api/triage/[id]),
 *    bukan skrip backfill seed ini.
 *  - Idempotent: re-run hanya memproses aduan yang masih belum punya
 *    triage_results, jadi otomatis retry untuk yang gagal di run
 *    sebelumnya tanpa menghasilkan baris duplikat.
 *
 * Di akhir, mencetak akurasi (total + per kategori) dari SELURUH aduan seed
 * yang sudah punya triage_results dibanding label_manual — bukan cuma yang
 * baru diproses di run ini — plus daftar aduan yang tidak cocok.
 *
 * Jalankan (Langflow lokal harus berjalan):
 *   npx tsx --env-file=.env.local supabase/seed/triage-seed.ts
 */

import { createClient } from "../../src/lib/supabase/client";
import { runTriage } from "../../src/lib/langflow/client";
import { CATEGORY_SLUGS } from "../../src/lib/langflow/schemas";

const CONCURRENCY = 3;

type SupabaseAdminClient = ReturnType<typeof createClient>;

interface SeedComplaint {
  id: string;
  text: string;
  status: string;
  photoBeforeUrl: string | null;
  regionName: string;
}

async function main(): Promise<void> {
  const supabase = createClient();

  const queue = await findUntriagedSeedComplaints(supabase);

  if (queue.length === 0) {
    console.log("Semua aduan seed (selain triage_failed) sudah punya triage_results.\n");
  } else {
    console.log(`🚀 Men-triage ${queue.length} aduan seed (konkurensi ${CONCURRENCY})...\n`);

    const [opdIdByShortName, overriddenComplaintIds] = await Promise.all([
      fetchOpdIdByShortName(supabase),
      fetchOverriddenComplaintIds(supabase),
    ]);

    let done = 0;
    let failed = 0;

    async function worker(items: SeedComplaint[]): Promise<void> {
      for (const item of items) {
        done++;
        const outcome = await processComplaint(supabase, item, opdIdByShortName, overriddenComplaintIds);
        if (!outcome.ok) {
          failed++;
          console.log(`  [${done}/${queue.length}] ✗ ${outcome.reason} — ${item.id}`);
        } else {
          console.log(`  [${done}/${queue.length}] ✓ ${outcome.category} — ${item.id}`);
        }
      }
    }

    const workers: SeedComplaint[][] = Array.from({ length: CONCURRENCY }, () => []);
    queue.forEach((item, i) => workers[i % CONCURRENCY].push(item));
    await Promise.all(workers.map((w) => worker(w)));

    console.log(`\n   Diproses run ini: ${done} (gagal: ${failed})`);
  }

  await printAccuracyReport(supabase);
}

// ---------------------------------------------------------------------------
// Pemilihan target
// ---------------------------------------------------------------------------

async function findUntriagedSeedComplaints(supabase: SupabaseAdminClient): Promise<SeedComplaint[]> {
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

// ---------------------------------------------------------------------------
// Pemrosesan satu aduan
// ---------------------------------------------------------------------------

type ProcessOutcome = { ok: true; category: string } | { ok: false; reason: string };

async function processComplaint(
  supabase: SupabaseAdminClient,
  item: SeedComplaint,
  opdIdByShortName: Map<string, string>,
  overriddenComplaintIds: Set<string>
): Promise<ProcessOutcome> {
  const triage = await runTriage({
    complaint_text: item.text,
    region_name: item.regionName,
    photo_url: item.photoBeforeUrl,
  });

  if (!triage) {
    return { ok: false, reason: "triase gagal (Langflow timeout/error/Zod invalid)" };
  }

  const opdId = opdIdByShortName.get(triage.opd_short_name);
  if (!opdId) {
    return { ok: false, reason: `OPD "${triage.opd_short_name}" tidak ditemukan di tabel opd` };
  }

  const { error: insertErr } = await supabase.from("triage_results").insert({
    complaint_id: item.id,
    category: triage.category,
    opd_id: opdId,
    urgency: triage.urgency,
    impact: triage.impact,
    handling_path: triage.handling_path,
    reason: triage.reason,
  });
  if (insertErr) {
    return { ok: false, reason: `gagal insert triage_results: ${insertErr.message}` };
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

  return { ok: true, category: triage.category };
}

// ---------------------------------------------------------------------------
// Laporan akurasi
// ---------------------------------------------------------------------------

interface AccuracyRow {
  complaint_id: string;
  category: string;
  complaint: { text: string; label_manual: string | null; is_seed: boolean } | null;
}

async function printAccuracyReport(supabase: SupabaseAdminClient): Promise<void> {
  const { data, error } = await supabase
    .from("triage_results")
    .select("complaint_id, category, created_at, complaint:complaint_id(text, label_manual, is_seed)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal menghitung akurasi:", error.message);
    return;
  }

  // Dedupe per complaint_id, ambil baris terbaru (relevan jika suatu aduan
  // pernah di-re-triage manual dan punya >1 baris triage_results).
  const seen = new Set<string>();
  const evaluated: { text: string; labelManual: string; aiCategory: string }[] = [];

  for (const row of (data ?? []) as unknown as AccuracyRow[]) {
    if (seen.has(row.complaint_id)) continue;
    seen.add(row.complaint_id);

    const complaint = row.complaint;
    if (!complaint || !complaint.is_seed || !complaint.label_manual) continue;

    evaluated.push({
      text: complaint.text,
      labelManual: complaint.label_manual,
      aiCategory: row.category,
    });
  }

  if (evaluated.length === 0) {
    console.log("\nBelum ada aduan seed dengan triage_results untuk dihitung akurasinya.");
    return;
  }

  let correct = 0;
  const perCategory = new Map<string, { total: number; correct: number }>();
  const mismatches: { text: string; labelManual: string; aiCategory: string }[] = [];

  for (const row of evaluated) {
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

  console.log(`\n📊 Akurasi triage — seluruh aduan seed dengan triage_results (${evaluated.length} aduan):`);
  console.log(`   Total: ${correct}/${evaluated.length} (${((correct / evaluated.length) * 100).toFixed(1)}%)\n`);

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
