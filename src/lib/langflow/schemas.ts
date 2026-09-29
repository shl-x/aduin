/**
 * src/lib/langflow/schemas.ts
 *
 * Validasi Zod untuk setiap output flow Langflow.
 * Kontrak diambil dari docs/LANGFLOW_FLOWS.md — jangan menyimpang tanpa
 * memperbarui dokumen tersebut terlebih dahulu.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Flow 1 — aduin-clarify
// ---------------------------------------------------------------------------

export const clarifyOutputSchema = z.object({
  status: z.enum(["complete", "incomplete"]),
  question: z.string().nullable(),
});
export type ClarifyOutput = z.infer<typeof clarifyOutputSchema>;

// ---------------------------------------------------------------------------
// Flow 2 — aduin-triage
// ---------------------------------------------------------------------------

export const CATEGORY_SLUGS = [
  "infrastruktur_jalan",
  "kesehatan_diare",
  "pengelolaan_sampah",
  "banjir_drainase",
  "air_bersih_pdam",
  "pendidikan",
  "pkl_tata_ruang",
] as const;

/**
 * OPD yang boleh dipilih oleh aduin-triage. BPKAD sengaja tidak masuk daftar
 * ini — BPKAD hanya relevan untuk sub-tugas anggaran yang dihasilkan
 * aduin-opd-agent (M4), bukan OPD utama penanganan aduan.
 */
export const OPD_SHORT_NAMES = [
  "DPU",
  "Dinkes",
  "DLH",
  "PDAM",
  "Disdik",
  "Satpol",
] as const;

export const triageOutputSchema = z.object({
  category: z.enum(CATEGORY_SLUGS),
  opd_short_name: z.enum(OPD_SHORT_NAMES),
  urgency: z.number().int().min(1).max(5),
  impact: z.enum(["rendah", "sedang", "tinggi"]),
  handling_path: z.enum(["quick_fix", "bertahap", "butuh_data"]),
  reason: z.string().min(10),
});
export type TriageOutput = z.infer<typeof triageOutputSchema>;
