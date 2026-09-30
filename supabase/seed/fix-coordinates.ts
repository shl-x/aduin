/**
 * supabase/seed/fix-coordinates.ts
 *
 * Perbaikan koordinat untuk data yang SUDAH ADA di database (tidak menghapus
 * apa pun — triage_results, complaint_embeddings, coordination_plans, tasks,
 * dst. tetap utuh). Dipakai sekali setelah KECAMATAN_CENTERS di
 * supabase/seed/geo.ts diperbaiki (koordinat versi awal keliru menempatkan
 * kelima kecamatan di sekitar Kota Probolinggo, padahal kelimanya ada di
 * Kabupaten Probolinggo — wilayah administratif berbeda).
 *
 * Alur:
 *   1. Baca semua regions saat ini (lat/lng LAMA).
 *   2. Hitung koordinat BARU: kecamatan dari KECAMATAN_CENTERS, desa dari
 *      desaCoordinate() (rumus sama persis dengan regions.ts).
 *   3. Untuk tiap desa, hitung delta (baru - lama) lalu geser SEMUA aduan
 *      yang region_id-nya desa itu dengan delta yang sama (translasi kaku) —
 *      ini mempertahankan jarak relatif antar-aduan dalam satu desa apa
 *      adanya, termasuk cluster jalan rusak Bantaran yang harus tetap
 *      berjarak <= 500 m satu sama lain.
 *   4. Update tabel regions ke koordinat baru.
 *   5. Jalankan recomputeAllClusters() supaya cluster konsisten dengan
 *      koordinat baru.
 *
 * Idempoten: kalau dijalankan lagi setelah koordinat sudah benar, lat/lng
 * "lama" yang dibaca dari DB sudah sama dengan hasil desaCoordinate() /
 * KECAMATAN_CENTERS (fungsi murni, deterministik) — delta jadi 0, tidak ada
 * perubahan lagi.
 *
 * Jalankan: npx tsx --env-file=.env.local supabase/seed/fix-coordinates.ts
 */

import { createClient } from "../../src/lib/supabase/client";
import { KECAMATAN_CENTERS, desaCoordinate, type LatLng } from "./geo";
import { recomputeAllClusters } from "../../src/lib/analytics/clustering";

type SupabaseAdminClient = ReturnType<typeof createClient>;

interface RegionRow {
  id: string;
  name: string;
  level: "kecamatan" | "desa";
  parent_id: string | null;
  lat: number | null;
  lng: number | null;
}

async function main(): Promise<void> {
  const supabase = createClient();

  const { data: regions, error } = await supabase
    .from("regions")
    .select("id, name, level, parent_id, lat, lng");
  if (error) throw new Error(`Gagal membaca regions: ${error.message}`);

  const rows = (regions ?? []) as RegionRow[];
  const kecamatanRows = rows.filter((r) => r.level === "kecamatan");
  const desaRows = rows.filter((r) => r.level === "desa");
  const kecamatanNameById = new Map(kecamatanRows.map((k) => [k.id, k.name]));

  // ---------------------------------------------------------------------
  // 1-2. Hitung koordinat baru + delta per desa
  // ---------------------------------------------------------------------
  interface DesaUpdate {
    id: string;
    oldLat: number | null;
    oldLng: number | null;
    newLat: number;
    newLng: number;
  }

  const desaUpdates: DesaUpdate[] = [];
  const skippedNoKecamatan: string[] = [];

  for (const desaRow of desaRows) {
    const kecamatanName = desaRow.parent_id ? kecamatanNameById.get(desaRow.parent_id) : undefined;
    const center: LatLng | undefined = kecamatanName ? KECAMATAN_CENTERS[kecamatanName] : undefined;

    if (!kecamatanName || !center) {
      skippedNoKecamatan.push(desaRow.name);
      continue;
    }

    const { lat, lng } = desaCoordinate(kecamatanName, desaRow.name, center);
    desaUpdates.push({ id: desaRow.id, oldLat: desaRow.lat, oldLng: desaRow.lng, newLat: lat, newLng: lng });
  }

  if (skippedNoKecamatan.length > 0) {
    console.warn(
      `⚠️  Desa dilewati (kecamatan induk tidak dikenal di KECAMATAN_CENTERS): ${skippedNoKecamatan.join(", ")}`
    );
  }

  // ---------------------------------------------------------------------
  // 3. Geser aduan sesuai delta desa-nya (translasi kaku, jaga jarak relatif)
  // ---------------------------------------------------------------------
  let complaintsShifted = 0;

  for (const update of desaUpdates) {
    if (update.oldLat == null || update.oldLng == null) continue;

    const deltaLat = update.newLat - update.oldLat;
    const deltaLng = update.newLng - update.oldLng;

    // Sudah benar (idempoten) — tidak perlu query/update aduan sama sekali.
    if (Math.abs(deltaLat) < 1e-9 && Math.abs(deltaLng) < 1e-9) continue;

    const { data: complaints, error: complaintsErr } = await supabase
      .from("complaints")
      .select("id, lat, lng")
      .eq("region_id", update.id)
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (complaintsErr) {
      console.error(`Gagal membaca aduan untuk region ${update.id}:`, complaintsErr.message);
      continue;
    }

    for (const c of complaints ?? []) {
      const lat = c.lat as number;
      const lng = c.lng as number;
      const { error: updateErr } = await supabase
        .from("complaints")
        .update({ lat: lat + deltaLat, lng: lng + deltaLng })
        .eq("id", c.id as string);

      if (updateErr) {
        console.error(`Gagal update koordinat aduan ${c.id}:`, updateErr.message);
        continue;
      }
      complaintsShifted++;
    }
  }

  console.log(`📍 Aduan digeser mengikuti desanya: ${complaintsShifted}`);

  // ---------------------------------------------------------------------
  // 4. Update koordinat regions (kecamatan + desa)
  // ---------------------------------------------------------------------
  let regionsUpdated = 0;

  for (const kec of kecamatanRows) {
    const center = KECAMATAN_CENTERS[kec.name];
    if (!center) continue;
    if (kec.lat === center.lat && kec.lng === center.lng) continue; // idempoten

    const { error: updateErr } = await supabase
      .from("regions")
      .update({ lat: center.lat, lng: center.lng })
      .eq("id", kec.id);
    if (updateErr) {
      console.error(`Gagal update koordinat kecamatan ${kec.name}:`, updateErr.message);
      continue;
    }
    regionsUpdated++;
  }

  for (const update of desaUpdates) {
    const { error: updateErr } = await supabase
      .from("regions")
      .update({ lat: update.newLat, lng: update.newLng })
      .eq("id", update.id);
    if (updateErr) {
      console.error(`Gagal update koordinat desa ${update.id}:`, updateErr.message);
      continue;
    }
    regionsUpdated++;
  }

  console.log(`📍 Baris regions diperbarui: ${regionsUpdated}\n`);

  // ---------------------------------------------------------------------
  // 5. Clustering ulang mengikuti koordinat baru
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
