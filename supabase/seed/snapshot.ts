/**
 * supabase/seed/snapshot.ts
 *
 * Format + pemulihan snapshot hasil AI aduan seed
 * (supabase/seed/ai-cache-snapshot.json, dibuat oleh precompute-ai.ts).
 *
 * Snapshot SENGAJA tidak menyimpan koordinat maupun timestamp aduan —
 * keduanya selalu berasal dari complaints.ts (koordinat dari geo.ts /
 * placement.ts, timestamp relatif terhadap waktu seed dijalankan). Snapshot
 * hanya berisi hasil AI:
 *   - triage_results terbaru per aduan seed
 *   - complaint_embeddings per aduan seed
 *   - ai_cache untuk flow clarify, triage, embed, opd-agent, alert-summary
 *     (aduin-verify tidak disertakan — inputnya URL foto yang ikut terhapus
 *     saat reset)
 *
 * applySnapshot() menerapkan aturan yang sama dengan triage-seed.ts dan
 * pipeline triage:
 *   - effective_category/effective_opd_id = hasil triage AI di snapshot
 *   - status 'pending' yang punya hasil triage → 'triaged'
 *   - rencana koordinasi sederhana (1 tugas ke effective_opd_id) dibuat
 *     ulang; status tugas diselaraskan dengan status aduan.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import type { createClient } from "../../src/lib/supabase/client";

type AdminClient = ReturnType<typeof createClient>;

export const SNAPSHOT_RELATIVE_PATH = "supabase/seed/ai-cache-snapshot.json";
export const SNAPSHOT_FLOWS = [
  "aduin-clarify",
  "aduin-triage",
  "aduin-embed",
  "aduin-opd-agent",
  "aduin-alert-summary",
] as const;

export interface SnapshotTriage {
  complaint_id: string;
  category: string;
  opd_id: string | null;
  urgency: number;
  impact: string;
  handling_path: string;
  reason: string;
  raw_response: unknown;
}

export interface SnapshotEmbedding {
  complaint_id: string;
  /** Format pgvector apa adanya dari database (string "[...]" atau array angka). */
  embedding: string | number[];
  model_version: string;
}

export interface SnapshotCacheEntry {
  flow_name: string;
  input_hash: string;
  output: unknown;
}

export interface AiSnapshot {
  version: 1;
  generated_at: string;
  counts: { triage_results: number; embeddings: number; ai_cache: number };
  triage_results: SnapshotTriage[];
  embeddings: SnapshotEmbedding[];
  ai_cache: SnapshotCacheEntry[];
}

export function snapshotPath(): string {
  return path.join(process.cwd(), SNAPSHOT_RELATIVE_PATH);
}

/** null jika file belum ada (precompute-ai.ts belum pernah dijalankan). */
export function readSnapshot(): AiSnapshot | null {
  const file = snapshotPath();
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf-8")) as AiSnapshot;
  if (parsed.version !== 1) throw new Error(`Versi snapshot tidak dikenal: ${String(parsed.version)}`);
  return parsed;
}

const BATCH = 200;

