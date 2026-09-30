/**
 * src/lib/constants/map-colors.ts
 *
 * Warna marker per kategori untuk /peta. Terpisah dari
 * src/lib/constants/categories.ts supaya konstanta kategori tetap netral
 * dari kebutuhan tampilan.
 */

import type { CategorySlug } from "./categories";

export const CATEGORY_MARKER_COLORS: Record<CategorySlug, string> = {
  infrastruktur_jalan: "#f97316", // orange
  kesehatan_diare: "#ef4444", // red
  pengelolaan_sampah: "#84cc16", // lime
  banjir_drainase: "#3b82f6", // blue
  air_bersih_pdam: "#06b6d4", // cyan
  pendidikan: "#a855f7", // purple
  pkl_tata_ruang: "#eab308", // amber
};

export const DEFAULT_MARKER_COLOR = "#6b7280"; // abu-abu — kategori belum diketahui

export function getMarkerColor(category: string | null): string {
  if (!category) return DEFAULT_MARKER_COLOR;
  return CATEGORY_MARKER_COLORS[category as CategorySlug] ?? DEFAULT_MARKER_COLOR;
}

/** Warna dasar lingkaran kecamatan (opasitas/radius diskalakan dari jumlah aduan aktif). */
export const KECAMATAN_CIRCLE_COLOR = "#4f46e5"; // indigo
