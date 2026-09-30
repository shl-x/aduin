"use client";

/**
 * src/components/peta/peta-client.tsx
 *
 * Wrapper Client Component untuk /peta: filter kategori + jalur (state
 * lokal, tidak lewat query string karena peta sepenuhnya interaktif di
 * client), tombol "Hitung Ulang Cluster" (POST /api/cluster lalu
 * router.refresh()), dan loading/empty state. Peta Leaflet sendiri
 * di-load lewat next/dynamic ssr:false karena butuh DOM/window.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RefreshCw, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/constants/categories";
import type { ComplaintMarker, KecamatanStat, ClusterInfo } from "./types";

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full rounded-lg border bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
      Memuat peta…
    </div>
  ),
});

const ALL = "__all__";

const HANDLING_PATH_OPTIONS = [
  { value: "quick_fix", label: "Quick Fix" },
  { value: "bertahap", label: "Bertahap" },
  { value: "butuh_data", label: "Butuh Data" },
];

interface PetaClientProps {
  complaints: ComplaintMarker[];
  kecamatanStats: KecamatanStat[];
  clustersById: Record<string, ClusterInfo>;
}

export function PetaClient({ complaints, kecamatanStats, clustersById }: PetaClientProps) {
  const router = useRouter();
  const [category, setCategory] = useState(ALL);
  const [handlingPath, setHandlingPath] = useState(ALL);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (category !== ALL && c.category !== category) return false;
      if (handlingPath !== ALL && c.handlingPath !== handlingPath) return false;
      return true;
    });
  }, [complaints, category, handlingPath]);

  async function handleRecompute() {
    setRecomputing(true);
    setRecomputeError(null);
    try {
      const res = await fetch("/api/cluster", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setRecomputeError(err instanceof Error ? err.message : "Gagal menghitung ulang cluster.");
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v ?? ALL)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua kategori</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={handlingPath} onValueChange={(v) => setHandlingPath(v ?? ALL)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Semua jalur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua jalur</SelectItem>
              {HANDLING_PATH_OPTIONS.map((h) => (
                <SelectItem key={h.value} value={h.value}>
                  {h.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {recomputeError && <p className="text-xs text-destructive">{recomputeError}</p>}
          <Button onClick={handleRecompute} disabled={recomputing} variant="outline" size="sm">
            <RefreshCw size={14} className={recomputing ? "animate-spin" : ""} />
            {recomputing ? "Menghitung ulang…" : "Hitung Ulang Cluster"}
          </Button>
        </div>
      </div>

      {complaints.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peta Aduan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4 text-muted-foreground">
              <MapIcon size={48} strokeWidth={1.2} />
              <div>
                <p className="font-medium text-foreground">Belum ada aduan dengan koordinat</p>
                <p className="text-sm mt-1">
                  Peta akan terisi begitu ada aduan yang punya titik lokasi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4 text-muted-foreground">
              <MapIcon size={48} strokeWidth={1.2} />
              <div>
                <p className="font-medium text-foreground">Tidak ada aduan yang cocok dengan filter</p>
                <p className="text-sm mt-1">Coba ubah filter kategori atau jalur.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <LeafletMap
          complaints={filtered}
          allComplaints={complaints}
          kecamatanStats={kecamatanStats}
          clustersById={clustersById}
        />
      )}
    </div>
  );
}
