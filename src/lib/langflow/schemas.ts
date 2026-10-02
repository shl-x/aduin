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

// ---------------------------------------------------------------------------
// Flow 3 — aduin-embed
// ---------------------------------------------------------------------------

/**
 * Dimensi harus persis sama dengan EMBEDDING_DIMENSION (.env.local) dan
 * kolom complaint_embeddings.embedding (vector(768)) — lihat
 * docs/LANGFLOW_FLOWS.md §Flow 3. Model aktual di flow aduin-embed adalah
 * ibm/granite-embedding-278m-multilingual (768 dimensi).
 */
export const embedOutputSchema = z.object({
  embedding: z.array(z.number()).length(768),
  model_version: z.string(),
});
export type EmbedOutput = z.infer<typeof embedOutputSchema>;

// ---------------------------------------------------------------------------
// Flow 4 — aduin-opd-agent
// ---------------------------------------------------------------------------

/**
 * OPD yang boleh muncul di sub-tugas rencana koordinasi. Berbeda dengan
 * OPD_SHORT_NAMES (triage), BPKAD diizinkan di sini untuk sub-tugas alokasi
 * anggaran — lihat docs/LANGFLOW_FLOWS.md §Flow 4.
 */
export const OPD_AGENT_SHORT_NAMES = [...OPD_SHORT_NAMES, "BPKAD"] as const;

const opdAgentTaskSchema = z.object({
  sequence: z.number().int().min(1),
  title: z.string().min(3),
  description: z.string(),
  opd_short_name: z.enum(OPD_AGENT_SHORT_NAMES),
  depends_on: z.array(z.number().int().min(1)),
});

export const opdAgentOutputSchema = z
  .object({
    summary: z.string().min(10),
    tasks: z.array(opdAgentTaskSchema).min(1),
  })
  .superRefine((val, ctx) => {
    const sequences = new Set(val.tasks.map((t) => t.sequence));

    if (sequences.size !== val.tasks.length) {
      ctx.addIssue({
        code: "custom",
        message: "Setiap task harus memiliki sequence yang unik.",
      });
      return;
    }

    for (const task of val.tasks) {
      for (const dep of task.depends_on) {
        if (!sequences.has(dep)) {
          ctx.addIssue({
            code: "custom",
            message: `Task sequence ${task.sequence}: depends_on merujuk ke sequence ${dep} yang tidak ada.`,
          });
        }
        if (dep >= task.sequence) {
          ctx.addIssue({
            code: "custom",
            message: `Task sequence ${task.sequence}: depends_on ${dep} harus lebih kecil dari sequence task itu sendiri.`,
          });
        }
      }
    }

    // Constraint dep < sequence secara teori sudah mencegah siklus; DFS ini
    // lapisan keamanan tambahan (docs/LANGFLOW_FLOWS.md §Flow 4).
    const adjList = new Map<number, number[]>();
    for (const task of val.tasks) adjList.set(task.sequence, task.depends_on);

    const visited = new Set<number>();
    const stack = new Set<number>();
    function hasCycle(node: number): boolean {
      visited.add(node);
      stack.add(node);
      for (const dep of adjList.get(node) ?? []) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (stack.has(dep)) {
          return true;
        }
      }
      stack.delete(node);
      return false;
    }

    for (const seq of sequences) {
      if (!visited.has(seq) && hasCycle(seq)) {
        ctx.addIssue({
          code: "custom",
          message: "Terdeteksi ketergantungan melingkar (circular dependency) antar tasks.",
        });
        break;
      }
    }
  });
export type OpdAgentOutput = z.infer<typeof opdAgentOutputSchema>;
