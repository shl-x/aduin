/**
 * supabase/seed/accounts.ts
 *
 * Buat 5 akun demo via Supabase Auth Admin API, lalu set profil yang benar.
 * Password diambil dari DEMO_SEED_PASSWORD di .env.local.
 *
 * Akun:
 *   warga@demo.aduin     → warga
 *   operator@demo.aduin  → operator
 *   pu@demo.aduin        → petugas_opd (DPU)
 *   dinkes@demo.aduin    → petugas_opd (Dinkes)
 *   pimpinan@demo.aduin  → pimpinan
 */

import { createClient } from "../../src/lib/supabase/client";
import { OPD_ID_BY_SHORT } from "./opd";

export interface DemoAccount {
  email: string;
  fullName: string;
  role: "warga" | "operator" | "petugas_opd" | "pimpinan";
  opdShortName?: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "warga@demo.aduin",    fullName: "Warga Demo",    role: "warga" },
  { email: "operator@demo.aduin", fullName: "Operator Demo", role: "operator" },
  { email: "pu@demo.aduin",       fullName: "Petugas DPU",   role: "petugas_opd", opdShortName: "DPU" },
  { email: "dinkes@demo.aduin",   fullName: "Petugas Dinkes",role: "petugas_opd", opdShortName: "Dinkes" },
  { email: "pimpinan@demo.aduin", fullName: "Pimpinan Demo", role: "pimpinan" },
];

/** Map email → auth user id (diisi setelah pembuatan akun) */
export const DEMO_ACCOUNT_IDS: Record<string, string> = {};

export async function seedAccounts(): Promise<void> {
  const supabase = createClient();

  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password) {
    throw new Error("DEMO_SEED_PASSWORD tidak ditemukan di environment");
  }

  for (const account of DEMO_ACCOUNTS) {
    // Cek apakah sudah ada
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users.find((u) => u.email === account.email);

    let userId: string;

    if (found) {
      userId = found.id;
      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        userId,
        { password, email_confirm: true }
      );
      if (updateErr) {
        throw new Error(
          `Gagal update password ${account.email}: ${updateErr.message}`
        );
      }
      console.log(`  ℹ️  Akun sudah ada, password disinkronkan: ${account.email} (${userId})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: account.fullName,
          role: account.role,
        },
      });
      if (error || !data.user) {
        throw new Error(`Gagal membuat akun ${account.email}: ${error?.message}`);
      }
      userId = data.user.id;
      console.log(`  ✅ Akun dibuat: ${account.email} (${userId})`);
    }

    DEMO_ACCOUNT_IDS[account.email] = userId;

    // Upsert profil (trigger handle_new_user mungkin sudah membuatnya,
    // tapi kita pastikan role dan is_demo benar)
    const opdId = account.opdShortName ? OPD_ID_BY_SHORT[account.opdShortName] : null;
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: account.fullName,
          role: account.role,
          opd_id: opdId ?? null,
          is_demo: true,
        },
        { onConflict: "id" }
      );
    if (profileErr) {
      throw new Error(`Gagal upsert profil ${account.email}: ${profileErr.message}`);
    }
  }

  console.log(`✅ accounts: ${DEMO_ACCOUNTS.length} akun demo siap`);
}
