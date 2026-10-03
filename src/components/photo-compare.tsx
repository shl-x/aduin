/**
 * src/components/photo-compare.tsx
 *
 * Foto sebelum dan sesudah berdampingan — dipakai di /aduan/[id] dan
 * daftar "Aduan Saya" di /lapor. Aman dirender di Server maupun Client
 * Component (tanpa state).
 */
import Image from "next/image";
import { ImageOff } from "lucide-react";

function PhotoSlot({ label, url }: { label: string; url: string | null }) {
  return (
    <figure className="space-y-1">
      <figcaption className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</figcaption>
      <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-muted">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Image src={url} alt={`Foto ${label.toLowerCase()}`} fill className="object-cover" unoptimized />
          </a>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="size-5" aria-hidden />
            <span className="text-xs">Tidak ada foto</span>
          </div>
        )}
      </div>
    </figure>
  );
}

export function PhotoCompare({
  beforeUrl,
  afterUrl,
}: {
  beforeUrl: string | null;
  afterUrl: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <PhotoSlot label="Sebelum" url={beforeUrl} />
      <PhotoSlot label="Sesudah" url={afterUrl} />
    </div>
  );
}
