/**
 * src/lib/constants/categories.ts
 *
 * Sumber kebenaran tunggal untuk semua nilai kategori di seluruh sistem.
 * Tersedia di client dan server tanpa query DB.
 *
 * Aturan penggunaan:
 *  - Kolom `category`, `effective_category`, `label_manual` menyimpan nilai slug.
 *  - Flow `aduin-triage` wajib memilih slug dari daftar ini.
 *  - Label tampilan diambil dengan CATEGORIES.find(c => c.slug === slug)?.label
 *  - `defaultOpdShortName` dipakai oleh rencana koordinasi sederhana pasca-triage.
 */

export const CATEGORIES = [
  {
    slug: "infrastruktur_jalan",
    label: "Infrastruktur Jalan",
    defaultOpdShortName: "DPU",
  },
  {
    slug: "kesehatan_diare",
    label: "Kesehatan & Sanitasi",
    defaultOpdShortName: "Dinkes",
  },
  {
    slug: "pengelolaan_sampah",
    label: "Pengelolaan Sampah",
    defaultOpdShortName: "DLH",
  },
  {
    slug: "banjir_drainase",
    label: "Banjir/Drainase",
    defaultOpdShortName: "DPU",
  },
  {
    slug: "air_bersih_pdam",
    label: "Air Bersih/PDAM",
    defaultOpdShortName: "PDAM",
  },
  {
    slug: "pendidikan",
    label: "Pendidikan",
    defaultOpdShortName: "Disdik",
  },
  {
    slug: "pkl_tata_ruang",
    label: "PKL/Tata Ruang",
    defaultOpdShortName: "Satpol",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
