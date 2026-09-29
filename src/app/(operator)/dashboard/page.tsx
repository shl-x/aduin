/**
 * src/app/(operator)/dashboard/page.tsx
 * Daftar aduan + triage — placeholder M0.
 * Implementasi lengkap: M2.
 */
import { LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daftar Aduan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola dan pantau seluruh aduan yang masuk.
        </p>
      </div>

      {/* KPI skeleton — loading state */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state tabel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aduan Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
            <LayoutDashboard size={48} strokeWidth={1.2} />
            <div>
              <p className="font-medium text-foreground">Belum ada aduan</p>
              <p className="text-sm mt-1">
                Data aduan akan muncul setelah seed dan triage selesai (Milestone 2).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
