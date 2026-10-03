/**
 * supabase/seed/placement.ts
 *
 * Penempatan koordinat aduan seed — dipakai bersama oleh complaints.ts
 * (seed baru) dan fix-coordinates.ts (perbaikan data yang sudah ada) agar
 * keduanya menghasilkan titik yang identik.
 *
 * Jangkar sebuah aduan adalah desanya. Aduan yang region_id-nya kecamatan
 * memakai desa bernama sama di kecamatan itu (mis. Kec. Bantaran → Desa
 * Bantaran); jika tidak ada, pusat kecamatan.
 */

import { sid } from "./uuid";
import { REGIONS } from "./regions";
import { complaintCoordinate, type LatLng } from "./geo";

/** 6 aduan cluster jalan rusak dekat SDN 1 Bantaran (skenario demo Step 3). */
export const BANTARAN_CLUSTER_SLUGS = [
  "c-ban-001",
  "c-ban-002",
  "c-ban-003",
  "c-ban-004",
  "c-ban-005",
  "c-ban-006",
] as const;

export const BANTARAN_CLUSTER_IDS: ReadonlySet<string> = new Set(BANTARAN_CLUSTER_SLUGS.map((s) => sid(s)));

const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

/** Titik jangkar (desa) untuk sebuah region seed. */
export function anchorForRegion(regionId: string): LatLng | null {
  const region = REGION_BY_ID.get(regionId);
  if (!region) return null;
  if (region.level === "desa") return { lat: region.lat, lng: region.lng };
  const sameNameDesa = REGIONS.find(
    (r) => r.level === "desa" && r.parent_id === region.id && r.name === region.name
  );
  return sameNameDesa ? { lat: sameNameDesa.lat, lng: sameNameDesa.lng } : { lat: region.lat, lng: region.lng };
}

/** Koordinat final aduan seed (deterministik berdasarkan id aduan). */
export function seedComplaintCoordinate(complaintId: string, regionId: string): LatLng | null {
  const anchor = anchorForRegion(regionId);
  if (!anchor) return null;
  return complaintCoordinate(complaintId, anchor, BANTARAN_CLUSTER_IDS.has(complaintId));
}
