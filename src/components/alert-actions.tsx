"use client";

/**
 * src/components/alert-actions.tsx
 *
 * Aksi operator di /alert:
 *   - CheckNowButton     → POST /api/alert/check (semua kombinasi)
 *   - RetrySummaryButton → POST /api/alert/[alertId]/summary (pending_retry)
 *   - DismissAlertForm   → POST /api/alert/[alertId]/dismiss (catatan wajib)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CheckNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/alert/check", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ text: body?.error ?? "Pengecekan gagal.", error: true });
        return;
      }
      setMessage({
        text:
          `${body.checked} kombinasi diperiksa · ${body.created} alert baru · ${body.updated} diperbarui.`,
        error: false,
      });
      router.refresh();
    } catch {
      setMessage({ text: "Tidak dapat menghubungi server.", error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Search />}
        {loading ? "Memeriksa…" : "Periksa Sekarang"}
      </Button>
      {message && (
        <p className={message.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {message.text}
        </p>
      )}
    </div>
  );
}

export function RetrySummaryButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/alert/${alertId}/summary`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Ringkasan AI gagal dibuat.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {loading ? "Membuat ringkasan…" : "Coba Lagi"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function DismissAlertForm({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!note.trim()) {
      setError("Tulis catatan penutupan terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/alert/${alertId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Gagal menutup alert.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <X />
        Tutup Alert
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan penutupan (wajib), mis. tim Dinkes sudah diterjunkan"
        className="min-h-16"
        disabled={loading}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="destructive" onClick={handleSubmit} disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Tutup Alert
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setNote("");
            setError(null);
          }}
          disabled={loading}
        >
          Batal
        </Button>
      </div>
    </div>
  );
}
