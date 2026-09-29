/**
 * src/app/(operator)/peta/page.tsx
 * Peta hotspot + clustering — placeholder M0.
 * Implementasi lengkap: M3.
 */
import { Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PetaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Peta Hotspot</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visualisasi sebaran dan kluster aduan di wilayah.
        </p>
      </div>

      {/* Empty state peta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peta Aduan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 text-muted-foreground">
            <Map size={48} strokeWidth={1.2} />
            <div>
              <p className="font-medium text-foreground">Peta belum tersedia</p>
              <p className="text-sm mt-1">
                Peta interaktif Leaflet akan tersedia di Milestone 3.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
