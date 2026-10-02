"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TugasError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle size={40} strokeWidth={1.2} className="text-destructive" />
          <div>
            <p className="font-medium">Gagal memuat daftar tugas</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={reset}>
            Coba lagi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
