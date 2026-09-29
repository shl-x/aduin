/**
 * src/lib/supabase/client.ts
 *
 * Supabase admin client (server-only).
 * Menggunakan SERVICE_ROLE_KEY sehingga melewati RLS — cocok untuk:
 *   - Route Handlers yang butuh akses penuh
 *   - Script seed (supabase/seed/)
 *   - Server Components yang perlu membaca data tanpa batasan RLS
 *
 * ⚠️  Jangan pernah import file ini di Client Components / browser.
 *     SERVICE_ROLE_KEY tidak boleh bocor ke bundle browser.
 *     Untuk kode browser gunakan src/lib/supabase/browser.ts.
 */

import { createClient as supabaseCreateClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabel lingkungan wajib tidak ditemukan: ${name}`);
  }
  return value;
}

/**
 * Server-side Supabase admin client.
 * Menggunakan SERVICE_ROLE_KEY — melewati RLS.
 */
export function createClient() {
  return supabaseCreateClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
