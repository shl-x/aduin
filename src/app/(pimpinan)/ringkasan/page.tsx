/**
 * src/app/(pimpinan)/ringkasan/page.tsx
 *
 * Dashboard pimpinan (M6): KPI, tren aduan per kategori (7/30/90 hari via
 * ?days=), sebaran per kecamatan, alert aktif, dan peringkat kinerja OPD.
 * Semua data dari database (src/lib/analytics/*) — tidak memanggil Langflow.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCard } from "@/components/alert-card";
import { CategoryTrendChart, KecamatanBarChart } from "@/components/ringkasan-charts";
import { createClient } from "@/lib/supabase/client";
import { getSessionRole } from "@/lib/supabase/server";
import {
  loadDashboard,
  parseTrendRange,
  TREND_RANGES,
  type DashboardData,
} from "@/lib/analytics/dashboard";
import { getActiveAlerts, type ActiveAlert } from "@/lib/analytics/early-warning";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Ringkasan Kinerja" };

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  return `${hours.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
}

/** Kartu KPI: label kecil kapital di atas, angka besar IBM Plex Mono di bawah. */
function KpiTile({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint: string }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-[13px] font-bold text-muted-foreground">{label}</p>
        <p className="font-mono text-3xl font-semibold leading-none tracking-tight text-ink">
          {value}
          {unit && <span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function formatHoursValue(hours: number | null): string {
  if (hours === null) return "—";
  return hours.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

export default async function RingkasanPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = parseTrendRange(daysParam);
  const role = await getSessionRole();

  const header = (
    <PageHeader
      eyebrow="Pimpinan daerah"
      title="Ringkasan kinerja"
      description="Berapa aduan masuk, seberapa cepat selesai, dan dinas mana yang perlu didorong."
    />
  );

  if (role !== "pimpinan" && role !== "operator") {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
              <BarChart3 size={40} strokeWidth={1.4} aria-hidden />
              <p className="font-medium text-foreground">Halaman ini khusus pimpinan.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = createClient();
  const [dashboardResult, alertsResult] = await Promise.allSettled([
    loadDashboard(supabase, days),
    getActiveAlerts(supabase),
  ]);

  if (dashboardResult.status === "rejected") {
    const message =
      dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "Gagal memuat data.";
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <p role="alert" className="text-sm text-danger-text py-12 text-center">Gagal memuat ringkasan: {message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data: DashboardData = dashboardResult.value;
  const alerts: ActiveAlert[] = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const alertsError =
    alertsResult.status === "rejected"
      ? alertsResult.reason instanceof Error
        ? alertsResult.reason.message
        : "Gagal memuat alert."
      : null;
  const { kpi } = data;

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total aduan"
          value={kpi.total_complaints.toLocaleString("id-ID")}
          hint="Sepanjang waktu"
        />
        <KpiTile
          label="Aduan 30 hari terakhir"
          value={kpi.total_30d.toLocaleString("id-ID")}
          hint="Berdasarkan tanggal lapor"
        />
        <KpiTile
          label="Rata-rata penyelesaian"
          value={formatHoursValue(kpi.avg_resolution_hours)}
          unit={kpi.avg_resolution_hours === null ? undefined : "jam"}
          hint="Dari dilaporkan hingga ditutup"
        />
        <KpiTile
          label="Aduan selesai"
          value={kpi.closed_pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
          unit="%"
          hint={`${kpi.closed_count} dari ${kpi.total_complaints} aduan berstatus Selesai`}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Rentang waktu grafik">
        <span className="text-[13px] font-bold text-muted-foreground">Rentang grafik</span>
        {TREND_RANGES.map((d) => (
          <Link
            key={d}
            href={`/ringkasan?days=${d}`}
            aria-current={d === days ? "true" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-md border px-3 font-mono text-xs transition-colors duration-150",
              d === days ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-surface hover:bg-muted"
            )}
          >
            {d} hari
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Tren aduan per kategori · <span className="font-mono">{days}</span> hari ({data.trend.granularity})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTrendChart trend={data.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sebaran per kecamatan · <span className="font-mono">{days}</span> hari</CardTitle>
          </CardHeader>
          <CardContent>
            <KecamatanBarChart regions={data.regions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peringatan dini aktif <span className="font-mono text-muted-foreground">{alerts.length}</span></CardTitle>
        </CardHeader>
        <CardContent>
          {alertsError ? (
            <p role="alert" className="text-sm text-danger-text py-6 text-center">Gagal memuat alert: {alertsError}</p>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
              <Bell className="size-5" aria-hidden />
              Tidak ada lonjakan aduan yang aktif.
            </div>
          ) : (
            <ul className="space-y-4">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} actions={false} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peringkat kinerja OPD</CardTitle>
        </CardHeader>
        <CardContent>
          {data.opdRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Belum ada aduan yang ditangani OPD.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>OPD</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Belum selesai</TableHead>
                  <TableHead className="text-right">% Selesai</TableHead>
                  <TableHead className="text-right">Rata-rata penyelesaian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.opdRanking.map((r) => (
                  <TableRow key={r.opd_id}>
                    <TableCell className="font-mono">{r.rank}</TableCell>
                    <TableCell>
                      <span className="font-medium">{r.short_name}</span>
                      <span className="text-muted-foreground text-xs ml-1.5 hidden sm:inline">{r.name}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.total}</TableCell>
                    <TableCell className="text-right font-mono">{r.active}</TableCell>
                    <TableCell className="text-right font-mono">
                      {r.closed_pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatHours(r.avg_resolution_hours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Diurutkan berdasarkan persentase aduan selesai, lalu waktu penyelesaian tercepat.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
