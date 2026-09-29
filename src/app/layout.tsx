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
 * Role sementara disimpan di localStorage untuk demo M0.
 * M1 akan mengganti ini dengan Supabase Auth + RoleSwitcher.
 */

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";

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
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
