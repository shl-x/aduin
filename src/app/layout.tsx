/**
 * src/app/layout.tsx
 *
 * Root layout Aduin — Server Component.
 *
 * Membaca role pengguna dari sesi Supabase (cookie) di server,
 * lalu meneruskannya sebagai prop ke MainNav dan RoleSwitcher.
 * Tata letak "Meja Kerja": header atas berisi logo, menu per role, pengganti
 * role demo, dan tombol tema; konten di kolom tengah selebar maks. 1280px.
 * Dengan demikian server dan client merender markup yang identik
 * dan tidak ada hydration mismatch.
 *
 * Tema (terang/gelap) dikelola next-themes; suppressHydrationWarning di <html>
 * karena next-themes memasang class "dark" sebelum React hydrate.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { MainNav } from "@/components/sidebar-nav";
import { RoleSwitcher } from "@/components/role-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AduinLogo } from "@/components/brand/AduinLogo";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { getActiveAlerts } from "@/lib/analytics/early-warning";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Aduin — Aduin aja, sisanya kami yang urus.",
    template: "%s · Aduin",
  },
  description:
    "Otak analitik di balik kanal pengaduan masyarakat pemerintah daerah.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Baca role dari sesi cookie — null jika belum login
  const role = await getSessionRole();
  // Badge "Peringatan" di menu operator; gagal memuat tidak boleh menjatuhkan halaman.
  const alertCount =
    role === "operator" ? await getActiveAlerts(createClient()).then((a) => a.length, () => 0) : 0;

  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <a
            href="#konten"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Lewati ke konten
          </a>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b bg-surface">
              <div className="mx-auto flex min-h-[68px] max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 md:px-8">
                <Link href="/" className="inline-flex rounded-md" aria-label="Aduin — beranda">
                  <AduinLogo variant="horizontal" size={30} title="" />
                </Link>
                <MainNav role={role} alertCount={alertCount} />
                <div className="ml-auto flex min-w-0 items-center gap-2">
                  <RoleSwitcher currentRole={role} />
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main
              id="konten"
              tabIndex={-1}
              className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 outline-none md:px-8 md:py-8"
            >
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
