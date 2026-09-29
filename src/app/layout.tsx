/**
 * src/app/layout.tsx
 *
 * Root layout Aduin.
 * Sidebar navigasi berbeda per role:
 *   warga        → /lapor
 *   operator     → /dashboard, /peta, /alert
 *   petugas_opd  → /tugas
 *   pimpinan     → /ringkasan
 *
 * Header berisi <RoleSwitcher /> yang hanya tampil saat NEXT_PUBLIC_DEMO_MODE=true.
 */

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { RoleSwitcher } from "@/components/role-switcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aduin — Analitik Pengaduan Masyarakat",
  description:
    "Otak analitik di balik kanal pengaduan masyarakat pemerintah daerah.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Header: hanya tampil di mode demo */}
        <header className="h-10 border-b bg-muted/40 flex items-center px-4 gap-3 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Aduin Demo
          </span>
          <div className="ml-auto">
            <RoleSwitcher />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
