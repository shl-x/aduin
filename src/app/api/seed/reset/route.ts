/**
 * src/app/api/seed/reset/route.ts
 *
 * POST /api/seed/reset
 *
 * Hanya aktif jika NEXT_PUBLIC_DEMO_MODE=true.
 * Menghapus semua data is_seed=true lalu menjalankan ulang seed.
 * Mengembalikan { seeded: n }.
 *
 * Tidak memerlukan auth — hanya bisa dipanggil di environment demo.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Endpoint ini hanya tersedia di mode demo." },
      { status: 403 }
    );
  }

  const supabase = createClient();

  try {
    // ── 1. Hapus data seed dari semua tabel terkait ──────────────────────────
    // Urutan: mulai dari tabel yang FK-nya mengarah ke complaints / alerts
    await supabase.from("alert_dismissals").delete().in(
      "alert_id",
      (await supabase.from("alerts").select("id").eq("is_seed", true)).data?.map(
        (r: { id: string }) => r.id
      ) ?? []
    );
    await supabase.from("alerts").delete().eq("is_seed", true);

    // complaint-dependent tables
    const { data: seedComplaints } = await supabase
      .from("complaints")
      .select("id")
      .eq("is_seed", true);
    const seedIds: string[] = (seedComplaints ?? []).map(
      (r: { id: string }) => r.id
    );

    if (seedIds.length > 0) {
      await supabase.from("citizen_confirmations").delete().in("complaint_id", seedIds);
      await supabase.from("verifications").delete().in("complaint_id", seedIds);
      // task_dependencies cascades from tasks; tasks cascade from coordination_plans
      await supabase.from("coordination_plans").delete().in("complaint_id", seedIds);
      await supabase.from("triage_overrides").delete().in("complaint_id", seedIds);
      await supabase.from("triage_results").delete().in("complaint_id", seedIds);
      await supabase.from("complaint_embeddings").delete().in("complaint_id", seedIds);
      await supabase.from("ai_cache").delete().in("complaint_id", seedIds);
    }

    await supabase.from("complaints").delete().eq("is_seed", true);

    // profiles → akun demo
    const { data: demoProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_demo", true);
    const demoIds: string[] = (demoProfiles ?? []).map(
      (r: { id: string }) => r.id
    );
    if (demoIds.length > 0) {
      await supabase.from("profiles").delete().in("id", demoIds);
      for (const uid of demoIds) {
        await supabase.auth.admin.deleteUser(uid);
      }
    }

    // ── 2. Jalankan ulang seed ───────────────────────────────────────────────
    // Dynamic import agar tidak di-bundle ke edge runtime
    const { seedRegions } = await import("../../../../../supabase/seed/regions");
    const { seedOpd } = await import("../../../../../supabase/seed/opd");
    const { seedAccounts } = await import(
      "../../../../../supabase/seed/accounts"
    );
    const { seedComplaints: runSeedComplaints } = await import(
      "../../../../../supabase/seed/complaints"
    );

    await seedRegions();
    await seedOpd();
    await seedAccounts();
    const seeded = await runSeedComplaints();

    return NextResponse.json({ seeded });
  } catch (err) {
    console.error("[/api/seed/reset] Error:", err);
    return NextResponse.json(
      {
        error: `Reset seed gagal: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
