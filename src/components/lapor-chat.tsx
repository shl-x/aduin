"use client";

/**
 * src/components/lapor-chat.tsx
 *
 * Simulator WhatsApp — UI percakapan untuk mengirim aduan baru.
 *
 * Alur:
 *  1. Warga mengetik teks (+ opsional pilih desa, opsional lampirkan foto)
 *     lalu kirim.
 *  2. POST /api/complaints dipanggil. Jika AI (aduin-clarify) menilai aduan
 *     belum lengkap, balasan bot menampilkan pertanyaan lanjutan dan aduan
 *     BELUM tersimpan — teks yang sudah diketik tetap terakumulasi sampai
 *     aduan dinyatakan lengkap.
 *  3. Setelah lengkap dan tersimpan, pipeline triage berjalan sinkron di
 *     server; hasilnya (atau kegagalannya) ditampilkan sebagai balasan bot.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AduinMark } from "@/components/brand/AduinLogo";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

interface RegionOption {
  id: string;
  label: string;
}

interface ChatMessage {
  id: string;
  from: "warga" | "bot";
  text: string;
}

interface TriageSummary {
  categoryLabel: string;
  opdShortName: string;
  urgency: number;
  impact: string;
  handlingPath: string;
  reason: string;
}

const HANDLING_PATH_LABELS: Record<string, string> = {
  quick_fix: "Quick Fix",
  bertahap: "Bertahap",
  butuh_data: "Butuh Data Lanjutan",
};

function formatTriageMessage(t: TriageSummary): string {
  const pathLabel = HANDLING_PATH_LABELS[t.handlingPath] ?? t.handlingPath;
  return (
    `Aduan Anda sudah tercatat dan diproses AI.\n\n` +
    `Kategori: ${t.categoryLabel}\n` +
    `OPD tujuan: ${t.opdShortName}\n` +
    `Urgensi: ${t.urgency}/5 · Dampak: ${t.impact}\n` +
    `Jalur penanganan: ${pathLabel}\n\n` +
    `${t.reason}`
  );
}

export function LaporChat({ regions }: { regions: RegionOption[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftText, setDraftText] = useState("");
  const [complaintText, setComplaintText] = useState("");
  const [regionId, setRegionId] = useState<string | undefined>(undefined);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhotoFile(file);
    setUploadingPhoto(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const path = `warga/${user?.id ?? "anon"}/${Date.now()}-${file.name}`;

      const { error: uploadErr } = await supabase.storage.from("aduan-photos").upload(path, file);
      if (uploadErr) {
        setError(`Gagal unggah foto: ${uploadErr.message}`);
        setPhotoFile(null);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("aduan-photos").getPublicUrl(path);
      setPhotoUrl(publicUrlData.publicUrl);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend() {
    const userText = draftText.trim();
    if (!userText || sending) return;

    setError(null);
    setDraftText("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), from: "warga", text: userText }]);
    setSending(true);

    const nextComplaintText = complaintText ? `${complaintText} ${userText}` : userText;

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: nextComplaintText,
          region_id: regionId ?? null,
          photo_url: photoUrl,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), from: "bot", text: data?.error ?? "Terjadi kesalahan. Coba lagi." },
        ]);
        return;
      }

      if (data.needsClarification) {
        setComplaintText(nextComplaintText);
        setMessages((m) => [...m, { id: crypto.randomUUID(), from: "bot", text: data.question }]);
        return;
      }

      // Aduan tersimpan — reset draft untuk aduan berikutnya.
      setComplaintText("");
      removePhoto();

      const botText =
        data.status === "triaged" && data.triage
          ? formatTriageMessage(data.triage as TriageSummary)
          : "Aduan Anda sudah tercatat. Proses triase otomatis sedang mengalami gangguan, tim kami akan meninjau secara manual.";

      setMessages((m) => [...m, { id: crypto.randomUUID(), from: "bot", text: botText }]);
      // Perbarui daftar "Aduan Saya" di bawah chat.
      router.refresh();
    } catch {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), from: "bot", text: "Gagal terhubung ke server. Coba lagi." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] min-h-[480px] max-h-[720px]">
      {/* Kepala simulator WhatsApp */}
      <div className="flex items-center gap-3 rounded-t-lg bg-console px-4 py-3 text-console-ink">
        <span className="flex size-9 items-center justify-center rounded-full bg-surface">
          <AduinMark size={26} title="" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Aduin</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-console-muted">
            Simulator WhatsApp · daring
          </p>
        </div>
      </div>

      {/* Riwayat chat */}
      <div
        className="flex-1 overflow-y-auto border-x bg-muted p-4 space-y-3"
        role="log"
        aria-live="polite"
        aria-label="Percakapan dengan Aduin"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <MessageSquare size={40} strokeWidth={1.4} aria-hidden />
            <div>
              <p className="font-medium text-foreground">Belum ada percakapan</p>
              <p className="text-sm mt-1">Ketik aduan Anda di bawah untuk memulai.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn("flex items-end gap-2", msg.from === "warga" ? "justify-end" : "justify-start")}>
              {msg.from === "bot" && <AduinMark size={28} title="" className="mb-0.5" />}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line leading-relaxed",
                  msg.from === "warga"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border rounded-bl-sm"
                )}
              >
                {msg.from === "bot" && (
                  <p className="text-xs font-semibold text-primary mb-0.5">Aduin</p>
                )}
                {msg.text}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-end gap-2 justify-start">
            <AduinMark size={28} title="" className="mb-0.5" />
            <div className="rounded-2xl rounded-bl-sm bg-card border px-3.5 py-2 text-sm text-muted-foreground animate-pulse">
              Aduin sedang memproses…
            </div>
          </div>
        )}
      </div>

      {/* Area input */}
      <div className="rounded-b-lg border bg-card p-3 space-y-2.5">
        {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Select value={regionId} onValueChange={(v) => setRegionId(v ?? undefined)}>
            <SelectTrigger className="w-full sm:w-64" aria-label="Lokasi aduan">
              <SelectValue>
                {(v: string | null) =>
                  regions.find((r) => r.id === v)?.label ?? "Pilih desa/kecamatan (opsional)"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploadingPhoto}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={14} aria-hidden />
            {uploadingPhoto ? "Mengunggah…" : photoFile ? "Ganti foto" : "Lampirkan foto"}
          </Button>
          {photoFile && !uploadingPhoto && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="max-w-[12rem] truncate font-mono">{photoFile.name}</span>
              <button
                type="button"
                onClick={removePhoto}
                aria-label="Hapus foto lampiran"
                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted hover:text-danger-text"
              >
                <X size={14} aria-hidden />
              </button>
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Tulis aduan Anda di sini…"
            aria-label="Tulis aduan"
            className="min-h-10 resize-none"
            disabled={sending}
          />
          <Button type="button" variant="action" onClick={handleSend} disabled={sending || !draftText.trim()}>
            <Send size={14} aria-hidden />
            Kirim
          </Button>
        </div>
      </div>
    </div>
  );
}
