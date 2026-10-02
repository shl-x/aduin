/**
 * src/app/api/analytics/opd-ranking/route.ts
 *
 * GET /api/analytics/opd-ranking — peringkat kinerja OPD (% selesai, rata-rata jam penyelesaian).
 * Pimpinan & operator. Data murni dari database (src/lib/analytics/dashboard.ts).
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { loadComplaintFacts, computeOpdRanking } from "@/lib/analytics/dashboard";

export async function GET(): Promise<NextResponse> {
  const role = await getSessionRole();
  if (role !== "pimpinan" && role !== "operator") {
    return NextResponse.json({ error: "Hanya pimpinan dan operator." }, { status: 403 });
  }

  try {
    const supabase = createClient();
    const [facts, { data: opds, error }] = await Promise.all([
      loadComplaintFacts(supabase),
      supabase.from("opd").select("id, short_name, name"),
    ]);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ranking: computeOpdRanking(facts, opds ?? []) });
  } catch (err) {
    console.error("[/api/analytics/opd-ranking]", err);
    return NextResponse.json({ error: "Gagal memuat data analitik." }, { status: 500 });
  }
}
