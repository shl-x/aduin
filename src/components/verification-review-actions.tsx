"use client";

/**
 * src/components/verification-review-actions.tsx
 *
 * Tombol tinjauan operator untuk aduan needs_review
 * (POST /api/verify/[id]/review): "Setujui Manual" (catatan opsional) dan
 * "Kembalikan ke Petugas" (catatan wajib).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function VerificationReviewActions({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"approve" | "return" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "approve" | "return") {
    if (action === "return" && !note.trim()) {
      setError("Tulis catatan alasan sebelum mengembalikan ke petugas.");
      return;
    }
    setPending(action);
    setError(null);
    try {
      const res = await fetch(`/api/verify/${complaintId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Gagal menyimpan tinjauan.");
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan tinjauan (wajib jika dikembalikan ke petugas)"
        className="min-h-16"
        disabled={pending !== null}
      />
      {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => submit("approve")} disabled={pending !== null}>
          {pending === "approve" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Setujui Manual
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => submit("return")}
          disabled={pending !== null}
        >
          {pending === "return" ? <Loader2 className="animate-spin" /> : <Undo2 />}
          Kembalikan ke Petugas
        </Button>
      </div>
    </div>
  );
}
