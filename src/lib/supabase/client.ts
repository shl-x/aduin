/**
 * src/lib/supabase/client.ts
 *
 * Dua factory function Supabase:
 *  - createClient()        → server-side dengan SERVICE_ROLE_KEY (bypass RLS untuk operasi admin)
 *  - createBrowserClient() → client-side dengan NEXT_PUBLIC_* keys
 *
 * Jangan pernah kirim SERVICE_ROLE_KEY ke browser.
 */

import { createClient as supabaseCreateClient } from "@supabase/supabase-js";
import { createBrowserClient as supabaseBrowserClient } from "@supabase/ssr";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabel lingkungan wajib tidak ditemukan: ${name}`);
  }
  return value;
}

/**
 * Server-side Supabase client — gunakan di Route Handlers, Server Components,
 * dan script seed. Menggunakan SERVICE_ROLE_KEY sehingga melewati RLS.
 */
export function createClient() {
  return supabaseCreateClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        // Tidak perlu sesi di server-side service role
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Browser-side Supabase client — gunakan di Client Components.
 * Hanya mengakses data sesuai RLS yang berlaku untuk pengguna yang login.
 */
export function createBrowserClient() {
  return supabaseBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
