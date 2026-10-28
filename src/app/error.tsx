"use client";

/**
 * src/app/error.tsx
 *
 * Error boundary global — menangkap error tak terduga di halaman mana pun
 * yang tidak punya error.tsx sendiri (mis. /peta saat query Supabase gagal).
 */

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="rounded-lg border bg-surface px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-md border-[1.5px] border-danger text-danger-text">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <p className="text-[13px] font-bold text-danger-text">Gangguan sistem</p>
          <div role="alert">
            <h1 className="text-lg font-bold">Terjadi kesalahan saat memuat halaman</h1>
            <p className="text-sm text-muted-foreground mt-1 break-words">{error.message}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Coba lagi</Button>
            <Button variant="outline" render={<Link href="/" />}>
              Ke beranda
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
