/**
 * supabase/seed/precompute-ai.ts
 *
 * Mengekspor hasil AI seluruh aduan seed dari database ke
 * supabase/seed/ai-cache-snapshot.json — TANPA memanggil Langflow. Jalankan
 * setelah triage-seed.ts dan embed-seed.ts selesai (database sudah berisi
 * hasil AI sungguhan), lalu commit file snapshot-nya.
 *
 * Isi snapshot (lihat snapshot.ts):
 *   - triage_results terbaru per aduan seed
 *   - complaint_embeddings aduan seed
 *   - ai_cache flow clarify/triage/embed/opd-agent/alert-summary
 *
 * Di akhir, mencetak akurasi triage seed (kategori AI vs label_manual) —
 * target ≥ 80%.
 *
 * Jalankan: npx tsx --env-file=.env.local supabase/seed/precompute-ai.ts
 */

import { writeFileSync } from "fs";
import { createClient } from "../../src/lib/supabase/client";
import { CATEGORIES } from "../../src/lib/constants/categories";
import {
  SNAPSHOT_FLOWS,
  snapshotPath,
  type AiSnapshot,
  type SnapshotCacheEntry,
  type SnapshotEmbedding,
  type SnapshotTriage,
} from "./snapshot";

type AdminClient = ReturnType<typeof createClient>;
const PAGE = 500;

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = PAGE
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

/** JSON satu record per baris — ringkas tapi tetap bisa di-diff. */
function serialize(snapshot: AiSnapshot): string {
  const list = (items: unknown[]) =>
    items.length === 0 ? "[]" : `[\n${items.map((i) => "  " + JSON.stringify(i)).join(",\n")}\n]`;
  return (
    "{\n" +
    `"version": ${snapshot.version},\n` +
    `"generated_at": ${JSON.stringify(snapshot.generated_at)},\n` +
    `"counts": ${JSON.stringify(snapshot.counts)},\n` +
    `"triage_results": ${list(snapshot.triage_results)},\n` +
    `"embeddings": ${list(snapshot.embeddings)},\n` +
    `"ai_cache": ${list(snapshot.ai_cache)}\n` +
    "}\n"
  );
}

async function main(): Promise<void> {
  const supabase: AdminClient = createClient();

  const seeds = await fetchAll<{ id: string; label_manual: string | null }>((from, to) =>
    supabase.from("complaints").select("id, label_manual").eq("is_seed", true).order("id").range(from, to)
  );
  const seedIds = seeds.map((s) => s.id);
  console.log(`📦 Aduan seed: ${seedIds.length}`);
  if (seedIds.length === 0) throw new Error("Tidak ada aduan seed. Jalankan seed + triage-seed dulu.");

  // triage_results terbaru per aduan
  const triageRows = await fetchAll<SnapshotTriage & { created_at: string }>((from, to) =>
    supabase
      .from("triage_results")
      .select("complaint_id, category, opd_id, urgency, impact, handling_path, reason, raw_response, created_at")
      .in("complaint_id", seedIds)
      .order("created_at", { ascending: false })
      .range(from, to)
  );
  const latestTriage = new Map<string, SnapshotTriage>();
  for (const row of triageRows) {
    if (latestTriage.has(row.complaint_id)) continue;
    latestTriage.set(row.complaint_id, {
      complaint_id: row.complaint_id,
      category: row.category,
      opd_id: row.opd_id,
      urgency: row.urgency,
      impact: row.impact,
      handling_path: row.handling_path,
      reason: row.reason,
      raw_response: row.raw_response,
    });
  }

  const embeddings = await fetchAll<SnapshotEmbedding>(
    (from, to) =>
      supabase
        .from("complaint_embeddings")
        .select("complaint_id, embedding, model_version")
        .in("complaint_id", seedIds)
        .order("complaint_id")
        .range(from, to),
    100
  );

  const cache = await fetchAll<SnapshotCacheEntry>(
    (from, to) =>
      supabase
        .from("ai_cache")
        .select("flow_name, input_hash, output")
        .in("flow_name", [...SNAPSHOT_FLOWS])
        .order("flow_name")
        .order("input_hash")
        .range(from, to),
    100
  );

  const triage = [...latestTriage.values()].sort((a, b) => a.complaint_id.localeCompare(b.complaint_id));
  const snapshot: AiSnapshot = {
    version: 1,
    generated_at: new Date().toISOString(),
    counts: { triage_results: triage.length, embeddings: embeddings.length, ai_cache: cache.length },
    triage_results: triage,
    embeddings,
    ai_cache: cache,
  };

  writeFileSync(snapshotPath(), serialize(snapshot), "utf-8");
  console.log(
    `✅ Snapshot ditulis ke ${snapshotPath()}\n   triage_results: ${triage.length}, embeddings: ${embeddings.length}, ai_cache: ${cache.length}`
  );
  const missingTriage = seedIds.length - triage.length;
  const missingEmbed = seedIds.length - embeddings.length;
  if (missingTriage > 0 || missingEmbed > 0) {
    console.warn(
      `⚠️  ${missingTriage} aduan seed tanpa triage (termasuk yang sengaja triage_failed), ${missingEmbed} tanpa embedding.`
    );
  }

  // Akurasi triage seed vs label_manual
  const label = new Map(seeds.map((s) => [s.id, s.label_manual]));
  const perCategory = new Map<string, { total: number; correct: number }>();
  let correct = 0;
  for (const t of triage) {
    const expected = label.get(t.complaint_id);
    if (!expected) continue;
    const bucket = perCategory.get(expected) ?? { total: 0, correct: 0 };
    bucket.total++;
    if (t.category === expected) {
      bucket.correct++;
      correct++;
    }
    perCategory.set(expected, bucket);
  }
  const evaluated = [...perCategory.values()].reduce((s, b) => s + b.total, 0);
  const pct = evaluated === 0 ? 0 : (correct / evaluated) * 100;
  console.log(`\n🎯 Akurasi triage seed: ${correct}/${evaluated} = ${pct.toFixed(1)}% (target ≥ 80%)`);
  for (const c of CATEGORIES) {
    const b = perCategory.get(c.slug);
    if (b) console.log(`   ${c.label.padEnd(22)} ${b.correct}/${b.total}`);
  }
  if (pct < 80) process.exitCode = 2;
}

main().catch((err) => {
  console.error("\n❌ precompute-ai gagal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
