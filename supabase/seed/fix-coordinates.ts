/**
 * supabase/seed/fix-coordinates.ts
 *
 * Memperbarui koordinat data yang SUDAH ADA di database ke tata letak
 * terbaru (supabase/seed/geo.ts + placement.ts) tanpa menghapus apa pun —
 * triage_results, complaint_embeddings, coordination_plans, tasks, ai_cache,
 * dst. tetap utuh.
 *
 * Alur:
 *   1. regions: kecamatan → KECAMATAN_CENTERS; desa → koordinat asli
 *      (DESA_FIXED_COORDS: Bantaran, Karanganyar, Legundi) atau 1–3 km dari
 *      pusat kecamatan (desaCoordinate). Nilai diambil dari REGIONS di
 *      regions.ts sehingga identik dengan seed baru.
 *   2. Aduan seed: seedComplaintCoordinate() — rumus yang sama dengan
 *      complaints.ts (acak deterministik 150–800 m di sekitar desanya;
 *      cluster jalan rusak Bantaran 30–200 m dari Desa Bantaran).
 *   3. Aduan non-seed (dibuat lewat /lapor): digeser kaku mengikuti
 *      perpindahan wilayahnya, sehingga posisinya relatif ke desa tetap.
 *   4. Clustering ulang seluruh aduan (recomputeAllClusters) — lokal, tanpa
 *      Langflow.
 *
 * Idempoten: run kedua tidak mengubah apa pun (semua rumus deterministik).
 *
 * Jalankan: npx tsx --env-file=.env.local supabase/seed/fix-coordinates.ts
 */

import { createClient } from "../../src/lib/supabase/client";
import { recomputeAllClusters } from "../../src/lib/analytics/clustering";
import { REGIONS } from "./regions";
import { seedComplaintCoordinate } from "./placement";

type SupabaseAdminClient = ReturnType<typeof createClient>;

const EPSILON = 1e-9;

function changed(aLat: number | null, aLng: number | null, bLat: number, bLng: number): boolean {
  return aLat === null || aLng === null || Math.abs(aLat - bLat) > EPSILON || Math.abs(aLng - bLng) > EPSILON;
}

async function main(): Promise<void> {
  const supabase = createClient();

  // ---------------------------------------------------------------------
  // 1. regions
  // ---------------------------------------------------------------------
  const { data: dbRegions, error: regionErr } = await supabase.from("regions").select("id, name, lat, lng");
  if (regionErr) throw new Error(`Gagal membaca regions: ${regionErr.message}`);

  const target = new Map(REGIONS.map((r) => [r.id, r]));
  const regionDelta = new Map<string, { dLat: number; dLng: number }>();
  let regionsUpdated = 0;
  const unknownRegions: string[] = [];

  for (const r of dbRegions ?? []) {
    const t = target.get(r.id);
    if (!t) {
      unknownRegions.push(r.name);
      continue;
    }
    if (r.lat !== null && r.lng !== null) {
      regionDelta.set(r.id, { dLat: t.lat - r.lat, dLng: t.lng - r.lng });
    }
    if (!changed(r.lat, r.lng, t.lat, t.lng)) continue;
    const { error } = await supabase.from("regions").update({ lat: t.lat, lng: t.lng }).eq("id", r.id);
    if (error) throw new Error(`Gagal update koordinat ${r.name}: ${error.message}`);
    regionsUpdated++;
  }
  console.log(`📍 regions diperbarui: ${regionsUpdated}`);
  if (unknownRegions.length > 0) {
    console.warn(`⚠️  Wilayah di luar seed dilewati: ${unknownRegions.join(", ")}`);
  }

  // ---------------------------------------------------------------------
  // 2–3. complaints
  // ---------------------------------------------------------------------
  const { data: complaints, error: complaintErr } = await supabase
    .from("complaints")
    .select("id, region_id, lat, lng, is_seed");
  if (complaintErr) throw new Error(`Gagal membaca aduan: ${complaintErr.message}`);

  let seedUpdated = 0;
  let nonSeedUpdated = 0;
  for (const c of complaints ?? []) {
    if (!c.region_id) continue;
    let next: { lat: number; lng: number } | null = null;
    if (c.is_seed) {
      next = seedComplaintCoordinate(c.id, c.region_id);
    } else if (c.lat !== null && c.lng !== null) {
      const delta = regionDelta.get(c.region_id);
      if (delta) next = { lat: c.lat + delta.dLat, lng: c.lng + delta.dLng };
    }
    if (!next || !changed(c.lat, c.lng, next.lat, next.lng)) continue;

    const { error } = await supabase.from("complaints").update({ lat: next.lat, lng: next.lng }).eq("id", c.id);
    if (error) throw new Error(`Gagal update koordinat aduan ${c.id}: ${error.message}`);
    if (c.is_seed) seedUpdated++;
    else nonSeedUpdated++;
  }
  console.log(`📍 aduan diperbarui: ${seedUpdated} seed, ${nonSeedUpdated} non-seed\n`);

  // ---------------------------------------------------------------------
  // 4. Clustering ulang
  // ---------------------------------------------------------------------
  console.log("🔁 Menjalankan clustering ulang untuk seluruh aduan...\n");
  const result = await recomputeAllClusters();
  console.log(
    `   Aduan diproses: ${result.complaintsProcessed} — total cluster terbentuk: ${result.clustersCreated}\n`
  );

  await printClusterSummary(supabase);
}

interface ClusterSummaryRow {
  label: string | null;
  category: string | null;
  member_count: number;
}

async function printClusterSummary(supabase: SupabaseAdminClient): Promise<void> {
  const { data: clusters, error } = await supabase
    .from("clusters")
    .select("label, category, member_count")
    .order("member_count", { ascending: false });

  if (error) {
    console.error("Gagal membaca ringkasan cluster:", error.message);
    return;
  }

  const rows = (clusters ?? []) as ClusterSummaryRow[];

  console.log(`📊 Ringkasan clustering (${rows.length} cluster total):`);
  console.log("   5 cluster terbesar:");
  for (const c of rows.slice(0, 5)) {
    console.log(`     - ${c.label ?? "(tanpa label)"} — ${c.member_count} anggota`);
  }

  const bantaranJalanRusak = rows.find(
    (c) => c.category === "infrastruktur_jalan" && (c.label ?? "").toLowerCase().includes("bantaran")
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
  console.error("\n❌ fix-coordinates gagal:", err);
  process.exitCode = 1;
});
