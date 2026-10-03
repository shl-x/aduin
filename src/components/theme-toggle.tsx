"use client";

/**
 * src/components/theme-toggle.tsx
 *
 * Tombol ganti mode terang/gelap. Ikon matahari/bulan dipilih lewat CSS
 * (dark:hidden / dark:block), dan label tidak bergantung pada tema aktif,
 * sehingga markup server dan client identik (tanpa hydration mismatch).
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Ganti mode terang atau gelap"
      title="Ganti mode terang/gelap"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink transition-colors duration-150 hover:bg-muted",
        className
      )}
    >
      <Sun className="size-4 dark:hidden" aria-hidden />
      <Moon className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}
