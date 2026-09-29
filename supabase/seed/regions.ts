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

export interface RegionRow {
  id: string;
  name: string;
  level: "kecamatan" | "desa";
  parent_id: string | null;
  lat: number;
  lng: number;
}

// Koordinat berpusat di Kabupaten Probolinggo (~lat -7.75 lng 113.2)
export const REGIONS: RegionRow[] = [
  // ── Kecamatan ──────────────────────────────────────────────────────────────
  {
    id: sid("r-kec-bantaran"),
    name: "Bantaran",
    level: "kecamatan",
    parent_id: null,
    lat: -7.7962,
    lng: 113.1245,
  },
  {
    id: sid("r-kec-sumberasih"),
    name: "Sumberasih",
    level: "kecamatan",
    parent_id: null,
    lat: -7.7651,
    lng: 113.1845,
  },
  {
    id: sid("r-kec-dringu"),
    name: "Dringu",
    level: "kecamatan",
    parent_id: null,
    lat: -7.7453,
    lng: 113.2234,
  },
  {
    id: sid("r-kec-wonomerto"),
    name: "Wonomerto",
    level: "kecamatan",
    parent_id: null,
    lat: -7.8123,
    lng: 113.1634,
  },
  {
    id: sid("r-kec-leces"),
    name: "Leces",
    level: "kecamatan",
    parent_id: null,
    lat: -7.7834,
    lng: 113.2012,
  },

  // ── Desa Bantaran ───────────────────────────────────────────────────────────
  {
    id: sid("r-des-bantaran"),
    name: "Bantaran",
    level: "desa",
    parent_id: sid("r-kec-bantaran"),
    lat: -7.7945,
    lng: 113.1212,
  },
  {
    id: sid("r-des-karanganyar"),
    name: "Karanganyar",
    level: "desa",
    parent_id: sid("r-kec-bantaran"),
    lat: -7.8023,
    lng: 113.1289,
  },
  {
    id: sid("r-des-pandean"),
    name: "Pandean",
    level: "desa",
    parent_id: sid("r-kec-bantaran"),
    lat: -7.7876,
    lng: 113.1178,
  },
  {
    id: sid("r-des-legundi"),
    name: "Legundi",
    level: "desa",
    parent_id: sid("r-kec-bantaran"),
    lat: -7.8067,
    lng: 113.1334,
  },

  // ── Desa Sumberasih ─────────────────────────────────────────────────────────
  {
    id: sid("r-des-sumberasih"),
    name: "Sumberasih",
    level: "desa",
    parent_id: sid("r-kec-sumberasih"),
    lat: -7.7623,
    lng: 113.1812,
  },
  {
    id: sid("r-des-banjarsari"),
    name: "Banjarsari",
    level: "desa",
    parent_id: sid("r-kec-sumberasih"),
    lat: -7.7698,
    lng: 113.1889,
  },
  {
    id: sid("r-des-lemahkembar"),
    name: "Lemahkembar",
    level: "desa",
    parent_id: sid("r-kec-sumberasih"),
    lat: -7.7567,
    lng: 113.1756,
  },
  {
    id: sid("r-des-clarak"),
    name: "Clarak",
    level: "desa",
    parent_id: sid("r-kec-sumberasih"),
    lat: -7.7734,
    lng: 113.1923,
  },

  // ── Desa Dringu ─────────────────────────────────────────────────────────────
  {
    id: sid("r-des-dringu"),
    name: "Dringu",
    level: "desa",
    parent_id: sid("r-kec-dringu"),
    lat: -7.7423,
    lng: 113.2198,
  },
  {
    id: sid("r-des-pabean"),
    name: "Pabean",
    level: "desa",
    parent_id: sid("r-kec-dringu"),
    lat: -7.7489,
    lng: 113.2267,
  },
  {
    id: sid("r-des-sumberkedawung"),
    name: "Sumberkedawung",
    level: "desa",
    parent_id: sid("r-kec-dringu"),
    lat: -7.7512,
    lng: 113.2145,
  },

  // ── Desa Wonomerto ──────────────────────────────────────────────────────────
  {
    id: sid("r-des-wonomerto"),
    name: "Wonomerto",
    level: "desa",
    parent_id: sid("r-kec-wonomerto"),
    lat: -7.8098,
    lng: 113.1612,
  },
  {
    id: sid("r-des-sumber"),
    name: "Sumber",
    level: "desa",
    parent_id: sid("r-kec-wonomerto"),
    lat: -7.8156,
    lng: 113.1678,
  },
  {
    id: sid("r-des-patalan"),
    name: "Patalan",
    level: "desa",
    parent_id: sid("r-kec-wonomerto"),
    lat: -7.8034,
    lng: 113.1589,
  },

  // ── Desa Leces ──────────────────────────────────────────────────────────────
  {
    id: sid("r-des-leces"),
    name: "Leces",
    level: "desa",
    parent_id: sid("r-kec-leces"),
    lat: -7.7812,
    lng: 113.1978,
  },
  {
    id: sid("r-des-warujinggo"),
    name: "Warujinggo",
    level: "desa",
    parent_id: sid("r-kec-leces"),
    lat: -7.7867,
    lng: 113.2056,
  },
  {
    id: sid("r-des-tigasan"),
    name: "Tigasan",
    level: "desa",
    parent_id: sid("r-kec-leces"),
    lat: -7.7745,
    lng: 113.1934,
  },
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
