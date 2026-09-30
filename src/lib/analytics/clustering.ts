/**
 * src/lib/analytics/clustering.ts
 *
 * Algoritma clustering aduan — dijalankan di Next.js, bukan di Langflow.
 * Kontrak lengkap: ARCHITECTURE.md §5.1.
 *
 * Tiga syarat sekaligus untuk aduan masuk cluster yang sama:
 *   1. Cosine similarity embedding >= CLUSTER_SIMILARITY_THRESHOLD
 *   2. Jarak haversine <= CLUSTER_RADIUS_METERS
 *   3. Selisih reported_at <= CLUSTER_WINDOW_DAYS
 *
 * runClustering(complaintId) — dipanggil otomatis dari pipeline triage
 * setelah embedding satu aduan berhasil dibuat (incremental).
 * recomputeAllClusters() — dipanggil dari POST /api/cluster (tombol
 * "Hitung Ulang Cluster" di /peta) dan dari supabase/seed/embed-seed.ts;
 * mereset semua cluster lalu memproses ulang setiap aduan secara
 * berurutan waktu (reported_at ascending) memakai runClustering() yang sama.
 */

import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/constants/categories";

type SupabaseAdminClient = ReturnType<typeof createClient>;

const SIMILARITY_THRESHOLD = Number(process.env.CLUSTER_SIMILARITY_THRESHOLD ?? "0.75");
const RADIUS_METERS = Number(process.env.CLUSTER_RADIUS_METERS ?? "500");
const WINDOW_DAYS = Number(process.env.CLUSTER_WINDOW_DAYS ?? "14");

// ---------------------------------------------------------------------------
// Matematika: cosine similarity + haversine (ARCHITECTURE.md §5.1)
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Kolom pgvector dikembalikan supabase-js sebagai string representasi teks
 * ("[0.1,0.2,...]"), bukan array JS — parse dulu sebelum dipakai.
 */
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function unwrapEmbeddingRelation(
  rel: { embedding: unknown } | { embedding: unknown }[] | null
): number[] | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row ? parseEmbedding(row.embedding) : null;
}

function mode<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Clustering incremental — satu aduan
// ---------------------------------------------------------------------------

interface TargetRow {
  id: string;
  lat: number | null;
  lng: number | null;
  reported_at: string;
  complaint_embeddings: { embedding: unknown } | { embedding: unknown }[] | null;
}

interface CandidateRow {
  id: string;
  lat: number | null;
  lng: number | null;
  reported_at: string;
  cluster_id: string | null;
  complaint_embeddings: { embedding: unknown } | { embedding: unknown }[] | null;
}

/**
 * Menjalankan clustering untuk satu aduan: cari cluster yang cocok di antara
 * kandidat (aduan lain dalam window waktu, status bukan closed), atau buat
 * cluster baru (solo atau gabungan dengan kandidat pertama yang cocok).
 * Tidak melakukan apa-apa (return null) jika aduan belum punya embedding
 * atau koordinat.
 */
export async function runClustering(complaintId: string): Promise<string | null> {
  const supabase = createClient();

  const { data: target, error } = await supabase
    .from("complaints")
    .select("id, lat, lng, reported_at, complaint_embeddings(embedding)")
    .eq("id", complaintId)
    .single<TargetRow>();

  if (error || !target) {
    console.error(`[clustering] Aduan ${complaintId} tidak ditemukan:`, error?.message);
    return null;
  }

  const embedding = unwrapEmbeddingRelation(target.complaint_embeddings);
  if (!embedding || target.lat == null || target.lng == null) {
    return null;
  }

  const windowStartIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const { data: candidates, error: candErr } = await supabase
    .from("complaints")
    .select("id, lat, lng, reported_at, cluster_id, complaint_embeddings(embedding)")
    .neq("id", complaintId)
    .neq("status", "closed")
    .gte("reported_at", windowStartIso)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .returns<CandidateRow[]>();

  if (candErr) {
    console.error(`[clustering] Gagal membaca kandidat untuk aduan ${complaintId}:`, candErr.message);
    return null;
  }

  let matchedClusterId: string | null = null;

  for (const candidate of candidates ?? []) {
    if (candidate.lat == null || candidate.lng == null) continue;

    const candidateEmbedding = unwrapEmbeddingRelation(candidate.complaint_embeddings);
    if (!candidateEmbedding) continue;

    const sim = cosineSimilarity(embedding, candidateEmbedding);
    if (sim < SIMILARITY_THRESHOLD) continue;

    const dist = haversineMeters(target.lat, target.lng, candidate.lat, candidate.lng);
    if (dist > RADIUS_METERS) continue;

    const daysDiff =
      Math.abs(new Date(target.reported_at).getTime() - new Date(candidate.reported_at).getTime()) /
      86_400_000;
    if (daysDiff > WINDOW_DAYS) continue;

    if (candidate.cluster_id) {
      matchedClusterId = candidate.cluster_id;
      await supabase.from("complaints").update({ cluster_id: matchedClusterId }).eq("id", complaintId);
    } else {
      matchedClusterId = await createCluster(supabase, [candidate.id, complaintId]);
    }
    break;
  }

  if (!matchedClusterId) {
    matchedClusterId = await createCluster(supabase, [complaintId]);
  }

  await recalcClusterAggregate(supabase, matchedClusterId);
  return matchedClusterId;
}

