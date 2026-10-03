/**
 * src/app/not-found.tsx
 *
 * Halaman 404 — juga dipakai saat notFound() dipanggil, mis. /aduan/[id]
 * dengan id yang tidak ada (atau aduan latihan yang terhapus oleh Reset Demo).
 */
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
            <SearchX size={40} strokeWidth={1.2} />
            <div>
              <p className="font-medium text-foreground">Halaman atau aduan tidak ditemukan</p>
              <p className="text-sm mt-1">Data mungkin sudah dihapus, misalnya setelah Reset Demo.</p>
            </div>
            <Link href="/" className="text-sm text-primary hover:underline">
              Kembali ke beranda
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
