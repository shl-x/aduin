/**
 * src/app/(warga)/lapor/page.tsx
 * Simulator WhatsApp — placeholder M0.
 * Implementasi lengkap: M2.
 */
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LaporPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporkan Aduan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sampaikan keluhan atau aduan Anda kepada pemerintah daerah.
        </p>
      </div>

      {/* Empty state */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulator WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
            <MessageSquare size={48} strokeWidth={1.2} />
            <div>
              <p className="font-medium text-foreground">Belum ada percakapan</p>
              <p className="text-sm mt-1">
                Fitur simulator WhatsApp akan tersedia di Milestone 2.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
