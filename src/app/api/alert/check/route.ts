/**
 * src/app/api/alert/check/route.ts
 *
 * POST /api/alert/check — operator memicu pengecekan z-score untuk SEMUA
 * kombinasi (kategori, wilayah) yang punya aduan dalam 24 jam terakhir.
 * Alert baru langsung diringkas AI (await dengan timeout).
 */

import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { checkAllEarlyWarnings } from "@/lib/analytics/early-warning";

export async function POST(): Promise<NextResponse> {
  const role = await getSessionRole();
  if (role !== "operator") {
    return NextResponse.json(
      { error: "Hanya operator yang dapat menjalankan pengecekan." },
      { status: 403 }
    );
  }

  try {
    const outcomes = await checkAllEarlyWarnings(createClient());
    return NextResponse.json({
      checked: outcomes.length,
      created: outcomes.filter((o) => o.action === "created").length,
      updated: outcomes.filter((o) => o.action === "updated").length,
      outcomes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/alert/check]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
