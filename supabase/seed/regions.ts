/**
 * supabase/seed/regions.ts
 *
 * Seed wilayah administratif Kabupaten Probolinggo.
 * Mencakup 5 kecamatan dan ≥15 desa dengan koordinat realistis.
 *
 * Kecamatan yang dicakup (sesuai ARCHITECTURE.md §10):
 *   1. Bantaran    — ~40 aduan seed (cluster jalan rusak)
 *   2. Sumberasih  — ~35 aduan seed (lonjakan diare)
 *   3. Dringu      — ~25 aduan seed (variasi)
 *   4. Wonomerto   — ~25 aduan seed (variasi)
 *   5. Leces       — ~25 aduan seed (beberapa closed)
 */

import { createClient } from "../../src/lib/supabase/client";
import { sid } from "./uuid";
import { KECAMATAN_CENTERS, resolveDesaCoordinate } from "./geo";

export interface RegionRow {
  id: string;
  name: string;
  level: "kecamatan" | "desa";
  parent_id: string | null;
  lat: number;
  lng: number;
}

/**
 * Koordinat pusat kecamatan: KECAMATAN_CENTERS (geo.ts). Koordinat desa:
 * resolveDesaCoordinate() — koordinat asli untuk desa yang ada di
 * DESA_FIXED_COORDS (Bantaran, Karanganyar, Legundi), selain itu
 * deterministik 1–3 km dari pusat kecamatannya.
 */
function desa(name: string, kecamatanName: string, parentId: string): RegionRow {
  const { lat, lng } = resolveDesaCoordinate(kecamatanName, name);
  return {
    id: sid(`r-des-${name.toLowerCase().replace(/\s+/g, "-")}`),
    name,
    level: "desa",
    parent_id: parentId,
    lat,
    lng,
  };
}

const KEC_BANTARAN_ID = sid("r-kec-bantaran");
const KEC_SUMBERASIH_ID = sid("r-kec-sumberasih");
const KEC_DRINGU_ID = sid("r-kec-dringu");
const KEC_WONOMERTO_ID = sid("r-kec-wonomerto");
const KEC_LECES_ID = sid("r-kec-leces");

export const REGIONS: RegionRow[] = [
  // ── Kecamatan ──────────────────────────────────────────────────────────────
  {
    id: KEC_BANTARAN_ID,
    name: "Bantaran",
    level: "kecamatan",
    parent_id: null,
    lat: KECAMATAN_CENTERS.Bantaran.lat,
    lng: KECAMATAN_CENTERS.Bantaran.lng,
  },
  {
    id: KEC_SUMBERASIH_ID,
    name: "Sumberasih",
    level: "kecamatan",
    parent_id: null,
    lat: KECAMATAN_CENTERS.Sumberasih.lat,
    lng: KECAMATAN_CENTERS.Sumberasih.lng,
  },
  {
    id: KEC_DRINGU_ID,
    name: "Dringu",
    level: "kecamatan",
    parent_id: null,
    lat: KECAMATAN_CENTERS.Dringu.lat,
    lng: KECAMATAN_CENTERS.Dringu.lng,
  },
  {
    id: KEC_WONOMERTO_ID,
    name: "Wonomerto",
    level: "kecamatan",
    parent_id: null,
    lat: KECAMATAN_CENTERS.Wonomerto.lat,
    lng: KECAMATAN_CENTERS.Wonomerto.lng,
  },
  {
    id: KEC_LECES_ID,
    name: "Leces",
    level: "kecamatan",
    parent_id: null,
    lat: KECAMATAN_CENTERS.Leces.lat,
    lng: KECAMATAN_CENTERS.Leces.lng,
  },

  // ── Desa Bantaran ───────────────────────────────────────────────────────────
  desa("Bantaran", "Bantaran", KEC_BANTARAN_ID),
  desa("Karanganyar", "Bantaran", KEC_BANTARAN_ID),
  desa("Pandean", "Bantaran", KEC_BANTARAN_ID),
  desa("Legundi", "Bantaran", KEC_BANTARAN_ID),

  // ── Desa Sumberasih ─────────────────────────────────────────────────────────
  desa("Sumberasih", "Sumberasih", KEC_SUMBERASIH_ID),
  desa("Banjarsari", "Sumberasih", KEC_SUMBERASIH_ID),
  desa("Lemahkembar", "Sumberasih", KEC_SUMBERASIH_ID),
  desa("Clarak", "Sumberasih", KEC_SUMBERASIH_ID),

  // ── Desa Dringu ─────────────────────────────────────────────────────────────
  desa("Dringu", "Dringu", KEC_DRINGU_ID),
  desa("Pabean", "Dringu", KEC_DRINGU_ID),
  desa("Sumberkedawung", "Dringu", KEC_DRINGU_ID),

  // ── Desa Wonomerto ──────────────────────────────────────────────────────────
  desa("Wonomerto", "Wonomerto", KEC_WONOMERTO_ID),
  desa("Sumber", "Wonomerto", KEC_WONOMERTO_ID),
  desa("Patalan", "Wonomerto", KEC_WONOMERTO_ID),

  // ── Desa Leces ──────────────────────────────────────────────────────────────
  desa("Leces", "Leces", KEC_LECES_ID),
  desa("Warujinggo", "Leces", KEC_LECES_ID),
  desa("Tigasan", "Leces", KEC_LECES_ID),
];

export async function seedRegions(): Promise<void> {
  const supabase = createClient();

  // Kecamatan pertama (parent_id = null)
  const kecamatanRows = REGIONS.filter((r) => r.level === "kecamatan");
  const desaRows = REGIONS.filter((r) => r.level === "desa");

  const { error: errKec } = await supabase
    .from("regions")
    .upsert(kecamatanRows, { onConflict: "id" });
  if (errKec) throw new Error(`Seed kecamatan gagal: ${errKec.message}`);

  const { error: errDes } = await supabase
    .from("regions")
    .upsert(desaRows, { onConflict: "id" });
  if (errDes) throw new Error(`Seed desa gagal: ${errDes.message}`);

  console.log(`✅ regions: ${REGIONS.length} baris (${kecamatanRows.length} kecamatan, ${desaRows.length} desa)`);
}
