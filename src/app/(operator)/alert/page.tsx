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
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Stamp } from "@/components/status-stamp";
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
      <PageHeader
        eyebrow="Operator"
        title="Peringatan dini"
        description="Aduin membandingkan jumlah aduan 24 jam terakhir dengan rata-rata 14 hari sebelumnya, per kategori dan desa. Lonjakan yang melewati ambang muncul di sini."
        actions={
          <>
            <Stamp tone={alerts.length > 0 ? "accent" : "muted"}>
              <span className="font-mono">{alerts.length}</span> alert aktif
            </Stamp>
            {isOperator && <CheckNowButton />}
          </>
        }
      />

      {!isOperator && role !== "pimpinan" ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">
              Halaman ini khusus operator dan pimpinan.
            </p>
          </CardContent>
        </Card>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger-text py-8 text-center">Gagal memuat alert: {loadError}</p>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
              <Bell size={40} strokeWidth={1.4} aria-hidden />
              <div>
                <p className="font-bold text-foreground">Tidak ada peringatan aktif</p>
                <p className="text-sm mt-1">
                  Tidak ada lonjakan aduan yang melewati ambang saat ini.
                  {isOperator && " Tekan “Periksa Sekarang” untuk memeriksa ulang."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-5" aria-label="Peringatan aktif">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} actions={isOperator} />
          ))}
        </ul>
      )}
    </div>
  );
}
