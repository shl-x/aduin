/**
 * src/app/api/health/route.ts
 *
 * Endpoint: GET /api/health
 *
 * Memanggil healthCheck() dari langflow/client.ts dan mengembalikan status.
 * Gunakan dari browser dev tools untuk memverifikasi Langflow lokal berjalan:
 *
 *   fetch('/api/health').then(r => r.json()).then(console.log)
 *   // → { langflow: true }
 */

import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/langflow/client";

export async function GET() {
  const langflowOk = await healthCheck();
  return NextResponse.json({ langflow: langflowOk });
}
