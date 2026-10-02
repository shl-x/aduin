/**
 * src/lib/supabase/server.ts
 *
 * Supabase client berbasis cookie untuk Server Components dan Route Handlers.
 * Membaca sesi dari cookie request sehingga server selalu mendapatkan user
 * yang sedang login — sumber kebenaran tunggal untuk role.
 *
 * Gunakan HANYA di Server Components, Route Handlers, dan middleware.
 * Jangan import di Client Components.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { UserRole } from "@/components/sidebar-nav";

/**
 * Buat Supabase client yang membaca/menulis cookie sesi lewat next/headers.
 * Menggunakan ANON key + RLS (bukan SERVICE_ROLE) agar sesi per-user berlaku.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll dipanggil dari Server Component — diabaikan.
            // Middleware yang akan memperbarui cookie sesi.
          }
        },
      },
    }
  );
}

/**
 * Ambil role pengguna yang sedang login dari tabel profiles.
 * Mengembalikan null jika tidak ada sesi aktif.
 */
export async function getSessionRole(): Promise<UserRole | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Gunakan service-role client untuk membaca profiles (bypass RLS yang
  // mungkin belum aktif di awal, dan menghindari rekursi cookie-client).
  const { createClient } = await import("@/lib/supabase/client");
  const adminClient = createClient();
  const { data } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const valid: UserRole[] = ["warga", "operator", "petugas_opd", "pimpinan"];
  const role = data?.role as UserRole | undefined;
  return role && valid.includes(role) ? role : null;
}

export interface SessionProfile {
  id: string;
  role: UserRole;
  opd_id: string | null;
}

/**
 * Ambil profil lengkap pengguna yang sedang login (id, role, opd_id).
 * Dipakai fitur yang bergantung pada OPD petugas (portal /tugas, PATCH tugas).
 * Mengembalikan null jika tidak ada sesi aktif atau role tidak valid.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { createClient } = await import("@/lib/supabase/client");
  const adminClient = createClient();
  const { data } = await adminClient
    .from("profiles")
    .select("role, opd_id")
    .eq("id", user.id)
    .single();

  const valid: UserRole[] = ["warga", "operator", "petugas_opd", "pimpinan"];
  const role = data?.role as UserRole | undefined;
  if (!role || !valid.includes(role)) return null;

  return { id: user.id, role, opd_id: (data?.opd_id as string | null) ?? null };
}
