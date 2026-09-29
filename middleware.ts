/**
 * middleware.ts
 *
 * Middleware Next.js — memperbarui cookie sesi Supabase pada setiap request.
 *
 * Tanpa middleware ini, cookie access_token tidak di-refresh secara otomatis
 * di Server Components, sehingga sesi kadaluarsa atau tidak terbaca dengan benar.
 *
 * Referensi: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookie di request untuk downstream handlers
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Buat ulang response agar cookie masuk ke Set-Cookie header
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Panggil getUser() untuk memicu refresh token jika perlu.
  // Hasilnya tidak dipakai di sini — cukup agar cookie ter-update.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua path kecuali:
     * - _next/static (file statis)
     * - _next/image (optimasi gambar)
     * - favicon.ico, sitemap.xml, robots.txt
     * - file dengan ekstensi (gambar, font, dll.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
