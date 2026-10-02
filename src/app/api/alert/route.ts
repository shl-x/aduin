/**
 * src/app/api/alert/route.ts
 *
 * GET /api/alert — daftar alert aktif (belum ditutup) beserta ringkasan AI
 * dan rekomendasi OPD. Operator & pimpinan.
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { getActiveAlerts } from "@/lib/analytics/early-warning";

export async function GET(): Promise<NextResponse> {
  const role = await getSessionRole();
  if (role !== "operator" && role !== "pimpinan") {
    return NextResponse.json({ error: "Hanya operator dan pimpinan." }, { status: 403 });
  }

  try {
    const alerts = await getActiveAlerts(createClient());
    return NextResponse.json({ alerts });
  } catch (err) {
    console.error("[/api/alert]", err);
    return NextResponse.json({ error: "Gagal memuat alert." }, { status: 500 });
  }
}
