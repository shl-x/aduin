"use client";

/**
 * src/components/reset-demo-button.tsx
 *
 * Tombol "Reset Demo" (operator, hanya saat NEXT_PUBLIC_DEMO_MODE=true) →
 * POST /api/seed/reset. Meminta konfirmasi dulu karena semua aduan latihan
 * dihapus.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface ResetResponse {
  seeded: number;
  deleted_practice_complaints: number;
  snapshot_found: boolean;
  alerts: number;
  diare_alert: { z_score: number; summary_status: string } | null;
}

export function ResetDemoButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (!DEMO_MODE) return null;

  async function handleReset() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seed/reset", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ text: body?.error ?? "Reset demo gagal.", error: true });
        return;
      }
      const r = body as ResetResponse;
      setMessage({
        text:
          `${r.seeded} aduan seed dipulihkan, ${r.deleted_practice_complaints} aduan latihan dihapus. ` +
          (r.diare_alert
            ? `Alert diare Sumberasih aktif (z=${r.diare_alert.z_score}, ringkasan ${r.diare_alert.summary_status === "done" ? "siap" : "menunggu Coba Lagi"}).`
            : "⚠️ Alert diare Sumberasih belum terbentuk.") +
          (r.snapshot_found ? "" : " ⚠️ Snapshot AI tidak ditemukan."),
        error: !r.diare_alert || !r.snapshot_found,
      });
      setConfirming(false);
      router.refresh();
    } catch {
      setMessage({ text: "Tidak dapat menghubungi server.", error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 max-w-md">
      {!confirming ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
          <RotateCcw />
          Reset Demo
        </Button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-xs text-muted-foreground">Hapus semua aduan latihan dan pulihkan data demo?</span>
          <Button type="button" size="sm" variant="destructive" onClick={handleReset} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            {loading ? "Mereset… (±1 menit)" : "Ya, reset"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={loading}>
            Batal
          </Button>
        </div>
      )}
      {message && (
        <p className={message.error ? "text-xs text-destructive text-right" : "text-xs text-muted-foreground text-right"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
