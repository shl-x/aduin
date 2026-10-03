/**
 * src/components/urgency-bar.tsx
 *
 * Urgensi 1–5 sebagai bar 5 segmen yang terisi sesuai nilainya, plus angka
 * IBM Plex Mono sehingga informasinya tidak hanya lewat warna/bentuk.
 * Urgensi ≥ 4 memakai oranye (butuh perhatian), sisanya biru primary.
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

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      role="img"
      aria-label={`Urgensi ${level} dari 5`}
    >
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn(
              "rounded-[1px]",
              size === "sm" ? "h-3 w-1.5" : "h-4 w-2.5",
              i <= level ? (high ? "bg-accent" : "bg-primary") : "bg-line"
            )}
          />
        ))}
      </span>
      {showValue && (
        <span
          className={cn("font-mono font-semibold", size === "sm" ? "text-xs" : "text-sm", high ? "text-accent-text" : "text-ink")}
          aria-hidden
        >
          {level}/5
        </span>
      )}
    </span>
  );
}
