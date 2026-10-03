/**
 * src/app/api/demo/login/route.ts
 *
 * POST /api/demo/login
 *
 * Login instan ke akun demo. Password (DEMO_SEED_PASSWORD) hanya pernah
 * dibaca di server — tidak pernah dikirim ke atau dibaca di browser.
 * RoleSwitcher cukup mengirim `key` akun, lalu memanggil router.refresh()
 * setelah cookie sesi terpasang oleh createServerSupabaseClient.
 *
 * Hanya aktif jika NEXT_PUBLIC_DEMO_MODE=true.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DEMO_ACCOUNT_EMAILS: Record<string, string> = {
  warga: "warga@demo.aduin",
  operator: "operator@demo.aduin",
  pu: "pu@demo.aduin",
  dinkes: "dinkes@demo.aduin",
  bpkad: "bpkad@demo.aduin",
  pimpinan: "pimpinan@demo.aduin",
};

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Endpoint ini hanya tersedia di mode demo." },
      { status: 403 }
    );
  }

  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "DEMO_SEED_PASSWORD belum diset di server." },
      { status: 500 }
    );
  }

  let key: unknown;
  try {
    const body = await request.json();
    key = body?.key;
  } catch {
    return NextResponse.json(
      { error: "Body request tidak valid." },
      { status: 400 }
    );
  }

  const email = typeof key === "string" ? DEMO_ACCOUNT_EMAILS[key] : undefined;
  if (!email) {
    return NextResponse.json(
      { error: "Akun demo tidak dikenal." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { error: `Login gagal: ${error.message}` },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
