/**
 * src/components/urgency-bar.tsx
 *
 * Urgensi 1–5 sebagai bar 5 segmen yang terisi sesuai nilainya, plus label
 * kata ("Tinggi · 4 dari 5") sehingga informasinya tidak hanya lewat
 * warna/bentuk. Urgensi ≥ 4 memakai oranye (mendesak), sisanya biru primary.
 */

import { cn } from "@/lib/utils";

interface UrgencyBarProps {
  value: number | null | undefined;
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function UrgencyBar({ value, showValue = true, size = "sm", className }: UrgencyBarProps) {
  if (value == null) {
    return <span className="font-mono text-muted-foreground">—</span>;
  }
  const level = Math.max(0, Math.min(5, Math.round(value)));
  const high = level >= 4;
  const word = high ? "Tinggi" : level === 3 ? "Sedang" : "Rendah";

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      role="img"
      aria-label={`Mendesak: ${word}, ${level} dari 5`}
    >
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn(
              "rounded-[1px]",
              size === "sm" ? "h-3.5 w-2" : "h-[18px] w-2.5",
              i <= level ? (high ? "bg-accent-strong" : "bg-primary") : "bg-line"
            )}
          />
        ))}
      </span>
      {showValue && (
        <span
          className={cn("font-bold whitespace-nowrap", size === "sm" ? "text-[13px]" : "text-[15px]", high ? "text-accent-text" : "text-ink")}
          aria-hidden
        >
          {word} · {level} dari 5
        </span>
      )}
    </span>
  );
}
