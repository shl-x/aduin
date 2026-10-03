/**
 * src/app/layout.tsx
 *
 * Root layout Aduin — Server Component.
 *
 * Membaca role pengguna dari sesi Supabase (cookie) di server,
 * lalu meneruskannya sebagai prop ke SidebarNav dan RoleSwitcher.
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
import { MobileNav, SidebarNav } from "@/components/sidebar-nav";
import { RoleSwitcher } from "@/components/role-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AduinMark } from "@/components/brand/AduinLogo";
import { getSessionRole } from "@/lib/supabase/server";

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
          <div className="flex min-h-screen">
            <SidebarNav role={role} />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface/95 px-4 py-2 md:px-6">
                <Link href="/" className="md:hidden inline-flex rounded-md" aria-label="Aduin — beranda">
                  <AduinMark size={28} title="" />
                </Link>
                <ThemeToggle className="ml-auto sm:order-last sm:ml-0" />
                <div className="order-last flex w-full min-w-0 items-center sm:order-none sm:ml-auto sm:w-auto">
                  <RoleSwitcher currentRole={role} />
                </div>
              </header>
              <MobileNav role={role} />
              <main id="konten" tabIndex={-1} className="flex-1 p-4 md:p-6 outline-none">
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
