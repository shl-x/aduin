/**
 * src/app/(operator)/peta/page.tsx
 * Peta hotspot + clustering — Server Component. Data diambil langsung dari
 * Supabase lalu diteruskan ke PetaClient (Client Component) yang me-render
 * Leaflet lewat dynamic import ssr:false.
 */
import { createClient } from "@/lib/supabase/client";
import { PetaClient } from "@/components/peta/peta-client";
import type { ComplaintMarker, KecamatanStat, ClusterInfo } from "@/components/peta/types";

interface ComplaintQueryRow {
  id: string;
  text: string;
  status: string;
  effective_category: string | null;
  lat: number | null;
  lng: number | null;
  reported_at: string;
  cluster_id: string | null;
  region: { name: string; parent_id: string | null } | null;
  opd: { short_name: string } | null;
  triage_results: { handling_path: string; urgency: number; created_at: string }[] | null;
}

interface RegionRow {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

interface ClusterRow {
  id: string;
  label: string | null;
  category: string | null;
  member_count: number;
}

function latestTriage(rows: ComplaintQueryRow["triage_results"]) {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export default async function PetaPage() {
  const supabase = createClient();

  const [complaintsRes, regionsRes, clustersRes] = await Promise.all([
    supabase
      .from("complaints")
      .select(
        "id, text, status, effective_category, lat, lng, reported_at, cluster_id, region:region_id(name, parent_id), opd:effective_opd_id(short_name), triage_results(handling_path, urgency, created_at)"
      )
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("reported_at", { ascending: false })
      .limit(500),
    supabase.from("regions").select("id, name, lat, lng").eq("level", "kecamatan"),
    supabase.from("clusters").select("id, label, category, member_count"),
  ]);

  if (complaintsRes.error) {
    throw new Error(`Gagal memuat data aduan untuk peta: ${complaintsRes.error.message}`);
  }
  if (regionsRes.error) {
    throw new Error(`Gagal memuat data kecamatan untuk peta: ${regionsRes.error.message}`);
  }

  const complaintRows = (complaintsRes.data ?? []) as unknown as ComplaintQueryRow[];
  const regionRows = (regionsRes.data ?? []) as unknown as RegionRow[];
  const clusterRows = (clustersRes.data ?? []) as unknown as ClusterRow[];

  const complaints: ComplaintMarker[] = complaintRows
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => {
      const latest = latestTriage(c.triage_results);
      return {
        id: c.id,
        text: c.text,
        status: c.status,
        category: c.effective_category,
        handlingPath: latest?.handling_path ?? null,
        urgency: latest?.urgency ?? null,
        lat: c.lat as number,
        lng: c.lng as number,
        reportedAt: c.reported_at,
        regionName: c.region?.name ?? null,
        opdShortName: c.opd?.short_name ?? null,
        clusterId: c.cluster_id,
      };
    });

  const activeCountByKecamatan = new Map<string, number>();
  for (const c of complaintRows) {
    if (c.status === "closed") continue;
    const kecamatanId = c.region?.parent_id ?? null;
    if (!kecamatanId) continue;
    activeCountByKecamatan.set(kecamatanId, (activeCountByKecamatan.get(kecamatanId) ?? 0) + 1);
  }

  const kecamatanStats: KecamatanStat[] = regionRows
    .filter((k) => k.lat != null && k.lng != null)
    .map((k) => ({
      id: k.id,
      name: k.name,
      lat: k.lat as number,
      lng: k.lng as number,
      activeCount: activeCountByKecamatan.get(k.id) ?? 0,
    }));

  const clustersById: Record<string, ClusterInfo> = {};
  for (const row of clusterRows) {
    clustersById[row.id] = {
      id: row.id,
      label: row.label,
      category: row.category,
      memberCount: row.member_count,
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Peta Hotspot</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visualisasi sebaran dan kluster aduan di wilayah.
        </p>
      </div>

      <PetaClient complaints={complaints} kecamatanStats={kecamatanStats} clustersById={clustersById} />
    </div>
  );
}
