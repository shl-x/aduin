"use client";

/**
 * src/components/role-switcher.tsx
 *
 * Login-instan antar-akun demo.
 * Hanya dirender saat NEXT_PUBLIC_DEMO_MODE=true.
 *
 * Setelah signInWithPassword berhasil, memanggil router.refresh() agar
 * Server Components merender ulang dengan sesi baru (role baru) tanpa full reload.
 * Tidak membaca localStorage. Role aktif diterima sebagai prop dari server.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/components/sidebar-nav";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface DemoRoleConfig {
  email: string;
  label: string;
  role: UserRole;
}

const DEMO_ROLES: DemoRoleConfig[] = [
  { email: "warga@demo.aduin",    label: "Warga",    role: "warga" },
  { email: "operator@demo.aduin", label: "Operator", role: "operator" },
  { email: "pu@demo.aduin",       label: "DPU",      role: "petugas_opd" },
  { email: "dinkes@demo.aduin",   label: "Dinkes",   role: "petugas_opd" },
  { email: "pimpinan@demo.aduin", label: "Pimpinan", role: "pimpinan" },
];

interface RoleSwitcherProps {
  currentRole: UserRole | null;
}

export function RoleSwitcher({ currentRole }: RoleSwitcherProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!DEMO_MODE) return null;

  async function switchTo(email: string) {
    setLoading(email);
    setError(null);

    const supabase = createBrowserClient();
    const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
    if (!password) {
      setError("NEXT_PUBLIC_DEMO_PASSWORD belum diset.");
      setLoading(null);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(`Login gagal: ${authError.message}`);
      setLoading(null);
      return;
    }

    // router.refresh() meminta server merender ulang layout dengan sesi baru.
    // Lebih cepat dari window.location.reload() karena tidak reload seluruh halaman.
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        Demo:
      </span>
      {DEMO_ROLES.map((demo) => {
        const isActive = currentRole === demo.role &&
          // untuk petugas_opd ada 2 akun; biarkan keduanya aktif jika role cocok
          true;
        return (
          <Button
            key={demo.email}
            variant={isActive ? "default" : "outline"}
            size="sm"
            disabled={loading !== null}
            onClick={() => switchTo(demo.email)}
            className={cn("h-7 px-2.5 text-xs", isActive && "font-semibold")}
          >
            {loading === demo.email ? (
              <span className="animate-pulse">Masuk…</span>
            ) : (
              demo.label
            )}
          </Button>
        );
      })}
      {error && (
        <span className="text-xs text-destructive ml-1">{error}</span>
      )}
    </div>
  );
}
