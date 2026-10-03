/**
 * src/app/(operator)/alert/page.tsx
 *
 * Panel peringatan dini (M6). Daftar alert aktif (belum ditutup) dengan
 * statistik lonjakan, ringkasan AI, rekomendasi OPD, dan tautan ke aduan
 * terkait. Operator: "Periksa Sekarang", "Coba Lagi" (pending_retry), dan
 * "Tutup Alert" (catatan wajib).
 */
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCard } from "@/components/alert-card";
import { CheckNowButton } from "@/components/alert-actions";
import { createClient } from "@/lib/supabase/client";
import { getSessionRole } from "@/lib/supabase/server";
import { getActiveAlerts, type ActiveAlert } from "@/lib/analytics/early-warning";

export const metadata: Metadata = { title: "Peringatan Dini" };

export default async function AlertPage() {
  const role = await getSessionRole();
  const isOperator = role === "operator";

  let alerts: ActiveAlert[] = [];
  let loadError: string | null = null;
  if (isOperator || role === "pimpinan") {
    try {
      alerts = await getActiveAlerts(createClient());
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Gagal memuat alert.";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Peringatan Dini</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Deteksi lonjakan aduan per kategori dan wilayah (z-score 24 jam vs baseline 14 hari).
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Badge variant={alerts.length > 0 ? "destructive" : "secondary"}>
            {alerts.length} alert aktif
          </Badge>
          {isOperator && <CheckNowButton />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          {!isOperator && role !== "pimpinan" ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Halaman ini khusus operator dan pimpinan.
            </p>
          ) : loadError ? (
            <p className="text-sm text-destructive py-8 text-center">Gagal memuat alert: {loadError}</p>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
              <Bell size={48} strokeWidth={1.2} />
              <div>
                <p className="font-medium text-foreground">Tidak ada peringatan aktif</p>
                <p className="text-sm mt-1">
                  Tidak ada lonjakan aduan yang melewati ambang saat ini.
                  {isOperator && " Tekan “Periksa Sekarang” untuk memeriksa ulang."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} actions={isOperator} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
