/**
 * src/components/alert-card.tsx
 *
 * Satu alert lonjakan aduan — dipakai di /alert (dengan aksi operator) dan
 * /ringkasan (read-only untuk pimpinan). Angka statistik ditulis dalam bahasa
 * kerja: "24 jam terakhir", "Biasanya", dan "Skor lonjakan" beserta batasnya.
 */
import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Stamp } from "@/components/status-stamp";
import { DismissAlertForm, RetrySummaryButton } from "@/components/alert-actions";
import type { ActiveAlert } from "@/lib/analytics/early-warning";

function formatNumber(n: number, digits = 1): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

const THRESHOLD_Z = Number(process.env.ALERT_THRESHOLD_Z ?? 2);

export function AlertCard({ alert, actions }: { alert: ActiveAlert; actions: boolean }) {
  const regionLabel = [alert.region_name, alert.kecamatan_name ? `Kec. ${alert.kecamatan_name}` : null]
    .filter(Boolean)
    .join(", ");
  const relatedHref = `/dashboard?category=${alert.category}${alert.region_id ? `&region=${alert.region_id}` : ""}`;

  return (
    <li className="overflow-hidden rounded-xl border-2 border-accent-strong bg-surface">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 border-b p-5 md:px-7 md:py-6">
        <div className="flex min-w-0 flex-[1_1_420px] items-start gap-3">
          <AlertTriangle className="mt-1 size-6 shrink-0 text-accent-text" aria-hidden />
          <div className="min-w-0">
            <Stamp tone="accent">Perlu tindakan</Stamp>
            <h2 className="mt-2.5 text-2xl font-extrabold leading-tight">
              Lonjakan aduan {alert.category_label} di {regionLabel || "wilayah tidak diketahui"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Terdeteksi{" "}
              <time dateTime={alert.triggered_at} className="font-mono">
                {new Date(alert.triggered_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </time>
              {alert.is_seed && " · data demo"}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-x-8 gap-y-2">
          <div>
            <dt className="text-[13px] font-bold text-muted-foreground">24 jam terakhir</dt>
            <dd className="mt-1 text-4xl font-extrabold leading-none">
              {alert.count_24h} <span className="text-[15px] font-semibold text-ink-2">aduan</span>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-bold text-muted-foreground">Biasanya</dt>
            <dd className="mt-1 text-4xl font-extrabold leading-none">
              {formatNumber(alert.mean_14d)} <span className="text-[15px] font-semibold text-ink-2">per hari</span>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-bold text-muted-foreground">Skor lonjakan</dt>
            <dd className="mt-1 text-4xl font-extrabold leading-none text-accent-text">
              {formatNumber(alert.z_score, 1)}{" "}
              <span className="text-[15px] font-semibold text-ink-2">batas {formatNumber(THRESHOLD_Z, 1)}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4 p-5 md:px-7">
        {alert.summary_status === "done" && alert.ai_summary ? (
          <>
            <div className="rounded-lg bg-muted px-4 py-3.5">
              <p className="mb-1.5 text-[13px] font-bold text-ink-2">Ringkasan AI dari isi aduan</p>
              <p className="text-[15px] leading-relaxed">{alert.ai_summary}</p>
            </div>
            {alert.opd_list.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">Dinas yang disarankan</p>
                <ul className="flex flex-wrap gap-2">
                  {alert.opd_list.map((opd) => (
                    <li key={opd} className="rounded-lg border px-3 py-2 text-[15px] font-bold">
                      {opd}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p>Ringkasan AI belum tersedia — Langflow gagal atau timeout saat alert dibuat.</p>
            {actions && <RetrySummaryButton alertId={alert.id} />}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 border-t p-5 md:px-7">
        <Link
          href={relatedHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/85"
        >
          Lihat aduan terkait
          <ExternalLink className="size-4" aria-hidden />
        </Link>
        {actions && <DismissAlertForm alertId={alert.id} />}
      </div>
    </li>
  );
}