async function createCluster(supabase: SupabaseAdminClient, complaintIds: string[]): Promise<string> {
  const { data, error } = await supabase.from("clusters").insert({}).select("id").single();
  if (error || !data) {
    throw new Error(`Gagal membuat cluster baru: ${error?.message ?? "unknown"}`);
  }
  await supabase.from("complaints").update({ cluster_id: data.id }).in("id", complaintIds);
  return data.id as string;
}

interface ClusterMemberRow {
  id: string;
  lat: number | null;
  lng: number | null;
  reported_at: string;
  effective_category: string | null;
  region_id: string | null;
}

async function recalcClusterAggregate(supabase: SupabaseAdminClient, clusterId: string): Promise<void> {
  const { data: members, error } = await supabase
    .from("complaints")
    .select("id, lat, lng, reported_at, effective_category, region_id")
    .eq("cluster_id", clusterId)
    .returns<ClusterMemberRow[]>();

  if (error || !members || members.length === 0) {
    // Cluster jadi kosong (semua anggota lepas/dihapus) — bersihkan baris cluster.
    await supabase.from("clusters").delete().eq("id", clusterId);
    return;
  }

  const lats = members.map((m) => m.lat).filter((v): v is number => v != null);
  const lngs = members.map((m) => m.lng).filter((v): v is number => v != null);
  const centroidLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centroidLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  const category = mode(members.map((m) => m.effective_category).filter((v): v is string => !!v));
  const regionId = mode(members.map((m) => m.region_id).filter((v): v is string => !!v));

  const timestamps = members.map((m) => new Date(m.reported_at).getTime());
  const firstSeenAt = new Date(Math.min(...timestamps)).toISOString();
  const lastSeenAt = new Date(Math.max(...timestamps)).toISOString();

  const label = await buildClusterLabel(supabase, category, regionId);

  await supabase
    .from("clusters")
    .update({
      label,
      category,
      region_id: regionId,
      centroid_lat: centroidLat,
      centroid_lng: centroidLng,
      member_count: members.length,
      first_seen_at: firstSeenAt,
      last_seen_at: lastSeenAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clusterId);
}

async function buildClusterLabel(
  supabase: SupabaseAdminClient,
  category: string | null,
  regionId: string | null
): Promise<string | null> {
  if (!category) return null;
  const categoryLabel = CATEGORIES.find((c) => c.slug === category)?.label ?? category;

  if (!regionId) return categoryLabel;

  const { data: region } = await supabase
    .from("regions")
    .select("name, parent_id")
    .eq("id", regionId)
    .single();

  if (!region) return categoryLabel;

  let kecamatanName = region.name as string;
  if (region.parent_id) {
    const { data: parent } = await supabase
      .from("regions")
      .select("name")
      .eq("id", region.parent_id as string)
      .single();
    if (parent) kecamatanName = parent.name as string;
  }

  return `${categoryLabel} — Kec. ${kecamatanName}`;
}

// ---------------------------------------------------------------------------
// Recompute penuh — dipakai oleh POST /api/cluster dan embed-seed.ts
// ---------------------------------------------------------------------------

export interface RecomputeResult {
  clustersCreated: number;
  complaintsProcessed: number;
}

/**
 * Mereset seluruh cluster lalu memproses ulang setiap aduan yang punya
 * embedding + koordinat secara berurutan waktu (reported_at ascending),
 * memakai runClustering() yang sama seperti alur incremental.
 */
export async function recomputeAllClusters(): Promise<RecomputeResult> {
  const supabase = createClient();

  await supabase.from("complaints").update({ cluster_id: null }).not("cluster_id", "is", null);
  await supabase.from("clusters").delete().gte("created_at", "1970-01-01T00:00:00Z");

  const { data: complaints, error } = await supabase
    .from("complaints")
    .select("id, reported_at, complaint_embeddings(embedding)")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("reported_at", { ascending: true })
    .returns<{ id: string; reported_at: string; complaint_embeddings: { embedding: unknown } | { embedding: unknown }[] | null }[]>();

  if (error) {
    throw new Error(`Gagal membaca aduan untuk clustering ulang: ${error.message}`);
  }

  let processed = 0;
  for (const row of complaints ?? []) {
    const embedding = unwrapEmbeddingRelation(row.complaint_embeddings);
    if (!embedding) continue;
    await runClustering(row.id);
    processed++;
  }

  const { count } = await supabase.from("clusters").select("id", { count: "exact", head: true });

  return { clustersCreated: count ?? 0, complaintsProcessed: processed };
}
