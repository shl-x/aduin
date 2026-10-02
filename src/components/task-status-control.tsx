"use client";

/**
 * src/components/task-status-control.tsx
 *
 * Tombol perubahan status sub-tugas untuk petugas OPD
 * (PATCH /api/tasks/[taskId]): belum_mulai → proses → selesai.
 * Tugas yang masih menunggu dependensi tidak bisa dimulai.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/lib/constants/tasks";

export function TaskStatusControl({
  taskId,
  status,
  waiting,
}: {
  taskId: string;
  status: TaskStatus;
  waiting: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "selesai") return null;

  const next: TaskStatus = status === "belum_mulai" ? "proses" : "selesai";
  const label = status === "belum_mulai" ? "Mulai Kerjakan" : "Tandai Selesai";

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Gagal memperbarui status tugas.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant={next === "selesai" ? "default" : "outline"}
        onClick={handleClick}
        disabled={loading || waiting}
        title={waiting ? "Selesaikan tugas prasyarat terlebih dahulu" : undefined}
      >
        {loading && <Loader2 className="animate-spin" />}
        {waiting ? "Menunggu prasyarat" : loading ? "Menyimpan…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
