/**
 * supabase/seed/eval-triage.ts
 *
 * Evaluasi held-out aduin-triage pada supabase/seed/eval/heldout.json —
 * 30 aduan BARU (tidak ada di data seed) dalam bahasa Indonesia informal,
 * Jawa, dan Madura, termasuk beberapa kasus ambigu.
 *
 * - Memanggil flow aduin-triage TANPA cache (runTriage(..., { cache: false }))
 *   sehingga setiap aduan benar-benar dinilai model saat ini.
 * - Tidak menulis apa pun ke database (tidak juga ke ai_cache).
 * - Mencetak akurasi total, akurasi per kategori, dan daftar yang tidak cocok.
 *   Aduan yang gagal ditriage (timeout / output tidak valid) dihitung salah.
 *
 * Jalankan: npx tsx --env-file=.env.local supabase/seed/eval-triage.ts
 */

import { readFileSync } from "fs";
import path from "path";
import { runTriage } from "../../src/lib/langflow/client";
import { CATEGORIES } from "../../src/lib/constants/categories";

const CONCURRENCY = 3;

interface HeldoutItem {
  id: string;
  lang: string;
  region_name: string;
  label: string;
  text: string;
  ambiguous?: boolean;
  note?: string;
}

interface EvalResult {
  item: HeldoutItem;
  predicted: string | null;
  opd: string | null;
}

function label(slug: string | null): string {
  if (!slug) return "(gagal)";
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

async function main(): Promise<void> {
  const file = path.join(process.cwd(), "supabase/seed/eval/heldout.json");
  const { items } = JSON.parse(readFileSync(file, "utf-8")) as { items: HeldoutItem[] };
  console.log(`🧪 Evaluasi held-out aduin-triage — ${items.length} aduan (tanpa cache, tanpa tulis DB)\n`);

  const results: EvalResult[] = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      const out = await runTriage(
        { complaint_text: item.text, region_name: item.region_name, photo_url: null },
        { cache: false }
      );
      results[index] = { item, predicted: out?.category ?? null, opd: out?.opd_short_name ?? null };
      done++;
      process.stdout.write(`\r   ${done}/${items.length} selesai`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write("\n\n");

  const correct = results.filter((r) => r.predicted === r.item.label).length;
  const failed = results.filter((r) => r.predicted === null).length;
  console.log(`🎯 Akurasi total: ${correct}/${results.length} = ${((correct / results.length) * 100).toFixed(1)}%`);
  if (failed > 0) console.log(`   (${failed} aduan gagal ditriage — dihitung salah)`);

  const nonAmbiguous = results.filter((r) => !r.item.ambiguous);
  const correctNonAmb = nonAmbiguous.filter((r) => r.predicted === r.item.label).length;
  console.log(
    `   Tanpa kasus ambigu: ${correctNonAmb}/${nonAmbiguous.length} = ${((correctNonAmb / nonAmbiguous.length) * 100).toFixed(1)}%`
  );

  console.log("\n📊 Per kategori (label benar):");
  for (const c of CATEGORIES) {
    const bucket = results.filter((r) => r.item.label === c.slug);
    if (bucket.length === 0) continue;
    const ok = bucket.filter((r) => r.predicted === c.slug).length;
    console.log(`   ${c.label.padEnd(22)} ${ok}/${bucket.length}`);
  }

  console.log("\n📊 Per bahasa:");
  for (const lang of [...new Set(items.map((i) => i.lang))]) {
    const bucket = results.filter((r) => r.item.lang === lang);
    const ok = bucket.filter((r) => r.predicted === r.item.label).length;
    console.log(`   ${lang.padEnd(22)} ${ok}/${bucket.length}`);
  }

  const mismatches = results.filter((r) => r.predicted !== r.item.label);
  console.log(`\n❌ Tidak cocok (${mismatches.length}):`);
  for (const r of mismatches) {
    console.log(
      `   [${r.item.id}${r.item.ambiguous ? ", ambigu" : ""}, ${r.item.lang}] label=${label(r.item.label)} · AI=${label(r.predicted)}${r.opd ? ` (${r.opd})` : ""}`
    );
    console.log(`      "${r.item.text}"`);
    if (r.item.note) console.log(`      catatan: ${r.item.note}`);
  }
  if (mismatches.length === 0) console.log("   (tidak ada)");
}

main().catch((err) => {
  console.error("\n❌ eval-triage gagal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
