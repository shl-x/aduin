/**
 * supabase/seed/refresh-demo-timeline.ts
 *
 * CLI untuk refreshDemoTimeline() (src/lib/demo/refresh-timeline.ts):
 * geser timeline data seed agar aduan diare Sumberasih terbaru berada ±2 jam
 * sebelum sekarang, lalu jalankan early warning untuk semua kombinasi dan
 * cetak alert yang terbentuk.
 *
 * Aman dijalankan berulang kali (termasuk di hari demo): selisih dihitung
 * ulang setiap kali, sehingga run kedua menghasilkan selisih ≈ 0 dan
 * pergeseran dilewati. Alert aktif diperbarui, bukan diduplikasi; jika
 * alert sebelumnya sudah ditutup dan lonjakan masih ada, alert baru dibuat.
 *
 * Prasyarat: migrasi supabase/migrations/0004_early_warning.sql sudah
 * diterapkan.
 *
 * Jalankan:
 *   npx tsx --env-file=.env.local supabase/seed/refresh-demo-timeline.ts
 */

import { createClient } from "../../src/lib/supabase/client";
import { categoryLabel } from "../../src/lib/analytics/early-warning";
import { refreshDemoTimeline, TARGET_HOURS_AGO, type RefreshTimelineReport } from "../../src/lib/demo/refresh-timeline";

function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `${sign}${d} hari ${h} jam ${m} menit`;
}

function printRefreshReport(report: RefreshTimelineReport): void {
  console.log(`🕒 Sekarang            : ${report.now}`);
  console.log(`   Diare terbaru (seed): ${report.anchorReportedAt}`);
  console.log(`   Target              : ${report.target} (${TARGET_HOURS_AGO} jam lalu)`);
  if (report.deltaSeconds === 0) {
    console.log("✅ Timeline sudah segar — tidak ada yang digeser.\n");
  } else {
    console.log(`   Selisih             : ${formatDuration(report.deltaSeconds)}`);
    console.log(`✅ ${report.shiftedComplaints} aduan seed (beserta data terkait) digeser.\n`);
  }

  const triggered = report.outcomes.filter((o) => o.action !== "below_threshold");
  console.log("🔎 Early warning untuk semua kombinasi:");
  console.log(`   ${report.outcomes.length} kombinasi diperiksa, ${triggered.length} melewati ambang.`);
  for (const o of triggered) {
    const label = o.action === "created" ? "BARU" : "DIPERBARUI";
    console.log(
      `   • [${label}] ${categoryLabel(o.category)} — count_24h=${o.count_24h}, mean_14d=${o.mean_14d}, std=${o.std_14d}, z=${o.z_score}` +
        (o.summary_status ? `, ringkasan=${o.summary_status}` : "")
    );
  }

  console.log(`\n🚨 Alert aktif (${report.activeAlerts.length}):`);
  for (const a of report.activeAlerts) {
    console.log(
      `   • ${a.category_label} — ${a.region_name ?? "?"}: ${a.count_24h} aduan/24 jam vs ${a.mean_14d}/hari, z=${a.z_score}, ringkasan=${a.summary_status}`
    );
  }
  if (report.activeAlerts.length === 0) console.log("   (tidak ada)");
}

refreshDemoTimeline(createClient())
  .then(printRefreshReport)
  .catch((err) => {
    console.error("\n❌ refresh-demo-timeline gagal:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
