/**
 * src/app/(opd)/tugas/page.tsx
 * Portal tugas petugas OPD — placeholder M0.
 * Implementasi lengkap: M4.
 */
import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TugasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tugas Saya</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Daftar sub-tugas yang ditugaskan ke OPD Anda.
        </p>
      </div>

      {/* Empty state */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sub-Tugas Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
            <ClipboardList size={48} strokeWidth={1.2} />
            <div>
              <p className="font-medium text-foreground">Belum ada tugas</p>
              <p className="text-sm mt-1">
                Tugas koordinasi lintas OPD akan tersedia di Milestone 4.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
