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
 * Koordinat pusat kecamatan (kantor kecamatan), diambil dari Wikipedia
 * bahasa Indonesia per kecamatan. Ini SATU-SATUNYA sumber kebenaran untuk
 * lokasi kecamatan — regions.ts dan fix-coordinates.ts sama-sama
 * mengimpornya dari sini.
 */
export const KECAMATAN_CENTERS: Record<string, LatLng> = {
  Bantaran: { lat: -7.866, lng: 113.1786 },
  Sumberasih: { lat: -7.7824, lng: 113.1669 },
  Dringu: { lat: -7.7872, lng: 113.255 },
  Wonomerto: { lat: -7.8316, lng: 113.1487 },
  Leces: { lat: -7.8344, lng: 113.2279 },
};
