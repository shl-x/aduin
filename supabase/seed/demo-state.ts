/**
 * supabase/seed/demo-state.ts
 *
 * Satu alur untuk membangun keadaan demo dari nol — dipakai oleh seed utama
 * (supabase/seed/index.ts) dan tombol "Reset Demo" (POST /api/seed/reset):
 *
 *   1. regions, OPD, akun demo (upsert — akun TIDAK dihapus, sehingga sesi
 *      operator yang menekan Reset Demo tetap valid)
 *   2. hapus semua alert, semua aduan (non-seed dari latihan + seed lama;
 *      turunannya ikut terhapus lewat ON DELETE CASCADE), dan semua cluster
 *   3. tulis ulang aduan seed dari complaints.ts (koordinat & timestamp baru)
 *   4. pulihkan hasil AI dari ai-cache-snapshot.json + rencana sederhana
 *   5. clustering ulang (lokal, tanpa Langflow)
 *   6. refreshDemoTimeline(): geser timeline + early warning (alert diare
 *      Sumberasih; ringkasannya diambil dari ai_cache snapshot jika inputnya
 *      sama, selain itu Langflow, dan jika gagal 'pending_retry')
 *
 * ai_cache tidak dihapus (entri latihan tetap berguna sebagai cache);
 * foto di Storage juga tidak dihapus.
 */

import { createClient } from "../../src/lib/supabase/client";
import { recomputeAllClusters } from "../../src/lib/analytics/clustering";
import { refreshDemoTimeline, type RefreshTimelineReport } from "../../src/lib/demo/refresh-timeline";
import { seedRegions } from "./regions";
import { seedOpd } from "./opd";
import { seedAccounts } from "./accounts";
import { buildComplaints } from "./complaints";
import { applySnapshot, readSnapshot, type ApplySnapshotResult, type AiSnapshot } from "./snapshot";

export interface DemoStateResult {
  seededComplaints: number;
  deletedNonSeedComplaints: number;
  snapshotFound: boolean;
  snapshot: ApplySnapshotResult;
  clusters: number;
  timeline: RefreshTimelineReport;
}

const EMPTY_SNAPSHOT: AiSnapshot = {
  version: 1,
  generated_at: "",
  counts: { triage_results: 0, embeddings: 0, ai_cache: 0 },
  triage_results: [],
  embeddings: [],
  ai_cache: [],
};

/** Pembanding "selalu benar" untuk DELETE tanpa filter (PostgREST mewajibkan filter). */
const ALL_ROWS = "1970-01-01T00:00:00Z";

export async function buildDemoState(
  options: { syncPasswords?: boolean; log?: (msg: string) => void } = {}
): Promise<DemoStateResult> {
  const log = options.log ?? (() => {});
  const supabase = createClient();

  log("1/6 Wilayah, OPD, akun demo…");
  await seedRegions();
  await seedOpd();
  await seedAccounts({ syncPasswords: options.syncPasswords });

  log("2/6 Menghapus alert, aduan, dan cluster lama…");
  const { error: alertErr } = await supabase.from("alerts").delete().gte("created_at", ALL_ROWS);
  if (alertErr) throw new Error(`Gagal menghapus alert: ${alertErr.message}`);

  const { data: nonSeed, error: nonSeedErr } = await supabase
    .from("complaints")
    .delete()
    .eq("is_seed", false)
    .select("id");
  if (nonSeedErr) throw new Error(`Gagal menghapus aduan latihan: ${nonSeedErr.message}`);

  const { error: seedDelErr } = await supabase.from("complaints").delete().eq("is_seed", true);
  if (seedDelErr) throw new Error(`Gagal menghapus aduan seed lama: ${seedDelErr.message}`);

  const { error: clusterErr } = await supabase.from("clusters").delete().gte("created_at", ALL_ROWS);
  if (clusterErr) throw new Error(`Gagal menghapus cluster: ${clusterErr.message}`);

  log("3/6 Menulis ulang aduan seed…");
  const rows = buildComplaints();
  const { error: insertErr } = await supabase.from("complaints").insert(rows);
  if (insertErr) throw new Error(`Gagal menulis aduan seed: ${insertErr.message}`);

  log("4/6 Memulihkan hasil AI dari snapshot…");
  const snapshot = readSnapshot();
  if (!snapshot) {
    log("   ⚠️  ai-cache-snapshot.json belum ada — aduan seed tanpa hasil AI (jalankan precompute-ai.ts).");
  }
  const snapshotResult = await applySnapshot(supabase, snapshot ?? EMPTY_SNAPSHOT, rows);

  log("5/6 Clustering ulang…");
  const clusterResult = await recomputeAllClusters();

  log("6/6 Menyegarkan timeline + early warning…");
  const timeline = await refreshDemoTimeline(supabase);

  return {
    seededComplaints: rows.length,
    deletedNonSeedComplaints: nonSeed?.length ?? 0,
    snapshotFound: snapshot !== null,
    snapshot: snapshotResult,
    clusters: clusterResult.clustersCreated,
    timeline,
  };
}
