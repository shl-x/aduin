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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PhotoCompare } from "@/components/photo-compare";
import { StatusStamp } from "@/components/status-stamp";
import { AduinMark } from "@/components/brand/AduinLogo";
import { Eyebrow, ticketId } from "@/components/page-header";

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
    <div className="flex items-start gap-2">
    <AduinMark size={28} title="" className="mt-1" />
    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border-[1.5px] border-accent bg-card p-3.5 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary">Aduin</p>
        <span className="font-mono text-[11px] text-muted-foreground">{ticketId(complaint.id)}</span>
      </div>
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
          aria-label="Alasan penolakan"
          className="min-h-16"
          disabled={pending !== null}
        />
      )}
      {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!rejecting ? (
          <>
            <Button type="button" variant="action" onClick={() => submit(true)} disabled={pending !== null}>
              {pending === "confirm" ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
              Konfirmasi Selesai
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejecting(true)}
              disabled={pending !== null}
            >
              <XCircle aria-hidden />
              Tolak
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={() => submit(false)}
              disabled={pending !== null}
            >
              {pending === "reject" ? <Loader2 className="animate-spin" aria-hidden /> : <XCircle aria-hidden />}
              Kirim Penolakan
            </Button>
            <Button
              type="button"
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
      <div>
        <Eyebrow>Riwayat</Eyebrow>
        <h2 className="text-lg font-bold tracking-tight">Aduan Saya</h2>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-danger-text rounded-lg border border-destructive/30 p-4 text-center">
          Gagal memuat aduan Anda: {loadError}
        </p>
      ) : complaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-10 text-center gap-3 text-muted-foreground">
          <Inbox size={36} strokeWidth={1.4} aria-hidden />
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

          <ul className="divide-y rounded-lg border bg-surface">
            {others.slice(0, visible).map((c) => {
              return (
                <li key={c.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm line-clamp-2">{c.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{ticketId(c.id)}</span> ·{" "}
                      {[c.category_label, c.region_name].filter(Boolean).join(" · ") || "Belum ditriase"} ·{" "}
                      <span className="font-mono">
                        {new Date(c.reported_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                  <StatusStamp status={c.status} size="sm" className="shrink-0" />
                </li>
              );
            })}
            {others.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground text-center">Tidak ada aduan lain.</li>
            )}
          </ul>

          {others.length > visible && (
            <Button type="button" variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Tampilkan lebih banyak (<span className="font-mono">{others.length - visible}</span> lagi)
            </Button>
          )}
        </>
      )}
    </section>
  );
}
