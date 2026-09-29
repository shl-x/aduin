/**
 * supabase/seed/opd.ts
 *
 * Seed 7 OPD sesuai LANGFLOW_FLOWS.md § Referensi Cepat: Daftar OPD Seed.
 */

import { createClient } from "../../src/lib/supabase/client";
import { sid } from "./uuid";

export interface OpdRow {
  id: string;
  name: string;
  short_name: string;
  contact_info: Record<string, string>;
}

export const OPD_ROWS: OpdRow[] = [
  {
    id: sid("opd-dpu"),
    name: "Dinas Pekerjaan Umum",
    short_name: "DPU",
    contact_info: { telepon: "(0335) 421234", email: "dpu@probolinggokab.go.id" },
  },
  {
    id: sid("opd-dinkes"),
    name: "Dinas Kesehatan",
    short_name: "Dinkes",
    contact_info: { telepon: "(0335) 421235", email: "dinkes@probolinggokab.go.id" },
  },
  {
    id: sid("opd-dlh"),
    name: "Dinas Lingkungan Hidup",
    short_name: "DLH",
    contact_info: { telepon: "(0335) 421236", email: "dlh@probolinggokab.go.id" },
  },
  {
    id: sid("opd-pdam"),
    name: "Perusahaan Daerah Air Minum",
    short_name: "PDAM",
    contact_info: { telepon: "(0335) 421237", email: "pdam@probolinggokab.go.id" },
  },
  {
    id: sid("opd-disdik"),
    name: "Dinas Pendidikan",
    short_name: "Disdik",
    contact_info: { telepon: "(0335) 421238", email: "disdik@probolinggokab.go.id" },
  },
  {
    id: sid("opd-satpol"),
    name: "Satuan Polisi Pamong Praja",
    short_name: "Satpol",
    contact_info: { telepon: "(0335) 421239", email: "satpol@probolinggokab.go.id" },
  },
  {
    id: sid("opd-bpkad"),
    name: "Badan Pengelola Keuangan dan Aset Daerah",
    short_name: "BPKAD",
    contact_info: { telepon: "(0335) 421240", email: "bpkad@probolinggokab.go.id" },
  },
];

/** Map short_name → UUID untuk dipakai oleh seed complaints */
export const OPD_ID_BY_SHORT: Record<string, string> = Object.fromEntries(
  OPD_ROWS.map((o) => [o.short_name, o.id])
);

export async function seedOpd(): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("opd")
    .upsert(OPD_ROWS, { onConflict: "id" });
  if (error) throw new Error(`Seed OPD gagal: ${error.message}`);

  console.log(`✅ opd: ${OPD_ROWS.length} baris`);
}
