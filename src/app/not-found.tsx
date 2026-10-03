/**
 * src/app/not-found.tsx
 *
 * Halaman 404 — juga dipakai saat notFound() dipanggil, mis. /aduan/[id]
 * dengan id yang tidak ada (atau aduan latihan yang terhapus oleh Reset Demo).
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AduinMark } from "@/components/brand/AduinLogo";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="rounded-lg border bg-surface px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <AduinMark size={48} title="" />
          <p className="font-mono text-4xl font-semibold tracking-tight text-ink">404</p>
          <div>
            <h1 className="text-lg font-bold">Halaman atau aduan tidak ditemukan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Data mungkin sudah dihapus, misalnya setelah Reset Demo.
            </p>
          </div>
          <Button variant="outline" render={<Link href="/" />}>
            Kembali ke beranda
          </Button>
        </div>
      </div>
    </div>
  );
}
