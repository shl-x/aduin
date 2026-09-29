/**
 * src/app/(pimpinan)/ringkasan/page.tsx
 * Dashboard KPI pimpinan — placeholder M0.
 * Implementasi lengkap: M6.
 */
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RingkasanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ringkasan Kinerja</h1>
        <p className="text-muted-foreground text-sm mt-1">
          KPI, tren aduan, dan kinerja OPD untuk pimpinan daerah.
        </p>
      </div>

      {/* KPI skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Total Aduan", "Rata-rata Penyelesaian", "% Selesai"].map((label) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {label}
              </p>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state grafik */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tren Aduan per Kategori</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
            <BarChart3 size={48} strokeWidth={1.2} />
            <div>
              <p className="font-medium text-foreground">Data belum tersedia</p>
              <p className="text-sm mt-1">
                Dashboard lengkap dengan grafik Recharts akan tersedia di Milestone 6.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
