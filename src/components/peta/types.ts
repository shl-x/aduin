/**
 * src/components/peta/types.ts
 *
 * Tipe data yang dipakai bersama oleh page.tsx (server), peta-client.tsx,
 * dan leaflet-map.tsx untuk halaman /peta.
 */

export interface ComplaintMarker {
  id: string;
  text: string;
  status: string;
  category: string | null;
  handlingPath: string | null;
  urgency: number | null;
  lat: number;
  lng: number;
  reportedAt: string;
  regionName: string | null;
  opdShortName: string | null;
  clusterId: string | null;
}

export interface KecamatanStat {
  id: string;
  name: string;
  lat: number;
  lng: number;
  activeCount: number;
}

export interface ClusterInfo {
  id: string;
  label: string | null;
  category: string | null;
  memberCount: number;
}
