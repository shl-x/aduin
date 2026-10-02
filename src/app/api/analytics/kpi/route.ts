/**
 * src/app/api/analytics/kpi/route.ts
 *
 * GET /api/analytics/kpi — total_complaints, total_30d, avg_resolution_hours, closed_pct.
 * Pimpinan & operator. Data murni dari database (src/lib/analytics/dashboard.ts).
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { loadComplaintFacts, computeKpi } from "@/lib/analytics/dashboard";

export async function GET(): Promise<NextResponse> {
  const role = await getSessionRole();
  if (role !== "pimpinan" && role !== "operator") {
    return NextResponse.json({ error: "Hanya pimpinan dan operator." }, { status: 403 });
  }

  try {
    const facts = await loadComplaintFacts(createClient());
    return NextResponse.json(computeKpi(facts));
  } catch (err) {
    console.error("[/api/analytics/kpi]", err);
    return NextResponse.json({ error: "Gagal memuat data analitik." }, { status: 500 });
  }
}
