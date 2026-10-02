"use client";

/**
 * src/components/generate-plan-button.tsx
 *
 * Tombol "Buat Rencana Koordinasi" (operator) — memanggil
 * POST /api/coordination/[id]. Jika gagal, rencana lama tetap tampil dan
 * pesan error ditampilkan di bawah tombol.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GeneratePlanButton({
  complaintId,
  hasAiPlan,
}: {
  complaintId: string;
  hasAiPlan: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coordination/${complaintId}`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError({
          message: body?.error ?? "Gagal membuat rencana koordinasi. Silakan coba lagi.",
          detail: body?.detail,
        });
        return;
      }
      router.refresh();
    } catch {
      setError({ message: "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Menyusun rencana…
          </>
        ) : (
          <>
            <Sparkles />
            {hasAiPlan ? "Buat Ulang Rencana Koordinasi" : "Buat Rencana Koordinasi"}
          </>
        )}
      </Button>
      {loading && (
        <p className="text-xs text-muted-foreground">
          AI sedang menyusun sub-tugas lintas OPD. Proses ini bisa memakan waktu hingga 1 menit.
        </p>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
          <p className="text-destructive font-medium">{error.message}</p>
          <p className="text-muted-foreground mt-1">Rencana sebelumnya tidak berubah.</p>
          {error.detail && (
            <details className="mt-1 text-muted-foreground">
              <summary className="cursor-pointer">Detail teknis</summary>
              <p className="mt-1 break-words">{error.detail}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
