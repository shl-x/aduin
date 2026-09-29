/**
 * src/app/api/complaints/route.ts
 *
 * POST /api/complaints
 *
 * Alur (docs/LANGFLOW_FLOWS.md Flow 1 + ARCHITECTURE.md §3):
 *   1. Panggil aduin-clarify SEBELUM menyimpan apapun.
 *      - Gagal (timeout/error/Zod invalid) → fallback { status: "complete" }
 *        (aduan tidak boleh terblokir karena AI gagal).
 *      - "incomplete" → kembalikan pertanyaan, JANGAN simpan ke DB.
 *   2. "complete" → insert ke complaints (status 'pending'), lalu langsung
 *      jalankan pipeline triage (runTriagePipeline).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { runClarify } from "@/lib/langflow/client";
import { runTriagePipeline } from "@/lib/services/triage";
import { CATEGORIES } from "@/lib/constants/categories";

interface ComplaintRequestBody {
  text?: string;
  region_id?: string | null;
  photo_url?: string | null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabaseSSR = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Harus login untuk mengirim aduan." }, { status: 401 });
  }

  let body: ComplaintRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Teks aduan tidak boleh kosong." }, { status: 400 });
  }

  const supabase = createClient();

  let regionName: string | null = null;
  let regionLat: number | null = null;
  let regionLng: number | null = null;
  if (body.region_id) {
    const { data: region } = await supabase
      .from("regions")
      .select("name, lat, lng")
      .eq("id", body.region_id)
      .maybeSingle();
    regionName = region?.name ?? null;
    regionLat = region?.lat ?? null;
    regionLng = region?.lng ?? null;
  }

  // Fallback sesuai LANGFLOW_FLOWS.md Flow 1 §Fallback — AI gagal tidak boleh
  // memblokir intake aduan.
  const clarify = (await runClarify({ complaint_text: text, region_name: regionName })) ?? {
    status: "complete" as const,
    question: null,
  };

  if (clarify.status === "incomplete") {
    return NextResponse.json({ needsClarification: true, question: clarify.question });
  }

  const { data: complaint, error: insertErr } = await supabase
    .from("complaints")
    .insert({
      text,
      region_id: body.region_id ?? null,
      lat: regionLat,
      lng: regionLng,
      photo_before_url: body.photo_url ?? null,
      reporter_id: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !complaint) {
    console.error("[/api/complaints] Gagal insert aduan:", insertErr?.message);
    return NextResponse.json({ error: "Gagal menyimpan aduan." }, { status: 500 });
  }

  const result = await runTriagePipeline(complaint.id);

  if (result.status === "triage_failed" || !result.triage) {
    return NextResponse.json({ complaintId: complaint.id, status: "triage_failed" });
  }

  const { triage } = result;
  const category = CATEGORIES.find((c) => c.slug === triage.category);

  return NextResponse.json({
    complaintId: complaint.id,
    status: "triaged",
    triage: {
      category: triage.category,
      categoryLabel: category?.label ?? triage.category,
      opdShortName: triage.opd_short_name,
      urgency: triage.urgency,
      impact: triage.impact,
      handlingPath: triage.handling_path,
      reason: triage.reason,
    },
  });
}
