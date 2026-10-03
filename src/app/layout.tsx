/**
 * src/app/layout.tsx
 *
 * Root layout Aduin — Server Component.
 *
 * Membaca role pengguna dari sesi Supabase (cookie) di server,
 * lalu meneruskannya sebagai prop ke SidebarNav dan RoleSwitcher.
 * Dengan demikian server dan client merender markup yang identik
 * dan tidak ada hydration mismatch.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { RoleSwitcher } from "@/components/role-switcher";
import { getSessionRole } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Header demo — hanya tampil saat NEXT_PUBLIC_DEMO_MODE=true */}
        <header className="h-10 border-b bg-muted/40 flex items-center px-4 gap-3 shrink-0">
          <Link
            href="/"
            className="text-xs font-semibold text-muted-foreground tracking-wide uppercase hover:text-foreground"
          >
            Aduin Demo
          </Link>
          <div className="ml-auto">
            <RoleSwitcher currentRole={role} />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav role={role} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
