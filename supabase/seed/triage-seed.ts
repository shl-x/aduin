/**
 * supabase/seed/triage-seed.ts
 *
 * Men-triage semua aduan seed berstatus 'pending' lewat pipeline AI
 * sungguhan (runTriagePipeline — sama seperti yang dipakai POST /api/triage/[id]),
 * dengan konkurensi maksimal 3. Di akhir mencetak akurasi kategori hasil AI
 * dibanding label_manual.
 *
 * Jalankan (Langflow lokal harus berjalan):
 *   npx tsx --env-file=.env.local supabase/seed/triage-seed.ts
 */

import { createClient } from "../../src/lib/supabase/client";
import { runTriagePipeline } from "../../src/lib/services/triage";

const CONCURRENCY = 3;

interface PendingComplaint {
  id: string;
  label_manual: string | null;
}

async function main(): Promise<void> {
  const supabase = createClient();

  const { data: complaints, error } = await supabase
    .from("complaints")
    .select("id, label_manual")
    .eq("is_seed", true)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Gagal mengambil aduan pending: ${error.message}`);
  }

  const queue: PendingComplaint[] = complaints ?? [];
  if (queue.length === 0) {
    console.log("Tidak ada aduan seed berstatus pending — tidak ada yang perlu di-triage.");
    return;
  }

  console.log(`🚀 Men-triage ${queue.length} aduan seed (konkurensi ${CONCURRENCY})...\n`);

  let done = 0;
  let correct = 0;
  let failed = 0;

  async function worker(items: PendingComplaint[]): Promise<void> {
    for (const item of items) {
      try {
        const result = await runTriagePipeline(item.id);
        done++;
        if (result.status === "triage_failed" || !result.triage) {
          failed++;
          console.log(`  [${done}/${queue.length}] ✗ triase gagal — ${item.id}`);
          continue;
        }
        const match = result.triage.category === item.label_manual;
        if (match) correct++;
        console.log(
          `  [${done}/${queue.length}] ✓ ${result.triage.category}` +
            (match ? " (cocok)" : ` (label_manual: ${item.label_manual})`)
        );
      } catch (err) {
        done++;
        failed++;
        console.log(
          `  [${done}/${queue.length}] ✗ error — ${item.id}: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  // Bagi antrian ke N worker (round-robin) — batas konkurensi = jumlah worker.
  const workers: PendingComplaint[][] = Array.from({ length: CONCURRENCY }, () => []);
  queue.forEach((item, i) => workers[i % CONCURRENCY].push(item));

  await Promise.all(workers.map((w) => worker(w)));

  const triaged = done - failed;
  const accuracyPct = triaged > 0 ? ((correct / triaged) * 100).toFixed(1) : "0.0";

  console.log("\n📊 Ringkasan triage-seed:");
  console.log(`   Total diproses  : ${done}`);
  console.log(`   Berhasil triase : ${triaged}`);
  console.log(`   Gagal triase    : ${failed}`);
  console.log(`   Akurasi kategori vs label_manual: ${accuracyPct}% (${correct}/${triaged})`);
}

main().catch((err) => {
  console.error("\n❌ triage-seed gagal:", err);
  process.exitCode = 1;
});
