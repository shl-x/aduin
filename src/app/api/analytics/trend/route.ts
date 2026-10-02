/**
 * src/app/api/analytics/trend/route.ts
 *
 * GET /api/analytics/trend?days=7|30|90 — tren aduan per kategori (90 hari dikelompokkan per minggu).
 * Pimpinan & operator. Data murni dari database (src/lib/analytics/dashboard.ts).
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { loadComplaintFacts, computeTrend, parseTrendRange } from "@/lib/analytics/dashboard";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await getSessionRole();
  if (role !== "pimpinan" && role !== "operator") {
    return NextResponse.json({ error: "Hanya pimpinan dan operator." }, { status: 403 });
  }

  try {
    const days = parseTrendRange(new URL(request.url).searchParams.get("days"));
    const facts = await loadComplaintFacts(createClient());
    return NextResponse.json(computeTrend(facts, days));
  } catch (err) {
    console.error("[/api/analytics/trend]", err);
    return NextResponse.json({ error: "Gagal memuat data analitik." }, { status: 500 });
  }
}
