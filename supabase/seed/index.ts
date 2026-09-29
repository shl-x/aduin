/**
 * supabase/seed/index.ts
 *
 * Orchestrator seed: jalankan semua modul seed secara berurutan.
 * Urutan: regions → OPD → accounts → complaints
 *
 * Jalankan dengan:
 *   npx tsx supabase/seed/index.ts
 *
 * Prasyarat: .env.local harus sudah diisi dengan nilai:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DEMO_SEED_PASSWORD
 */

import "dotenv/config";
import { seedRegions } from "./regions";
import { seedOpd } from "./opd";
import { seedAccounts } from "./accounts";
import { seedComplaints } from "./complaints";

async function main(): Promise<void> {
  console.log("🌱 Memulai seed Aduin...\n");

  try {
    await seedRegions();
    await seedOpd();
    await seedAccounts();
    const count = await seedComplaints();

    console.log(`\n✅ Seed selesai — ${count} aduan dimuat ke database.`);
    console.log("\nAkun demo yang tersedia:");
    console.log("  warga@demo.aduin     → role: warga");
    console.log("  operator@demo.aduin  → role: operator");
    console.log("  pu@demo.aduin        → role: petugas_opd (DPU)");
    console.log("  dinkes@demo.aduin    → role: petugas_opd (Dinkes)");
    console.log("  pimpinan@demo.aduin  → role: pimpinan");
    console.log("  Password: DEMO_SEED_PASSWORD dari .env.local\n");
  } catch (err) {
    console.error("\n❌ Seed gagal:", err);
    process.exit(1);
  }
}

void main();
