/**
 * src/app/api/health/route.ts
 *
 * Endpoint: GET /api/health
 *
 * Memanggil healthCheck() dari langflow/client.ts dan mengembalikan status.
 * Gunakan dari browser dev tools untuk memverifikasi Langflow lokal berjalan:
 *
 *   fetch('/api/health').then(r => r.json()).then(console.log)
 *   // → { langflow: true,  detail: "Langflow berjalan normal" }
 *   // → { langflow: false, detail: "Tidak dapat terhubung ke http://127.0.0.1:7860: ..." }
 */

import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/langflow/client";

export async function GET() {
  const { ok, detail } = await healthCheck();
  return NextResponse.json({ langflow: ok, detail });
}
