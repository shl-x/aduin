/**
 * src/lib/analytics/early-warning.ts
 *
 * Deteksi lonjakan aduan (z-score) sesuai ARCHITECTURE.md §5.2. Statistik
 * dihitung di Postgres oleh fungsi alert_window_stats
 * (supabase/migrations/0004_early_warning.sql): count_24h + baseline tepat
 * 14 jendela harian (generate_series, hari kosong = 0), per kombinasi
 * (effective_category, region_id).
 *
 * Dipakai oleh:
 *   - src/lib/services/triage.ts       (setelah triage berhasil — satu kombinasi)
 *   - POST /api/alert/check            (semua kombinasi)
 *   - supabase/seed/refresh-demo-timeline.ts
 *
 * Aturan deduplikasi (satu alert AKTIF per kombinasi):
 *   - Ada alert belum ditutup untuk kombinasi yang sama → statistiknya
 *     diperbarui (triggered_at ikut diperbarui jika alert itu sudah > 24 jam,
 *     artinya lonjakan baru). Tidak membuat alert ganda.
 *   - Tidak ada alert aktif (belum pernah ada, atau semuanya sudah ditutup
 *     operator) → alert baru (summary_status 'pending_retry'), lalu ringkasan
 *     AI di-await dengan timeout; berhasil → 'done'. Jadi jika lonjakan masih
 *     terdeteksi setelah alert ditutup, deteksi berikutnya membuat alert baru.
 *
 * alert_dismissals.alert_id bersifat UNIQUE, sehingga relasi embedded
 * `alert_dismissals` dikembalikan Supabase sebagai objek tunggal/null, bukan
 * array — selalu normalkan dengan toArray() sebelum dibaca.
 */

import type { createClient } from "@/lib/supabase/client";
import { runAlertSummary } from "@/lib/langflow/client";
import { CATEGORIES } from "@/lib/constants/categories";
import { toArray } from "@/lib/supabase/relations";

type AdminClient = ReturnType<typeof createClient>;

const THRESHOLD_Z = Number(process.env.ALERT_THRESHOLD_Z ?? "2.0");
const MIN_COUNT = Number(process.env.ALERT_MIN_COUNT ?? "3");
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SAMPLES = 5;

interface WindowStats {
  category: string;
  region_id: string;
  count_24h: number;
  mean_14d: number;
  std_14d: number;
  baseline_days: number;
}

export type EarlyWarningAction = "created" | "updated" | "below_threshold";

