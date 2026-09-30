"use client";

/**
 * src/components/peta/leaflet-map.tsx
 *
 * Render Leaflet sesungguhnya — hanya diimpor lewat next/dynamic dengan
 * ssr:false dari peta-client.tsx (Leaflet butuh `window`/DOM, tidak boleh
 * dirender di server).
 *
 * - Marker (CircleMarker) per aduan, warna sesuai kategori.
 * - Lingkaran (Circle) per kecamatan di koordinat pusatnya — pengganti
 *   choropleth karena tidak ada data GeoJSON batas wilayah; ukuran dan
 *   opasitas diskalakan dari jumlah aduan aktif.
 * - Klik marker menampilkan ringkasan aduan + anggota cluster-nya (dari
 *   `allComplaints`, tidak terpengaruh filter kategori/jalur di parent).
 */

import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { STATUS_LABELS, STATUS_BADGE_VARIANT, type ComplaintStatus } from "@/lib/constants/status";
import { getMarkerColor, KECAMATAN_CIRCLE_COLOR } from "@/lib/constants/map-colors";
import type { ComplaintMarker, KecamatanStat, ClusterInfo } from "./types";

const HANDLING_PATH_LABELS: Record<string, string> = {
  quick_fix: "Quick Fix",
  bertahap: "Bertahap",
  butuh_data: "Butuh Data",
};

interface LeafletMapProps {
  complaints: ComplaintMarker[];
  allComplaints: ComplaintMarker[];
  kecamatanStats: KecamatanStat[];
  clustersById: Record<string, ClusterInfo>;
}

// Pusat kira-kira Kabupaten Probolinggo (lihat supabase/seed/regions.ts)
const CENTER: [number, number] = [-7.78, 113.17];

export default function LeafletMap({
  complaints,
  allComplaints,
  kecamatanStats,
  clustersById,
}: LeafletMapProps) {
  const maxActive = Math.max(1, ...kecamatanStats.map((k) => k.activeCount));

  return (
    <MapContainer
      center={CENTER}
      zoom={11}
      scrollWheelZoom
      style={{ height: "600px", width: "100%", borderRadius: "0.5rem", zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {kecamatanStats.map((k) => {
        const ratio = k.activeCount / maxActive;
        const radius = 350 + ratio * 900;
        const fillOpacity = k.activeCount === 0 ? 0.04 : 0.12 + ratio * 0.35;
        return (
          <Circle
            key={k.id}
            center={[k.lat, k.lng]}
            radius={radius}
            pathOptions={{
              color: KECAMATAN_CIRCLE_COLOR,
              fillColor: KECAMATAN_CIRCLE_COLOR,
              fillOpacity,
              weight: 1,
            }}
          >
            <Tooltip direction="top">
              <span className="font-medium">{k.name}</span> — {k.activeCount} aduan aktif
            </Tooltip>
          </Circle>
        );
      })}

      {complaints.map((c) => {
        const categoryLabel =
          CATEGORIES.find((cat) => cat.slug === c.category)?.label ?? "Belum dikategorikan";
        const cluster = c.clusterId ? clustersById[c.clusterId] : undefined;
        const clusterMembers = c.clusterId
          ? allComplaints.filter((m) => m.clusterId === c.clusterId && m.id !== c.id)
          : [];

        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              weight: 1.5,
              fillColor: getMarkerColor(c.category),
              fillOpacity: 0.9,
            }}
          >
            <Popup maxWidth={280}>
              <div className="space-y-1.5 text-sm">
                <Badge variant={STATUS_BADGE_VARIANT[c.status as ComplaintStatus] ?? "outline"}>
                  {STATUS_LABELS[c.status as ComplaintStatus] ?? c.status}
                </Badge>
                <p className="font-medium leading-snug">{c.text}</p>
                <dl className="text-xs text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2">
                  <dt>Kategori</dt>
                  <dd>{categoryLabel}</dd>
                  <dt>OPD</dt>
                  <dd>{c.opdShortName ?? "—"}</dd>
                  <dt>Jalur</dt>
                  <dd>{c.handlingPath ? HANDLING_PATH_LABELS[c.handlingPath] ?? c.handlingPath : "—"}</dd>
                  <dt>Wilayah</dt>
                  <dd>{c.regionName ?? "—"}</dd>
                  <dt>Tanggal</dt>
                  <dd>
                    {new Date(c.reportedAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </dd>
                </dl>
                {cluster && (
                  <div className="border-t pt-1.5 mt-1.5">
                    <p className="text-xs font-medium">
                      Cluster: {cluster.label ?? "Tanpa label"} ({cluster.memberCount} aduan)
                    </p>
                    {clusterMembers.length > 0 && (
                      <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                        {clusterMembers.slice(0, 8).map((m) => (
                          <li key={m.id}>{m.text.length > 50 ? `${m.text.slice(0, 50)}…` : m.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <Link
                  href={`/aduan/${c.id}`}
                  className="text-xs text-primary underline underline-offset-2 inline-block pt-1"
                >
                  Lihat detail aduan →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
