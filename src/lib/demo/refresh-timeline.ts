/**
 * src/lib/demo/refresh-timeline.ts
 *
 * Menyegarkan timeline data seed agar skenario demo selalu "sedang terjadi",
 * lalu menjalankan early warning untuk semua kombinasi. Dipakai bersama oleh:
 *   - supabase/seed/refresh-demo-timeline.ts (CLI)
 *   - supabase/seed/demo-state.ts (seed utama & tombol "Reset Demo")
 *
 * 1. Cari aduan seed diare Sumberasih yang PALING BARU (label_manual =
 *    kesehatan_diare, wilayah bernama "Sumberasih" — kecamatan maupun desa).
 * 2. Hitung selisih agar aduan itu berada ±2 jam sebelum sekarang.
 * 3. Geser semua timestamp seed dengan selisih yang SAMA lewat fungsi
 *    Postgres shift_seed_timeline (satu transaksi — pola relatif tetap).
 * 4. checkAllEarlyWarnings().
 *
 * Aman dijalankan berulang kali: selisih dihitung ulang setiap kali, dan
 * selisih < 60 detik dianggap sudah segar (tidak digeser).
 */

import type { createClient } from "@/lib/supabase/client";
import {
  checkAllEarlyWarnings,
  getActiveAlerts,
  type ActiveAlert,
  type EarlyWarningOutcome,
} from "@/lib/analytics/early-warning";

type AdminClient = ReturnType<typeof createClient>;

const ANCHOR_CATEGORY = "kesehatan_diare";
const ANCHOR_REGION_NAME = "Sumberasih";
export const TARGET_HOURS_AGO = 2;
const MIN_SHIFT_SECONDS = 60;

export interface RefreshTimelineReport {
  now: string;
  anchorReportedAt: string;
  target: string;
  /** 0 jika timeline sudah segar (tidak digeser). */
  deltaSeconds: number;
  shiftedComplaints: number;
  outcomes: EarlyWarningOutcome[];
  activeAlerts: ActiveAlert[];
}

export async function refreshDemoTimeline(supabase: AdminClient): Promise<RefreshTimelineReport> {
  const now = new Date();

  const { data: regions, error: regionErr } = await supabase
    .from("regions")
    .select("id")
    .eq("name", ANCHOR_REGION_NAME);
  if (regionErr) throw new Error(`Gagal membaca wilayah: ${regionErr.message}`);
  const regionIds = (regions ?? []).map((r) => r.id);
  if (regionIds.length === 0) {
    throw new Error(`Wilayah "${ANCHOR_REGION_NAME}" tidak ditemukan. Jalankan seed dulu.`);
  }

  const { data: anchor, error: anchorErr } = await supabase
    .from("complaints")
    .select("id, reported_at")
    .eq("is_seed", true)
    .eq("label_manual", ANCHOR_CATEGORY)
    .in("region_id", regionIds)
    .order("reported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (anchorErr) throw new Error(`Gagal membaca aduan jangkar: ${anchorErr.message}`);
  if (!anchor) throw new Error("Aduan seed diare Sumberasih tidak ditemukan. Jalankan seed dulu.");

  const target = now.getTime() - TARGET_HOURS_AGO * 60 * 60 * 1000;
  let deltaSeconds = Math.round((target - new Date(anchor.reported_at).getTime()) / 1000);
  let shiftedComplaints = 0;

  if (Math.abs(deltaSeconds) < MIN_SHIFT_SECONDS) {
    deltaSeconds = 0;
  } else {
    const { data: shifted, error: shiftErr } = await supabase.rpc("shift_seed_timeline", {
      p_delta: `${deltaSeconds} seconds`,
    });
    if (shiftErr) {
      const hint =
        shiftErr.code === "PGRST202" ? " Terapkan migrasi supabase/migrations/0004_early_warning.sql." : "";
      throw new Error(`Gagal menggeser timeline: ${shiftErr.message}.${hint}`);
    }
    shiftedComplaints = Number(shifted ?? 0);
  }

  const outcomes = await checkAllEarlyWarnings(supabase, new Date());
  const activeAlerts = await getActiveAlerts(supabase);

  return {
    now: now.toISOString(),
    anchorReportedAt: anchor.reported_at,
    target: new Date(target).toISOString(),
    deltaSeconds,
    shiftedComplaints,
    outcomes,
    activeAlerts,
  };
}
