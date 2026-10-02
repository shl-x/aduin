"use client";

/**
 * src/components/aduan-saya.tsx
 *
 * Daftar "Aduan Saya" untuk warga di /lapor (M5). Aduan berstatus
 * ai_verified tampil paling atas sebagai pesan bot Aduin: pemberitahuan
 * bahwa aduan sudah ditangani, foto sebelum/sesudah, dan tombol
 * "Konfirmasi Selesai" / "Tolak" (alasan wajib) →
 * POST /api/verify/[id]/confirm.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Inbox, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PhotoCompare } from "@/components/photo-compare";
import { STATUS_BADGE_VARIANT, STATUS_LABELS, type ComplaintStatus } from "@/lib/constants/status";

export interface MyComplaint {
  id: string;
  text: string;
  status: string;
  reported_at: string;
  category_label: string | null;
  region_name: string | null;
  photo_before_url: string | null;
  photo_after_url: string | null;
  ai_reason: string | null;
}

const PAGE_SIZE = 10;

function ConfirmationBubble({ complaint }: { complaint: MyComplaint }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(confirmed: boolean) {
    if (!confirmed && !note.trim()) {
      setError("Tuliskan alasan penolakan terlebih dahulu.");
      return;
    }
    setPending(confirmed ? "confirm" : "reject");
    setError(null);
    try {
      const res = await fetch(`/api/verify/${complaint.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed, note: confirmed ? undefined : note.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Gagal mengirim tanggapan. Coba lagi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl rounded-bl-sm bg-card ring-1 ring-foreground/10 p-3.5 space-y-3 text-sm">
      <p className="text-xs font-semibold text-muted-foreground">Aduin</p>
      <p>
        Kabar baik! Aduan Anda <span className="font-medium">&ldquo;{complaint.text}&rdquo;</span> sudah
        ditangani oleh petugas dan hasilnya telah diperiksa. Mohon konfirmasi apakah masalahnya memang
        sudah selesai.
      </p>
      <PhotoCompare beforeUrl={complaint.photo_before_url} afterUrl={complaint.photo_after_url} />
      {complaint.ai_reason && <p className="text-xs text-muted-foreground">{complaint.ai_reason}</p>}

      {rejecting && (
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ceritakan apa yang belum beres (wajib)"
          className="min-h-16"
          disabled={pending !== null}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!rejecting ? (
          <>
            <Button type="button" size="sm" onClick={() => submit(true)} disabled={pending !== null}>
              {pending === "confirm" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Konfirmasi Selesai
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRejecting(true)}
              disabled={pending !== null}
            >
              <XCircle />
              Tolak
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => submit(false)}
              disabled={pending !== null}
            >
              {pending === "reject" ? <Loader2 className="animate-spin" /> : <XCircle />}
              Kirim Penolakan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRejecting(false);
                setNote("");
                setError(null);
              }}
              disabled={pending !== null}
            >
              Batal
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function AduanSaya({
  complaints,
  loadError,
}: {
  complaints: MyComplaint[];
  loadError: string | null;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const awaiting = complaints.filter((c) => c.status === "ai_verified");
  const others = complaints.filter((c) => c.status !== "ai_verified");

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Aduan Saya</h2>

      {loadError ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 p-4 text-center">
          Gagal memuat aduan Anda: {loadError}
        </p>
      ) : complaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-10 text-center gap-3 text-muted-foreground">
          <Inbox size={36} strokeWidth={1.2} />
          <div>
            <p className="font-medium text-foreground">Belum ada aduan</p>
            <p className="text-sm mt-1">Aduan yang Anda kirim lewat chat di atas akan muncul di sini.</p>
          </div>
        </div>
      ) : (
        <>
          {awaiting.length > 0 && (
            <div className="space-y-3">
              {awaiting.map((c) => (
                <ConfirmationBubble key={c.id} complaint={c} />
              ))}
            </div>
          )}

          <ul className="divide-y rounded-lg border">
            {others.slice(0, visible).map((c) => {
              const statusKey = c.status as ComplaintStatus;
              return (
                <li key={c.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm line-clamp-2">{c.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[c.category_label, c.region_name].filter(Boolean).join(" · ") || "Belum ditriase"} ·{" "}
                      {new Date(c.reported_at).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[statusKey] ?? "outline"} className="shrink-0">
                    {STATUS_LABELS[statusKey] ?? c.status}
                  </Badge>
                </li>
              );
            })}
            {others.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground text-center">Tidak ada aduan lain.</li>
            )}
          </ul>

          {others.length > visible && (
            <Button type="button" variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Tampilkan lebih banyak ({others.length - visible} lagi)
            </Button>
          )}
        </>
      )}
    </section>
  );
}