export interface EarlyWarningOutcome {
  category: string;
  region_id: string;
  count_24h: number;
  mean_14d: number;
  std_14d: number;
  z_score: number;
  action: EarlyWarningAction;
  alert_id: string | null;
  summary_status: "done" | "pending_retry" | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

async function fetchWindowStats(
  supabase: AdminClient,
  now: Date,
  filter?: { category: string; regionId: string }
): Promise<WindowStats[]> {
  const { data, error } = await supabase.rpc("alert_window_stats", {
    p_now: now.toISOString(),
    p_category: filter?.category ?? null,
    p_region_id: filter?.regionId ?? null,
  });
  if (error) {
    const hint =
      error.code === "PGRST202"
        ? " Terapkan migrasi supabase/migrations/0004_early_warning.sql."
        : "";
    throw new Error(`Gagal menghitung statistik early warning: ${error.message}.${hint}`);
  }
  return (data ?? []) as WindowStats[];
}

/** Menerapkan ambang + aturan deduplikasi untuk satu kombinasi. */
async function evaluate(
  supabase: AdminClient,
  stats: WindowStats,
  now: Date
): Promise<EarlyWarningOutcome> {
  const z = round2((stats.count_24h - stats.mean_14d) / stats.std_14d);
  const base: EarlyWarningOutcome = {
    category: stats.category,
    region_id: stats.region_id,
    count_24h: stats.count_24h,
    mean_14d: round2(stats.mean_14d),
    std_14d: round2(stats.std_14d),
    z_score: z,
    action: "below_threshold",
    alert_id: null,
    summary_status: null,
  };

  if (z < THRESHOLD_Z || stats.count_24h < MIN_COUNT) return base;

  const { data: existing, error: existingErr } = await supabase
    .from("alerts")
    .select("id, triggered_at, summary_status, alert_dismissals(id)")
    .eq("category", stats.category)
    .eq("region_id", stats.region_id)
    .order("triggered_at", { ascending: false })
    .limit(20);
  if (existingErr) throw new Error(`Gagal membaca alert: ${existingErr.message}`);

  const rows = (existing ?? []) as {
    id: string;
    triggered_at: string;
    summary_status: "done" | "pending_retry";
    alert_dismissals: { id: string } | { id: string }[] | null;
  }[];

  const active = rows.find((r) => toArray(r.alert_dismissals).length === 0);
  if (active) {
    const stale = now.getTime() - new Date(active.triggered_at).getTime() > DAY_MS;
    const { error: updateErr } = await supabase
      .from("alerts")
      .update({
        count_24h: stats.count_24h,
        mean_14d: base.mean_14d,
        std_14d: base.std_14d,
        z_score: z,
        ...(stale ? { triggered_at: now.toISOString() } : {}),
      })
      .eq("id", active.id);
    if (updateErr) throw new Error(`Gagal memperbarui alert: ${updateErr.message}`);

    let summaryStatus = active.summary_status;
    if (summaryStatus === "pending_retry") {
      summaryStatus = (await generateAlertSummary(supabase, active.id, now)).ok ? "done" : "pending_retry";
    }
    return { ...base, action: "updated", alert_id: active.id, summary_status: summaryStatus };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("alerts")
    .insert({
      category: stats.category,
      region_id: stats.region_id,
      count_24h: stats.count_24h,
      mean_14d: base.mean_14d,
      std_14d: base.std_14d,
      z_score: z,
      summary_status: "pending_retry",
      triggered_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    throw new Error(`Gagal menyimpan alert: ${insertErr?.message ?? "unknown"}`);
  }

  const summary = await generateAlertSummary(supabase, inserted.id, now);
  return {
    ...base,
    action: "created",
    alert_id: inserted.id,
    summary_status: summary.ok ? "done" : "pending_retry",
  };
}

/**
 * Memanggil aduin-alert-summary untuk alert yang sudah tersimpan, lalu
 * mengisi ai_summary + ai_recommendations (summary_status = 'done').
 * Gagal → alert dibiarkan 'pending_retry' (tombol "Coba Lagi" di /alert).
 */
export async function generateAlertSummary(
  supabase: AdminClient,
  alertId: string,
  now: Date = new Date()
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: alert, error } = await supabase
    .from("alerts")
    .select("id, category, region_id, count_24h, mean_14d, z_score, region:region_id(name)")
    .eq("id", alertId)
    .maybeSingle();
  if (error || !alert) return { ok: false, error: "Alert tidak ditemukan." };

  const { data: samples } = await supabase
    .from("complaints")
    .select("text")
    .eq("effective_category", alert.category)
    .eq("region_id", alert.region_id)
    .lte("reported_at", now.toISOString())
    .order("reported_at", { ascending: false })
    .limit(MAX_SAMPLES);

  const complaintSamples = (samples ?? [])
    .map((s, i) => `${i + 1}. ${String(s.text).replace(/\s+/g, " ").trim()}`)
    .join("\n");

  const region = alert.region as unknown as { name: string } | null;
  const result = await runAlertSummary({
    category_label: categoryLabel(alert.category),
    region_name: region?.name ?? "Tidak diketahui",
    count_24h: alert.count_24h,
    mean_14d: round2(alert.mean_14d),
    z_score: round2(alert.z_score),
    complaint_samples: complaintSamples,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const { error: updateErr } = await supabase
    .from("alerts")
    .update({
      ai_summary: result.data.ai_summary,
      ai_recommendations: result.data.opd_list,
      summary_status: "done",
    })
    .eq("id", alertId);
  if (updateErr) return { ok: false, error: updateErr.message };
  return { ok: true };
}

/** Deteksi untuk satu kombinasi kategori + wilayah. */
export async function checkEarlyWarning(
  supabase: AdminClient,
  category: string,
  regionId: string,
  now: Date = new Date()
): Promise<EarlyWarningOutcome | null> {
  const [stats] = await fetchWindowStats(supabase, now, { category, regionId });
  return stats ? evaluate(supabase, stats, now) : null;
}

/** Deteksi untuk kombinasi milik satu aduan (dipanggil setelah triage berhasil). */
export async function checkEarlyWarningForComplaint(
  supabase: AdminClient,
  complaintId: string
): Promise<EarlyWarningOutcome | null> {
  const { data: complaint } = await supabase
    .from("complaints")
    .select("effective_category, region_id")
    .eq("id", complaintId)
    .maybeSingle();
  if (!complaint?.effective_category || !complaint.region_id) return null;
  return checkEarlyWarning(supabase, complaint.effective_category, complaint.region_id);
}

/** Deteksi untuk semua kombinasi yang punya aduan dalam 24 jam terakhir. */
export async function checkAllEarlyWarnings(
  supabase: AdminClient,
  now: Date = new Date()
): Promise<EarlyWarningOutcome[]> {
  const allStats = await fetchWindowStats(supabase, now);
  const outcomes: EarlyWarningOutcome[] = [];
  // Berurutan, bukan paralel: setiap alert baru memanggil Langflow.
  for (const stats of allStats) {
    outcomes.push(await evaluate(supabase, stats, now));
  }
  return outcomes;
}

export interface ActiveAlert {
  id: string;
  category: string;
  category_label: string;
  region_id: string | null;
  region_name: string | null;
  kecamatan_name: string | null;
  count_24h: number;
  mean_14d: number;
  std_14d: number;
  z_score: number;
  ai_summary: string | null;
  opd_list: string[];
  summary_status: "done" | "pending_retry";
  is_seed: boolean;
  triggered_at: string;
}

/** Alert yang belum ditutup operator, terbaru dulu. */
export async function getActiveAlerts(supabase: AdminClient): Promise<ActiveAlert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select(
      "id, category, region_id, count_24h, mean_14d, std_14d, z_score, ai_summary, ai_recommendations, summary_status, is_seed, triggered_at, region:region_id(name, parent:parent_id(name)), alert_dismissals(id)"
    )
    .order("triggered_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Gagal memuat alert: ${error.message}`);

  return (data ?? [])
    .filter((a) => toArray(a.alert_dismissals as unknown).length === 0)
    .map((a) => {
      const region = a.region as unknown as { name: string; parent: { name: string } | null } | null;
      return {
        id: a.id,
        category: a.category,
        category_label: categoryLabel(a.category),
        region_id: a.region_id,
        region_name: region?.name ?? null,
        kecamatan_name: region?.parent?.name ?? null,
        count_24h: a.count_24h,
        mean_14d: a.mean_14d,
        std_14d: a.std_14d,
        z_score: a.z_score,
        ai_summary: a.ai_summary,
        opd_list: Array.isArray(a.ai_recommendations) ? (a.ai_recommendations as string[]) : [],
        summary_status: a.summary_status as ActiveAlert["summary_status"],
        is_seed: a.is_seed,
        triggered_at: a.triggered_at,
      };
    });
}
