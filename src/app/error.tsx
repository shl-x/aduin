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
import { Card, CardContent } from "@/components/ui/card";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <AlertTriangle size={40} strokeWidth={1.2} className="text-destructive" />
            <div>
              <p className="font-medium">Terjadi kesalahan saat memuat halaman</p>
              <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reset}>
                Coba lagi
              </Button>
              <Button size="sm" variant="ghost" render={<Link href="/" />}>
                Ke beranda
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
