/**
 * supabase/seed/geo.ts
 *
 * Util geografis untuk menata koordinat desa relatif ke pusat kecamatannya.
 * Dipakai oleh regions.ts (seed awal) DAN fix-coordinates.ts (perbaikan data
 * yang sudah ada di DB) supaya keduanya memakai rumus persis sama —
 * mencegah drift antara data seed baru dan hasil perbaikan data lama.
 */

const EARTH_RADIUS_METERS = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Titik tujuan dari sebuah pusat, diberi bearing (derajat) dan jarak (meter). */
export function destinationPoint(center: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const bearing = (bearingDeg * Math.PI) / 180;
  const latRad = (center.lat * Math.PI) / 180;
  const lngRad = (center.lng * Math.PI) / 180;
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return { lat: (newLatRad * 180) / Math.PI, lng: (newLngRad * 180) / Math.PI };
}

/** Hash string deterministik (bukan kriptografis) — untuk memilih bearing/jarak yang stabil antar-run. */
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Posisi desa dalam radius 1–3 km dari pusat kecamatannya, deterministik
 * berdasarkan nama kecamatan + nama desa (idempoten: input sama -> output
 * sama persis, tidak pernah berubah antar-run).
 */
export function desaCoordinate(kecamatanName: string, desaName: string, kecamatanCenter: LatLng): LatLng {
  const h = hashString(`${kecamatanName}:${desaName}`);
  const bearingDeg = h % 360;
  const distanceMeters = 1000 + (Math.floor(h / 360) % 2001); // 1000..3000 m
  return destinationPoint(kecamatanCenter, bearingDeg, distanceMeters);
}

/**
 * Koordinat pusat kecamatan (lat, lng) — SATU-SATUNYA sumber kebenaran
 * lokasi kecamatan. regions.ts, complaints.ts, dan fix-coordinates.ts
 * sama-sama mengimpornya dari sini.
 */
export const KECAMATAN_CENTERS: Record<string, LatLng> = {
  Bantaran: { lat: -7.8736, lng: 113.1858 },
  Sumberasih: { lat: -7.7643, lng: 113.1501 },
  Dringu: { lat: -7.7885, lng: 113.2573 },
  Wonomerto: { lat: -7.8399, lng: 113.1561 },
  Leces: { lat: -7.8513, lng: 113.2216 },
};

/**
 * Desa dengan koordinat asli (bukan hasil desaCoordinate()). Kunci:
 * `${kecamatan}:${desa}`. Desa lain diletakkan 1–3 km dari pusat
 * kecamatannya secara deterministik.
 */
export const DESA_FIXED_COORDS: Record<string, LatLng> = {
  "Bantaran:Bantaran": { lat: -7.8717, lng: 113.1836 },
  "Bantaran:Karanganyar": { lat: -7.8776, lng: 113.1714 },
  "Bantaran:Legundi": { lat: -7.8643, lng: 113.1658 },
};

/** Koordinat final sebuah desa: koordinat asli jika ada, selain itu 1–3 km dari pusat kecamatan. */
export function resolveDesaCoordinate(kecamatanName: string, desaName: string): LatLng {
  const fixed = DESA_FIXED_COORDS[`${kecamatanName}:${desaName}`];
  if (fixed) return fixed;
  const center = KECAMATAN_CENTERS[kecamatanName];
  if (!center) throw new Error(`Kecamatan tidak dikenal di KECAMATAN_CENTERS: ${kecamatanName}`);
  return desaCoordinate(kecamatanName, desaName, center);
}

/**
 * Posisi sebuah aduan di sekitar titik jangkarnya (desa), deterministik
 * berdasarkan id aduan — input sama selalu menghasilkan titik yang sama,
 * sehingga seed baru dan fix-coordinates.ts menghasilkan koordinat identik.
 *
 * - Aduan biasa: 150–800 m dari desanya.
 * - Anggota cluster jalan rusak Bantaran: 30–200 m dari Desa Bantaran,
 *   sehingga jarak antar-anggota ≤ 400 m (di bawah CLUSTER_RADIUS_METERS 500 m).
 */
export function complaintCoordinate(complaintId: string, anchor: LatLng, tight: boolean): LatLng {
  const h = hashString(`aduan:${complaintId}`);
  const bearingDeg = h % 360;
  const [minM, maxM] = tight ? [30, 200] : [150, 800];
  const distanceMeters = minM + (Math.floor(h / 360) % (maxM - minM + 1));
  return destinationPoint(anchor, bearingDeg, distanceMeters);
}
