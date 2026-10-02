/**
 * src/app/api/alert/[alertId]/summary/route.ts
 *
 * POST /api/alert/[alertId]/summary — tombol "Coba Lagi" (operator):
 * memanggil ulang aduin-alert-summary untuk alert berstatus pending_retry.
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { generateAlertSummary } from "@/lib/analytics/early-warning";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ alertId: string }> }
): Promise<NextResponse> {
  const { alertId } = await params;

  const role = await getSessionRole();
  if (role !== "operator") {
    return NextResponse.json(
      { error: "Hanya operator yang dapat meminta ulang ringkasan." },
      { status: 403 }
    );
  }

  const supabase = createClient();
  const { data: alert } = await supabase
    .from("alerts")
    .select("id, summary_status")
    .eq("id", alertId)
    .maybeSingle();
  if (!alert) {
    return NextResponse.json({ error: "Alert tidak ditemukan." }, { status: 404 });
  }
  if (alert.summary_status === "done") {
    return NextResponse.json({ ok: true, summary_status: "done" });
  }

  const result = await generateAlertSummary(supabase, alertId);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Ringkasan AI masih gagal dibuat. Coba lagi beberapa saat lagi.",
        detail: result.error,
      },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, summary_status: "done" });
}
