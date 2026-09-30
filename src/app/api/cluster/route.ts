/**
 * src/app/api/cluster/route.ts
 *
 * POST /api/cluster — jalankan ulang clustering untuk seluruh aduan (dipicu
 * tombol "Hitung Ulang Cluster" di /peta, atau manual dari dev tools).
 * GET  /api/cluster  — daftar cluster (centroid, jumlah anggota, label,
 * kategori) untuk dirender di peta.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { recomputeAllClusters } from "@/lib/analytics/clustering";

export async function POST(): Promise<NextResponse> {
  try {
    const result = await recomputeAllClusters();
    return NextResponse.json({ clusters: result.clustersCreated, processed: result.complaintsProcessed });
  } catch (err) {
    console.error("[/api/cluster] POST gagal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menjalankan clustering." },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clusters")
      .select("id, label, category, region_id, centroid_lat, centroid_lng, member_count, first_seen_at, last_seen_at")
      .order("member_count", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ clusters: data ?? [] });
  } catch (err) {
    console.error("[/api/cluster] GET gagal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat data cluster." },
      { status: 500 }
    );
  }
}
