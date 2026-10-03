/**
 * src/app/api/seed/reset/route.ts
 *
 * POST /api/seed/reset — tombol "Reset Demo".
 *
 * Hanya aktif jika NEXT_PUBLIC_DEMO_MODE=true, dan hanya untuk operator.
 * Memulihkan keadaan demo lewat buildDemoState() (supabase/seed/demo-state.ts):
 * aduan seed + hasil AI dari ai-cache-snapshot.json, menghapus aduan latihan
 * (non-seed), lalu menggeser timeline dan menjalankan early warning.
 * Akun demo tidak dihapus dan password-nya tidak diubah, sehingga sesi
 * operator yang menekan tombol tetap berlaku.
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";

export async function POST(): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Reset demo hanya tersedia di mode demo." }, { status: 403 });
  }

  const role = await getSessionRole();
  if (role !== "operator") {
    return NextResponse.json({ error: "Hanya operator yang dapat mereset demo." }, { status: 403 });
  }

  try {
    // Dynamic import: modul seed hanya dimuat saat tombol ditekan.
    const { buildDemoState } = await import("../../../../../supabase/seed/demo-state");
    const result = await buildDemoState({ syncPasswords: false });
    const diare = result.timeline.activeAlerts.find((a) => a.category === "kesehatan_diare");

    return NextResponse.json({
      seeded: result.seededComplaints,
      deleted_practice_complaints: result.deletedNonSeedComplaints,
      snapshot_found: result.snapshotFound,
      restored: result.snapshot,
      clusters: result.clusters,
      alerts: result.timeline.activeAlerts.length,
      diare_alert: diare
        ? { z_score: diare.z_score, count_24h: diare.count_24h, summary_status: diare.summary_status }
        : null,
    });
  } catch (err) {
    console.error("[/api/seed/reset]", err);
    return NextResponse.json(
      { error: `Reset demo gagal: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
