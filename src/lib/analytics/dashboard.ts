/**
 * src/lib/analytics/dashboard.ts
 *
 * Agregasi dashboard pimpinan (/ringkasan) — murni dari database, tidak
 * pernah memanggil Langflow. Dipakai oleh halaman /ringkasan (dipanggil
 * langsung dari Server Component) dan GET /api/analytics/*.
 *
 * Volume data MVP kecil (ratusan aduan), jadi agregasi dilakukan di server
 * setelah satu kali baca tabel (dipaginasi agar tidak terpotong limit 1000
 * baris PostgREST). Pengelompokan tanggal memakai zona WIB (UTC+7).
 */

import type { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/constants/categories";

type AdminClient = ReturnType<typeof createClient>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WIB_OFFSET_MS = 7 * HOUR_MS;
const PAGE_SIZE = 1000;

export const TREND_RANGES = [7, 30, 90] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

export function parseTrendRange(value: string | null | undefined): TrendRange {
  const n = Number(value);
  return (TREND_RANGES as readonly number[]).includes(n) ? (n as TrendRange) : 30;
}

interface ComplaintFact {
  id: string;
  status: string;
  effective_category: string | null;
  effective_opd_id: string | null;
  region_id: string | null;
  reported_at: string;
  closed_at: string | null;
}

async function loadComplaintFacts(supabase: AdminClient): Promise<ComplaintFact[]> {
  const rows: ComplaintFact[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("complaints")
      .select("id, status, effective_category, effective_opd_id, region_id, reported_at, closed_at")
      .order("reported_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Gagal memuat aduan: ${error.message}`);
    rows.push(...((data ?? []) as ComplaintFact[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function resolutionHours(c: ComplaintFact): number | null {
  if (c.status !== "closed" || !c.closed_at) return null;
  const h = (new Date(c.closed_at).getTime() - new Date(c.reported_at).getTime()) / HOUR_MS;
  return h >= 0 ? h : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : round1(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Indeks hari WIB (jumlah hari sejak epoch) — dasar pengelompokan tren. */
function wibDayIndex(iso: string | Date): number {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return Math.floor((t + WIB_OFFSET_MS) / DAY_MS);
}

function dayLabel(dayIndex: number): string {
  return new Date(dayIndex * DAY_MS).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

export interface Kpi {
  total_complaints: number;
  total_30d: number;
  closed_count: number;
  closed_pct: number;
  avg_resolution_hours: number | null;
}

export function computeKpi(facts: ComplaintFact[], now: Date = new Date()): Kpi {
  const since30 = now.getTime() - 30 * DAY_MS;
  const closed = facts.filter((c) => c.status === "closed");
  const hours = facts.map(resolutionHours).filter((h): h is number => h !== null);
  return {
    total_complaints: facts.length,
    total_30d: facts.filter((c) => new Date(c.reported_at).getTime() >= since30).length,
    closed_count: closed.length,
    closed_pct: facts.length === 0 ? 0 : round1((closed.length / facts.length) * 100),
    avg_resolution_hours: average(hours),
  };
}

// ---------------------------------------------------------------------------
// Tren per kategori
// ---------------------------------------------------------------------------

export interface TrendPoint {
  label: string;
  total: number;
  /** jumlah per slug kategori; slug yang tidak muncul bernilai 0 */
  counts: Record<string, number>;
}

export interface Trend {
  days: TrendRange;
  granularity: "harian" | "mingguan";
  points: TrendPoint[];
}

/** 7/30 hari → per hari; 90 hari → per minggu (13 kelompok 7 hari, berakhir hari ini). */
export function computeTrend(facts: ComplaintFact[], days: TrendRange, now: Date = new Date()): Trend {
  const today = wibDayIndex(now);
  const firstDay = today - (days - 1);
  const weekly = days === 90;
  const bucketSize = weekly ? 7 : 1;
  const bucketCount = Math.ceil(days / bucketSize);

  const points: TrendPoint[] = Array.from({ length: bucketCount }, (_, i) => {
    // Bucket terakhir berakhir hari ini; hitung mundur.
    const end = today - (bucketCount - 1 - i) * bucketSize;
    const start = Math.max(end - bucketSize + 1, firstDay);
    return {
      label: weekly ? `${dayLabel(start)}–${dayLabel(end)}` : dayLabel(end),
      total: 0,
      counts: Object.fromEntries(CATEGORIES.map((c) => [c.slug, 0])),
    };
  });

  for (const c of facts) {
    if (!c.effective_category) continue;
    const day = wibDayIndex(c.reported_at);
    if (day < firstDay || day > today) continue;
    const idx = bucketCount - 1 - Math.floor((today - day) / bucketSize);
    const point = points[idx];
    if (!point || !(c.effective_category in point.counts)) continue;
    point.counts[c.effective_category] += 1;
    point.total += 1;
  }

  return { days, granularity: weekly ? "mingguan" : "harian", points };
}

// ---------------------------------------------------------------------------
// Sebaran per kecamatan
// ---------------------------------------------------------------------------

export interface RegionCount {
  kecamatan: string;
  total: number;
  active: number;
}

export function computeRegionDistribution(
  facts: ComplaintFact[],
  regions: { id: string; name: string; level: string; parent_id: string | null }[],
  days: TrendRange,
  now: Date = new Date()
): RegionCount[] {
  const byId = new Map(regions.map((r) => [r.id, r]));
  const since = wibDayIndex(now) - (days - 1);
  const result = new Map<string, RegionCount>();
  for (const r of regions) {
    if (r.level === "kecamatan") result.set(r.id, { kecamatan: r.name, total: 0, active: 0 });
  }

  for (const c of facts) {
    if (!c.region_id || wibDayIndex(c.reported_at) < since) continue;
    const region = byId.get(c.region_id);
    const kecamatanId = region?.level === "kecamatan" ? region.id : region?.parent_id;
    const bucket = kecamatanId ? result.get(kecamatanId) : undefined;
    if (!bucket) continue;
    bucket.total += 1;
    if (c.status !== "closed") bucket.active += 1;
  }

  return [...result.values()].sort((a, b) => b.total - a.total || a.kecamatan.localeCompare(b.kecamatan));
}

// ---------------------------------------------------------------------------
// Peringkat kinerja OPD
// ---------------------------------------------------------------------------

export interface OpdRanking {
  rank: number;
  opd_id: string;
  short_name: string;
  name: string;
  total: number;
  active: number;
  closed: number;
  closed_pct: number;
  avg_resolution_hours: number | null;
}

/**
 * Peringkat berdasarkan % aduan selesai (closed), lalu rata-rata waktu
 * penyelesaian tercepat, lalu volume. OPD tanpa aduan tidak ditampilkan.
 */
export function computeOpdRanking(
  facts: ComplaintFact[],
  opds: { id: string; short_name: string; name: string }[]
): OpdRanking[] {
  const rows = opds
    .map((o) => {
      const mine = facts.filter((c) => c.effective_opd_id === o.id);
      const closed = mine.filter((c) => c.status === "closed");
      return {
        rank: 0,
        opd_id: o.id,
        short_name: o.short_name,
        name: o.name,
        total: mine.length,
        active: mine.length - closed.length,
        closed: closed.length,
        closed_pct: mine.length === 0 ? 0 : round1((closed.length / mine.length) * 100),
        avg_resolution_hours: average(mine.map(resolutionHours).filter((h): h is number => h !== null)),
      };
    })
    .filter((r) => r.total > 0)
    .sort(
      (a, b) =>
        b.closed_pct - a.closed_pct ||
        (a.avg_resolution_hours ?? Infinity) - (b.avg_resolution_hours ?? Infinity) ||
        b.total - a.total
    );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

// ---------------------------------------------------------------------------
// Loader gabungan
// ---------------------------------------------------------------------------

export interface DashboardData {
  kpi: Kpi;
  trend: Trend;
  regions: RegionCount[];
  opdRanking: OpdRanking[];
}

export async function loadDashboard(supabase: AdminClient, days: TrendRange): Promise<DashboardData> {
  const now = new Date();
  const [facts, { data: regions, error: regionErr }, { data: opds, error: opdErr }] = await Promise.all([
    loadComplaintFacts(supabase),
    supabase.from("regions").select("id, name, level, parent_id"),
    supabase.from("opd").select("id, short_name, name"),
  ]);
  if (regionErr) throw new Error(`Gagal memuat wilayah: ${regionErr.message}`);
  if (opdErr) throw new Error(`Gagal memuat OPD: ${opdErr.message}`);

  return {
    kpi: computeKpi(facts, now),
    trend: computeTrend(facts, days, now),
    regions: computeRegionDistribution(facts, regions ?? [], days, now),
    opdRanking: computeOpdRanking(facts, opds ?? []),
  };
}

export { loadComplaintFacts };
