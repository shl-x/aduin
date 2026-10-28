/**
 * src/components/brand/AduinLogo.tsx
 *
 * Logo Aduin: gelembung chat dengan tanda centang dan titik notifikasi.
 * Semua warna dari CSS variables sehingga ikut berganti tema.
 *
 * - variant "mark"       → ikon saja
 * - variant "horizontal" → ikon + wordmark di sampingnya
 * - variant "stacked"    → ikon di atas wordmark
 */

import { cn } from "@/lib/utils";

type LogoVariant = "mark" | "horizontal" | "stacked";

interface AduinLogoProps {
  variant?: LogoVariant;
  /** Tinggi ikon dalam px. Wordmark diskalakan dari nilai ini. */
  size?: number;
  className?: string;
  /** Teks alternatif; kosongkan ("") jika logo dekoratif di samping teks "Aduin". */
  title?: string;
}

export function AduinMark({
  size = 32,
  title = "Aduin",
  className,
}: {
  size?: number;
  title?: string;
  className?: string;
}) {
  // Garis centang & cincin titik memakai warna permukaan di belakang logo.
  const backdrop = "var(--surface)";
  const decorative = title === "";
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
    >
      <path
        d="M62 28 H146 A34 34 0 0 1 180 62 V112 A34 34 0 0 1 146 146 H88 L52 178 L60 146 A34 34 0 0 1 28 112 V62 A34 34 0 0 1 62 28 Z"
        fill="var(--primary)"
      />
      <polyline
        points="66,88 92,112 140,64"
        fill="none"
        stroke={backdrop}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="172" cy="36" r="20" fill="var(--accent)" stroke={backdrop} strokeWidth="8" />
    </svg>
  );
}

function Wordmark({ size }: { size: number }) {
  return (
    <span
      className="font-sans font-extrabold leading-none"
      style={{ fontSize: size, letterSpacing: "-0.03em" }}
    >
      <span style={{ color: "var(--ink)" }}>Adu</span>
      <span style={{ color: "var(--accent-text)" }}>in</span>
    </span>
  );
}

export function AduinLogo({
  variant = "horizontal",
  size = 32,
  className,
  title = "Aduin",
}: AduinLogoProps) {
  if (variant === "mark") {
    return <AduinMark size={size} title={title} className={className} />;
  }

  // Wordmark sudah memuat nama "Aduin", jadi ikon di sampingnya dekoratif.
  const label = title || undefined;
  if (variant === "stacked") {
    return (
      <span className={cn("inline-flex flex-col items-center gap-3", className)} role="img" aria-label={label}>
        <AduinMark size={size} title="" />
        <span aria-hidden>
          <Wordmark size={Math.round(size * 0.45)} />
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="img" aria-label={label}>
      <AduinMark size={size} title="" />
      <span aria-hidden>
        <Wordmark size={Math.round(size * 0.68)} />
      </span>
    </span>
  );
}
