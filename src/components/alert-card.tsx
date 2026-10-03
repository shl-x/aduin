/**
 * src/components/alert-card.tsx
 *
 * Satu alert lonjakan aduan — dipakai di /alert (dengan aksi operator) dan
 * /ringkasan (read-only untuk pimpinan).
 */
import Link from "next/link";
import { AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Stamp } from "@/components/status-stamp";
import { DismissAlertForm, RetrySummaryButton } from "@/components/alert-actions";
import type { ActiveAlert } from "@/lib/analytics/early-warning";

function formatNumber(n: number, digits = 1): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function AlertCard({ alert, actions }: { alert: ActiveAlert; actions: boolean }) {
  const regionLabel = [alert.region_name, alert.kecamatan_name ? `Kec. ${alert.kecamatan_name}` : null]
    .filter(Boolean)
    .join(", ");
  const relatedHref = `/dashboard?category=${alert.category}${alert.region_id ? `&region=${alert.region_id}` : ""}`;

  return (
    <li className="rounded-lg border-[1.5px] border-accent bg-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="size-5 shrink-0 text-accent-text mt-0.5" aria-hidden />
          <div className="min-w-0">
            <Stamp tone="accent" size="sm" className="mb-1.5">Alert aktif</Stamp>
            <p className="font-semibold">
              Lonjakan {alert.category_label} — {regionLabel || "wilayah tidak diketahui"}
            </p>
            <p className="text-xs text-muted-foreground">
              Terdeteksi{" "}
              <time dateTime={alert.triggered_at} className="font-mono">
                {new Date(alert.triggered_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </time>
              {alert.is_seed && " · data demo"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">z-score</p>
          <p className="font-mono text-2xl font-semibold leading-none text-accent-text">{formatNumber(alert.z_score, 2)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-md border bg-muted px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">24 jam terakhir</dt>
          <dd className="font-mono text-xl font-semibold">{alert.count_24h} <span className="text-xs font-normal text-muted-foreground">aduan</span></dd>
        </div>
        <div className="rounded-md border bg-muted px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Baseline 14 hari</dt>
          <dd className="font-mono text-xl font-semibold">{formatNumber(alert.mean_14d)} <span className="text-xs font-normal text-muted-foreground">/hari</span></dd>
        </div>
        <div className="rounded-md border bg-muted px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Simpangan baku</dt>
          <dd className="font-mono text-xl font-semibold">{formatNumber(alert.std_14d)}</dd>
        </div>
      </dl>

      {alert.summary_status === "done" && alert.ai_summary ? (
        <div className="space-y-2">
          <p className="text-sm flex gap-1.5">
            <Sparkles className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
            <span>{alert.ai_summary}</span>
          </p>
          {alert.opd_list.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-muted-foreground">Rekomendasi OPD:</span>
              {alert.opd_list.map((opd) => (
                <Badge key={opd} variant="outline" className="font-mono">
                  {opd}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground space-y-2">
          <p>Ringkasan AI belum tersedia — Langflow gagal atau timeout saat alert dibuat.</p>
          {actions && <RetrySummaryButton alertId={alert.id} />}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Link href={relatedHref} className="text-sm font-medium text-primary inline-flex min-h-9 items-center gap-1 hover:underline">
          Lihat aduan terkait
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
        {actions && <DismissAlertForm alertId={alert.id} />}
      </div>
    </li>
  );
}
