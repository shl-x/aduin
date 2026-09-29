/**
 * src/lib/supabase/browser.ts
 *
 * Supabase client untuk Client Components (browser).
 * Menggunakan NEXT_PUBLIC_* yang diakses secara LITERAL agar Next.js dapat
 * menyisipkan nilainya ke bundle browser saat build time.
 *
 * ⚠️  Jangan import file ini di Server Components, Route Handlers, atau seed scripts.
 *     Untuk kode server gunakan src/lib/supabase/client.ts (admin) atau
 *     src/lib/supabase/server.ts (cookie-based SSR).
 */

import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL tidak ditemukan. Pastikan .env.local sudah diisi."
  );
}
if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan. Pastikan .env.local sudah diisi."
  );
}

/**
 * Browser-side Supabase client — gunakan di Client Components.
 * Hanya mengakses data sesuai RLS yang berlaku untuk pengguna yang login.
 */
export function createBrowserSupabaseClient() {
  // Nilai sudah divalidasi di atas; non-null assertion aman di sini.
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
