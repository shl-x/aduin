/**
 * src/app/(operator)/alert/page.tsx
 * Panel peringatan dini — placeholder M0.
 * Implementasi lengkap: M6.
 */
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AlertPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Peringatan Dini</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Deteksi lonjakan aduan berbasis analisis statistik.
          </p>
        </div>
        <Badge variant="secondary">0 alert aktif</Badge>
      </div>

      {/* Empty state */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
            <Bell size={48} strokeWidth={1.2} />
            <div>
              <p className="font-medium text-foreground">Tidak ada peringatan aktif</p>
              <p className="text-sm mt-1">
                Sistem deteksi lonjakan akan aktif setelah Milestone 6.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
