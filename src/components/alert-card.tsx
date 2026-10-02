/**
 * src/components/alert-card.tsx
 *
 * Satu alert lonjakan aduan — dipakai di /alert (dengan aksi operator) dan
 * /ringkasan (read-only untuk pimpinan).
 */
import Link from "next/link";
import { AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <li className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">
              Lonjakan {alert.category_label} — {regionLabel || "wilayah tidak diketahui"}
            </p>
            <p className="text-xs text-muted-foreground">
              Terdeteksi{" "}
              {new Date(alert.triggered_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              {alert.is_seed && " · data demo"}
            </p>
          </div>
        </div>
        <Badge variant="destructive">z = {formatNumber(alert.z_score, 2)}</Badge>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">24 jam terakhir</dt>
          <dd className="text-lg font-semibold tabular-nums">{alert.count_24h} aduan</dd>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">Baseline 14 hari</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatNumber(alert.mean_14d)}/hari</dd>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">Simpangan baku</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatNumber(alert.std_14d)}</dd>
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
                <Badge key={opd} variant="secondary">
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
        <Link href={relatedHref} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
          Lihat aduan terkait
          <ExternalLink className="size-3" />
        </Link>
        {actions && <DismissAlertForm alertId={alert.id} />}
      </div>
    </li>
  );
}
