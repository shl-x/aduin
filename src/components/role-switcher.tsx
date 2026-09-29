"use client";

/**
 * src/components/role-switcher.tsx
 *
 * Komponen login-instan antar-akun demo.
 * Hanya dirender jika NEXT_PUBLIC_DEMO_MODE=true.
 *
 * Membuat ulang sesi Supabase di browser menggunakan
 * supabase.auth.signInWithPassword() dengan kredensial akun demo.
 * Setelah login berhasil, halaman di-reload agar sesi baru terbaca
 * oleh Server Components.
 */

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface DemoRole {
  email: string;
  label: string;
  color: "default" | "secondary" | "destructive" | "outline";
}

const DEMO_ROLES: DemoRole[] = [
  { email: "warga@demo.aduin",    label: "Warga",       color: "secondary" },
  { email: "operator@demo.aduin", label: "Operator",    color: "default" },
  { email: "pu@demo.aduin",       label: "DPU",         color: "outline" },
  { email: "dinkes@demo.aduin",   label: "Dinkes",      color: "outline" },
  { email: "pimpinan@demo.aduin", label: "Pimpinan",    color: "destructive" },
];

export function RoleSwitcher() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  if (!DEMO_MODE) return null;

  async function switchTo(email: string) {
    setLoading(email);
    setError(null);
    const supabase = createBrowserClient();
    // Password selalu DEMO_SEED_PASSWORD — tidak tersedia di client secara langsung,
    // jadi kita ambil lewat env publik. Nilai ini bukan secret di demo build.
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
    // Reload penuh agar sesi baru terbaca di Server Components
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        Demo:
      </span>
      {DEMO_ROLES.map((role) => (
        <Button
          key={role.email}
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() => switchTo(role.email)}
          className="h-7 px-2 text-xs"
        >
          {loading === role.email ? (
            <span className="animate-pulse">Masuk…</span>
          ) : (
            <>
              <Badge variant={role.color} className="mr-1 h-4 text-[10px]">
                {role.label}
              </Badge>
            </>
          )}
        </Button>
      ))}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
