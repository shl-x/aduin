"use client";

/**
 * src/components/theme-provider.tsx
 *
 * Pembungkus next-themes: class "dark" di <html>, default mengikuti sistem,
 * pilihan pengguna disimpan di localStorage oleh next-themes.
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
