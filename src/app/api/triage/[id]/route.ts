/**
 * src/app/api/triage/[id]/route.ts
 *
 * POST /api/triage/[id]
 *
 * Menjalankan (atau menjalankan ulang) pipeline triage untuk satu aduan.
 * Dipanggil otomatis dari POST /api/complaints setelah aduan tersimpan,
 * atau manual oleh operator untuk re-triage aduan yang berstatus
 * triage_failed.
 */

import { NextResponse } from "next/server";
import { runTriagePipeline } from "@/lib/services/triage";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const result = await runTriagePipeline(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[/api/triage/${id}] Gagal:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menjalankan triage." },
      { status: 500 }
    );
  }
}
