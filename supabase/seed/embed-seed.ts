/**
 * supabase/seed/embed-seed.ts
 *
 * 1. Membuat embedding (aduin-embed) untuk semua aduan seed yang belum
 *    punya baris di complaint_embeddings (konkurensi 3, idempoten — aman
 *    dijalankan berulang kali karena hanya memproses yang belum punya
 *    embedding, dan upsert onConflict complaint_id).
 * 2. Menjalankan recomputeAllClusters() untuk SELURUH aduan (bukan cuma
 *    seed) supaya cluster konsisten dengan seluruh data di DB.
 * 3. Mencetak ringkasan: jumlah cluster, 5 cluster terbesar (label +
 *    jumlah anggota), dan apakah cluster "jalan rusak Bantaran" terbentuk.
 *
 * Jalankan: npx tsx --env-file=.env.local supabase/seed/embed-seed.ts
 */

import { createClient } from "../../src/lib/supabase/client";
import { runEmbed } from "../../src/lib/langflow/client";
import { recomputeAllClusters } from "../../src/lib/analytics/clustering";

const CONCURRENCY = 3;

type SupabaseAdminClient = ReturnType<typeof createClient>;

interface UnembeddedComplaint {
  id: string;
  text: string;
}

async function main(): Promise<void> {
  const supabase = createClient();

  await embedMissingSeedComplaints(supabase);
  await recomputeAndSummarize(supabase);
}

// ---------------------------------------------------------------------------
// 1. Embed aduan seed yang belum punya complaint_embeddings
// ---------------------------------------------------------------------------

async function embedMissingSeedComplaints(supabase: SupabaseAdminClient): Promise<void> {
  const queue = await findUnembeddedSeedComplaints(supabase);

  if (queue.length === 0) {
    console.log("Semua aduan seed sudah punya embedding.\n");
    return;
  }

  console.log(`🚀 Membuat embedding untuk ${queue.length} aduan seed (konkurensi ${CONCURRENCY})...\n`);

  let done = 0;
  let failed = 0;

  async function worker(items: UnembeddedComplaint[]): Promise<void> {
    for (const item of items) {
      done++;
      const embed = await runEmbed({ complaint_text: item.text });

      if (!embed) {
        failed++;
        console.log(`  [${done}/${queue.length}] ✗ embedding gagal — ${item.id}`);
        continue;
      }

      const { error } = await supabase.from("complaint_embeddings").upsert(
        { complaint_id: item.id, embedding: embed.embedding, model_version: embed.model_version },
        { onConflict: "complaint_id" }
      );

      if (error) {
        failed++;
        console.log(`  [${done}/${queue.length}] ✗ gagal simpan embedding — ${item.id}: ${error.message}`);
        continue;
      }

      console.log(`  [${done}/${queue.length}] ✓ ${embed.embedding.length}d — ${item.id}`);
    }
  }

  const workers: UnembeddedComplaint[][] = Array.from({ length: CONCURRENCY }, () => []);
  queue.forEach((item, i) => workers[i % CONCURRENCY].push(item));
  await Promise.all(workers.map((w) => worker(w)));

  console.log(`\n   Diproses run ini: ${done} (gagal: ${failed})`);
}

async function findUnembeddedSeedComplaints(supabase: SupabaseAdminClient): Promise<UnembeddedComplaint[]> {
  const { data: embeddedRows, error: embeddedErr } = await supabase
    .from("complaint_embeddings")
    .select("complaint_id");
  if (embeddedErr) throw new Error(`Gagal membaca complaint_embeddings: ${embeddedErr.message}`);
  const alreadyEmbedded = new Set((embeddedRows ?? []).map((r) => r.complaint_id as string));

  const { data: complaints, error: complaintsErr } = await supabase
    .from("complaints")
    .select("id, text")
    .eq("is_seed", true);
  if (complaintsErr) throw new Error(`Gagal membaca complaints: ${complaintsErr.message}`);

  return (complaints ?? [])
    .filter((c) => !alreadyEmbedded.has(c.id as string))
    .map((c) => ({ id: c.id as string, text: c.text as string }));
}

// ---------------------------------------------------------------------------
// 2 & 3. Recompute cluster untuk seluruh aduan + cetak ringkasan
// ---------------------------------------------------------------------------

interface ClusterSummaryRow {
  id: string;
  label: string | null;
  category: string | null;
  member_count: number;
  region_id: string | null;
}

async function recomputeAndSummarize(supabase: SupabaseAdminClient): Promise<void> {
  console.log("🔁 Menjalankan clustering ulang untuk seluruh aduan...\n");
  const result = await recomputeAllClusters();
  console.log(
    `   Aduan diproses: ${result.complaintsProcessed} — total cluster terbentuk: ${result.clustersCreated}\n`
  );

  const { data: clusters, error } = await supabase
    .from("clusters")
    .select("id, label, category, member_count, region_id")
    .order("member_count", { ascending: false });

  if (error) {
    console.error("Gagal membaca ringkasan cluster:", error.message);
    return;
  }

  const rows = (clusters ?? []) as ClusterSummaryRow[];

  console.log(`📊 Ringkasan clustering (${rows.length} cluster total):\n`);
  console.log("   5 cluster terbesar:");
  for (const c of rows.slice(0, 5)) {
    console.log(`     - ${c.label ?? "(tanpa label)"} — ${c.member_count} anggota`);
  }

  const bantaranJalanRusak = rows.find(
    (c) =>
      c.category === "infrastruktur_jalan" &&
      (c.label ?? "").toLowerCase().includes("bantaran")
  );

  console.log("");
  if (bantaranJalanRusak && bantaranJalanRusak.member_count >= 6) {
    console.log(
      `✅ Cluster jalan rusak Bantaran TERBENTUK: "${bantaranJalanRusak.label}" (${bantaranJalanRusak.member_count} anggota)`
    );
  } else if (bantaranJalanRusak) {
    console.log(
      `⚠️  Ada cluster jalan rusak di Bantaran tapi anggotanya baru ${bantaranJalanRusak.member_count} (target ≥ 6): "${bantaranJalanRusak.label}"`
    );
  } else {
    console.log("❌ Cluster jalan rusak Bantaran BELUM terbentuk.");
  }
}

main().catch((err) => {
  console.error("\n❌ embed-seed gagal:", err);
  process.exitCode = 1;
});