async function insertInBatches(
  supabase: AdminClient,
  table: string,
  rows: Record<string, unknown>[],
  upsertOn?: string
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = upsertOn
      ? await supabase.from(table).upsert(chunk, { onConflict: upsertOn })
      : await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Gagal menulis ${table}: ${error.message}`);
  }
}

const TASK_STATUS_BY_COMPLAINT: Record<string, "belum_mulai" | "proses" | "selesai"> = {
  triaged: "belum_mulai",
  in_progress: "proses",
  needs_review: "selesai",
  ai_verified: "selesai",
  closed: "selesai",
};

export interface SeedComplaintRow {
  id: string;
  status: string;
  reported_at: string;
  effective_category: string | null;
  effective_opd_id: string | null;
}

export interface ApplySnapshotResult {
  triage: number;
  embeddings: number;
  cache: number;
  plans: number;
}

/**
 * Menerapkan snapshot ke aduan seed yang BARU saja ditulis ulang
 * (complaints.ts). Pemanggil wajib sudah menghapus turunan lama aduan seed.
 */
export async function applySnapshot(
  supabase: AdminClient,
  snapshot: AiSnapshot,
  seedRows: SeedComplaintRow[]
): Promise<ApplySnapshotResult> {
  const byId = new Map(seedRows.map((r) => [r.id, r]));
  const triage = snapshot.triage_results.filter((t) => byId.has(t.complaint_id));
  const embeddings = snapshot.embeddings.filter((e) => byId.has(e.complaint_id));

  // 1. triage_results — created_at 1 menit setelah aduan dilaporkan.
  await insertInBatches(
    supabase,
    "triage_results",
    triage.map((t) => ({
      complaint_id: t.complaint_id,
      category: t.category,
      opd_id: t.opd_id,
      urgency: t.urgency,
      impact: t.impact,
      handling_path: t.handling_path,
      reason: t.reason,
      raw_response: t.raw_response ?? null,
      from_cache: true,
      created_at: new Date(new Date(byId.get(t.complaint_id)!.reported_at).getTime() + 60_000).toISOString(),
    }))
  );

  // 2. Field AI di complaints + status pending → triaged.
  const finalRows = new Map(seedRows.map((r) => [r.id, { ...r }]));
  for (const t of triage) {
    const row = finalRows.get(t.complaint_id)!;
    row.effective_category = t.category;
    row.effective_opd_id = t.opd_id;
    if (row.status === "pending") row.status = "triaged";
    const { error } = await supabase
      .from("complaints")
      .update({ effective_category: row.effective_category, effective_opd_id: row.effective_opd_id, status: row.status })
      .eq("id", row.id);
    if (error) throw new Error(`Gagal memperbarui aduan ${row.id}: ${error.message}`);
  }

  // 3. complaint_embeddings
  await insertInBatches(
    supabase,
    "complaint_embeddings",
    embeddings.map((e) => ({
      complaint_id: e.complaint_id,
      embedding: e.embedding,
      model_version: e.model_version,
    })),
    "complaint_id"
  );

  // 4. ai_cache (upsert — entri yang sama dari run sebelumnya ditimpa)
  await insertInBatches(
    supabase,
    "ai_cache",
    snapshot.ai_cache.map((c) => ({ flow_name: c.flow_name, input_hash: c.input_hash, output: c.output })),
    "flow_name,input_hash"
  );

  // 5. Rencana koordinasi sederhana untuk aduan yang sudah punya OPD.
  const triageReason = new Map(triage.map((t) => [t.complaint_id, t.reason]));
  let plans = 0;
  for (const row of finalRows.values()) {
    const taskStatus = TASK_STATUS_BY_COMPLAINT[row.status];
    if (!taskStatus || !row.effective_opd_id) continue;
    const createdAt = new Date(new Date(row.reported_at).getTime() + 2 * 60_000).toISOString();
    const { data: plan, error: planErr } = await supabase
      .from("coordination_plans")
      .insert({ complaint_id: row.id, plan_type: "simple", created_at: createdAt })
      .select("id")
      .single();
    if (planErr || !plan) throw new Error(`Gagal membuat rencana aduan ${row.id}: ${planErr?.message}`);
    const { error: taskErr } = await supabase.from("tasks").insert({
      plan_id: plan.id,
      opd_id: row.effective_opd_id,
      title: "Tindak lanjuti aduan",
      description: triageReason.get(row.id) ?? null,
      sequence: 1,
      status: taskStatus,
      completed_at: taskStatus === "selesai" ? createdAt : null,
      created_at: createdAt,
      updated_at: createdAt,
    });
    if (taskErr) throw new Error(`Gagal membuat tugas aduan ${row.id}: ${taskErr.message}`);
    plans++;
  }

  return { triage: triage.length, embeddings: embeddings.length, cache: snapshot.ai_cache.length, plans };
}
