"use client";

/**
 * src/components/completion-upload.tsx
 *
 * Unggah foto bukti penyelesaian (petugas OPD) → POST /api/verify/[id]
 * (multipart). Server yang menyimpan foto ke bucket aduan-photos lalu
 * menjalankan aduin-verify; hasil AI ditampilkan setelah selesai.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VerifyResponse {
  ai_status: "ai_verified" | "needs_review";
  ai_reason: string;
  ai_failed: boolean;
}

export function CompletionUpload({
  complaintId,
  enabled,
  disabledReason,
}: {
  complaintId: string;
  enabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  // Object URL pratinjau dibebaskan saat diganti dan saat komponen dilepas.
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function selectFile(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setFile(next);
    setPreview(previewRef.current);
  }

  function clearFile() {
    selectFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/verify/${complaintId}`, { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Gagal mengunggah bukti penyelesaian.");
        return;
      }
      setResult(body as VerifyResponse);
      clearFile();
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const verified = result.ai_status === "ai_verified";
    return (
      <div
        role="status"
        className={
          verified
            ? "rounded-md border-[1.5px] border-success bg-success/5 p-3 text-sm"
            : "rounded-md border-[1.5px] border-warning bg-warning/5 p-3 text-sm"
        }
      >
        <p className={verified ? "flex items-center gap-2 font-semibold text-success-text" : "flex items-center gap-2 font-semibold text-warning-text"}>
          {verified ? <CheckCircle2 className="size-4 shrink-0" aria-hidden /> : <AlertTriangle className="size-4 shrink-0" aria-hidden />}
          {verified ? "Terverifikasi AI — menunggu konfirmasi warga." : "Perlu ditinjau operator."}
        </p>
        <p className="text-muted-foreground mt-1">{result.ai_reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          setError(null);
          selectFile(e.target.files?.[0] ?? null);
        }}
      />

      {preview && (
        <div className="relative w-full max-w-xs aspect-video rounded-md overflow-hidden border">
          <Image src={preview} alt="Pratinjau foto bukti" fill className="object-cover" unoptimized />
          {!loading && (
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-md bg-surface/90 text-ink hover:text-danger-text"
              aria-label="Hapus foto"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!enabled || loading}
          onClick={() => inputRef.current?.click()}
        >
          <Camera aria-hidden />
          {file ? "Ganti foto" : "Pilih foto"}
        </Button>
        <Button type="button" variant="action" disabled={!enabled || !file || loading} onClick={handleUpload}>
          {loading ? <Loader2 className="animate-spin" /> : <Upload />}
          {loading ? "Memverifikasi…" : "Unggah Bukti Penyelesaian"}
        </Button>
      </div>

      {!enabled && disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          Foto sedang diunggah dan diperiksa AI. Proses ini bisa memakan waktu hingga 1 menit.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}
    </div>
  );
}
