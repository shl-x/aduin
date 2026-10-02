/**
 * src/app/api/analytics/regions/route.ts
 *
 * GET /api/analytics/regions?days=7|30|90 — sebaran aduan per kecamatan.
 * Pimpinan & operator. Data murni dari database (src/lib/analytics/dashboard.ts).
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { loadComplaintFacts, computeRegionDistribution, parseTrendRange } from "@/lib/analytics/dashboard";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await getSessionRole();
  if (role !== "pimpinan" && role !== "operator") {
    return NextResponse.json({ error: "Hanya pimpinan dan operator." }, { status: 403 });
  }

  try {
    const days = parseTrendRange(new URL(request.url).searchParams.get("days"));
    const supabase = createClient();
    const [facts, { data: regions, error }] = await Promise.all([
      loadComplaintFacts(supabase),
      supabase.from("regions").select("id, name, level, parent_id"),
    ]);
    if (error) throw new Error(error.message);
    return NextResponse.json({ days, regions: computeRegionDistribution(facts, regions ?? [], days) });
  } catch (err) {
    console.error("[/api/analytics/regions]", err);
    return NextResponse.json({ error: "Gagal memuat data analitik." }, { status: 500 });
  }
}
