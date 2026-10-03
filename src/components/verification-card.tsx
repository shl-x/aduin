/**
 * src/components/verification-card.tsx
 *
 * Kartu "Verifikasi Penyelesaian" di /aduan/[id] (M5): foto sebelum &
 * sesudah berdampingan, hasil AI terbaru, tombol tinjauan operator
 * (needs_review), unggah bukti untuk petugas OPD (in_progress), dan
 * riwayat verifikasi + konfirmasi warga.
 */
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PhotoCompare } from "@/components/photo-compare";
import { Stamp } from "@/components/status-stamp";
import { CompletionUpload } from "@/components/completion-upload";
import { VerificationReviewActions } from "@/components/verification-review-actions";
import type { UserRole } from "@/components/sidebar-nav";
import type { VerificationHistory } from "@/lib/services/verification";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function VerificationCard({
  complaint,
  history,
  historyError,
  role,
  viewerHasTask,
  planComplete,
}: {
  complaint: { id: string; status: string; photo_before_url: string | null; photo_after_url: string | null };
  history: VerificationHistory | null;
  historyError: string | null;
  role: UserRole | null;
  /** true jika viewer adalah petugas OPD yang punya tugas di rencana aduan ini. */
  viewerHasTask: boolean;
  planComplete: boolean;
}) {
  const latest = history?.verifications[0] ?? null;
  const events = [
    ...(history?.verifications ?? []).map((v) => ({
      at: v.created_at,
      text:
        `Petugas mengunggah bukti — AI: ${v.ai_status === "ai_verified" ? "terverifikasi" : "perlu ditinjau"}` +
        (v.manual_approval === true
          ? ` · Disetujui operator${v.approval_note ? `: ${v.approval_note}` : ""}`
          : v.manual_approval === false
            ? ` · Dikembalikan operator: ${v.approval_note ?? "-"}`
            : ""),
    })),
    ...(history?.confirmations ?? []).map((c) => ({
      at: c.confirmed_at,
      text: c.confirmed ? "Warga mengonfirmasi selesai" : `Warga menolak: ${c.note ?? "-"}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verifikasi Penyelesaian</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PhotoCompare beforeUrl={complaint.photo_before_url} afterUrl={complaint.photo_after_url} />

        {historyError ? (
          <p role="alert" className="text-sm text-danger-text">Gagal memuat riwayat verifikasi: {historyError}</p>
        ) : !latest ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <ShieldCheck className="size-5 shrink-0" aria-hidden />
            Belum ada bukti penyelesaian yang diunggah petugas OPD.
          </div>
        ) : (
          <div className="rounded-md border p-3 space-y-1.5 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">Hasil AI</span>
              <Stamp tone={latest.ai_status === "ai_verified" ? "success" : "warning"} size="sm">
                {latest.ai_status === "ai_verified" ? "Terverifikasi" : "Perlu Ditinjau"}
              </Stamp>
              {latest.manual_approval === true && <Badge variant="outline">Disetujui manual</Badge>}
              {latest.manual_approval === false && <Badge variant="outline">Dikembalikan</Badge>}
              <span className="font-mono text-xs text-muted-foreground">{formatTime(latest.created_at)}</span>
            </div>
            <p className="text-muted-foreground">{latest.ai_reason}</p>
            {latest.approval_note && (
              <p className="text-xs">
                <span className="font-medium">Catatan operator:</span> {latest.approval_note}
              </p>
            )}
          </div>
        )}

        {role === "operator" && complaint.status === "needs_review" && latest && (
          <>
            <Separator />
            <VerificationReviewActions complaintId={complaint.id} />
          </>
        )}

        {role === "petugas_opd" && viewerHasTask && complaint.status === "in_progress" && (
          <>
            <Separator />
            <CompletionUpload
              complaintId={complaint.id}
              enabled={planComplete}
              disabledReason="Tombol aktif setelah semua tugas pada aduan ini berstatus selesai."
            />
          </>
        )}

        {events.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Riwayat</p>
              <ul className="space-y-1 text-xs">
                {events.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-muted-foreground">{formatTime(e.at)}</span> — {e.text}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
