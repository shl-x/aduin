/**
 * supabase/seed/refresh-demo-timeline.ts
 *
 * Menyegarkan timeline data seed agar skenario demo selalu "sedang terjadi":
 *
 *   1. Cari aduan seed diare Sumberasih yang PALING BARU (label_manual =
 *      kesehatan_diare, wilayah bernama "Sumberasih" — kecamatan maupun desa).
 *   2. Hitung selisih agar aduan itu berada ±2 jam sebelum sekarang.
 *   3. Geser reported_at, closed_at, dan semua timestamp terkait data seed
 *      dengan selisih yang SAMA lewat fungsi Postgres shift_seed_timeline
 *      (satu transaksi — pola relatif antar-aduan tidak berubah).
 *   4. Jalankan early warning untuk semua kombinasi dan cetak hasilnya.
 *
 * Aman dijalankan berulang kali (termasuk di hari demo): selisih dihitung
 * ulang setiap kali, sehingga run kedua menghasilkan selisih ≈ 0 dan
 * pergeseran dilewati. Alert yang sudah ada diperbarui, bukan diduplikasi.
 *
 * Prasyarat: migrasi supabase/migrations/0004_early_warning.sql sudah
 * diterapkan.
 *
 * Jalankan:
 *   npx tsx --env-file=.env.local supabase/seed/refresh-demo-timeline.ts
 */

import { createClient } from "../../src/lib/supabase/client";
import { checkAllEarlyWarnings, getActiveAlerts, categoryLabel } from "../../src/lib/analytics/early-warning";

const ANCHOR_CATEGORY = "kesehatan_diare";
const ANCHOR_REGION_NAME = "Sumberasih";
const TARGET_HOURS_AGO = 2;
/** Selisih di bawah ini dianggap sudah segar — tidak perlu digeser. */
const MIN_SHIFT_SECONDS = 60;

function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `${sign}${d} hari ${h} jam ${m} menit`;
}

async function main(): Promise<void> {
  const supabase = createClient();
  const now = new Date();

  const { data: regions, error: regionErr } = await supabase
    .from("regions")
    .select("id")
    .eq("name", ANCHOR_REGION_NAME);
  if (regionErr) throw new Error(`Gagal membaca wilayah: ${regionErr.message}`);
  const regionIds = (regions ?? []).map((r) => r.id);
  if (regionIds.length === 0) throw new Error(`Wilayah "${ANCHOR_REGION_NAME}" tidak ditemukan. Jalankan seed dulu.`);

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
  const deltaSeconds = Math.round((target - new Date(anchor.reported_at).getTime()) / 1000);

  console.log(`🕒 Sekarang            : ${now.toISOString()}`);
  console.log(`   Diare terbaru (seed): ${anchor.reported_at}`);
  console.log(`   Target              : ${new Date(target).toISOString()} (${TARGET_HOURS_AGO} jam lalu)`);

  if (Math.abs(deltaSeconds) < MIN_SHIFT_SECONDS) {
    console.log("✅ Timeline sudah segar — tidak ada yang digeser.\n");
  } else {
    console.log(`   Selisih             : ${formatDuration(deltaSeconds)}`);
    const { data: shifted, error: shiftErr } = await supabase.rpc("shift_seed_timeline", {
      p_delta: `${deltaSeconds} seconds`,
    });
    if (shiftErr) {
      const hint =
        shiftErr.code === "PGRST202" ? " Terapkan migrasi supabase/migrations/0004_early_warning.sql." : "";
      throw new Error(`Gagal menggeser timeline: ${shiftErr.message}.${hint}`);
    }
    console.log(`✅ ${shifted} aduan seed (beserta data terkait) digeser.\n`);
  }

  console.log("🔎 Menjalankan early warning untuk semua kombinasi…");
  const outcomes = await checkAllEarlyWarnings(supabase, new Date());
  const triggered = outcomes.filter((o) => o.action !== "below_threshold");
  console.log(`   ${outcomes.length} kombinasi diperiksa, ${triggered.length} melewati ambang.`);
  for (const o of triggered) {
    const label = {
      created: "BARU",
      updated: "DIPERBARUI",
      skipped_dismissed: "DILEWATI (ditutup < 24 jam lalu)",
      below_threshold: "",
    }[o.action];
    console.log(
      `   • [${label}] ${categoryLabel(o.category)} — count_24h=${o.count_24h}, mean_14d=${o.mean_14d}, std=${o.std_14d}, z=${o.z_score}` +
        (o.summary_status ? `, ringkasan=${o.summary_status}` : "")
    );
  }

  const active = await getActiveAlerts(supabase);
  console.log(`\n🚨 Alert aktif (${active.length}):`);
  for (const a of active) {
    console.log(
      `   • ${a.category_label} — ${a.region_name ?? "?"}: ${a.count_24h} aduan/24 jam vs ${a.mean_14d}/hari, z=${a.z_score}, ringkasan=${a.summary_status}`
    );
  }
  if (active.length === 0) console.log("   (tidak ada)");
}

main().catch((err) => {
  console.error("\n❌ refresh-demo-timeline gagal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
