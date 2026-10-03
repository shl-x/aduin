/**
 * supabase/seed/index.ts
 *
 * Seed utama: membangun keadaan demo lengkap lewat buildDemoState()
 * (supabase/seed/demo-state.ts) — wilayah, OPD, akun demo, ±150 aduan seed,
 * hasil AI dari ai-cache-snapshot.json (tanpa memanggil Langflow), rencana
 * sederhana, clustering, lalu timeline segar + early warning.
 *
 * ⚠️  Destruktif untuk data demo: semua aduan (termasuk aduan latihan non-seed),
 *    alert, dan cluster dihapus lalu dibangun ulang. Akun demo tidak dihapus.
 *
 * Jalankan:
 *   npx tsx --env-file=.env.local supabase/seed/index.ts
 *
 * Prasyarat .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * DEMO_SEED_PASSWORD; migrasi 0001–0004 sudah diterapkan.
 */

import "dotenv/config";
import { buildDemoState } from "./demo-state";

async function main(): Promise<void> {
  console.log("🌱 Memulai seed Aduin...\n");

  try {
    const result = await buildDemoState({ syncPasswords: true, log: (m) => console.log(m) });
    const diare = result.timeline.activeAlerts.find((a) => a.category === "kesehatan_diare");

    console.log(`\n✅ Seed selesai — ${result.seededComplaints} aduan seed.`);
    console.log(
      result.snapshotFound
        ? `   Hasil AI dari snapshot: ${result.snapshot.triage} triage, ${result.snapshot.embeddings} embedding, ${result.snapshot.cache} entri ai_cache`
        : "   ⚠️  Snapshot AI tidak ditemukan — jalankan triage-seed.ts, embed-seed.ts, lalu precompute-ai.ts."
    );
    console.log(`   Rencana sederhana: ${result.snapshot.plans} · cluster: ${result.clusters}`);
    console.log(
      diare
        ? `   🚨 Alert diare Sumberasih aktif (z=${diare.z_score}, ringkasan=${diare.summary_status})`
        : "   ⚠️  Alert diare Sumberasih belum terbentuk."
    );

    console.log("\nAkun demo yang tersedia:");
    console.log("  warga@demo.aduin     → role: warga");
    console.log("  operator@demo.aduin  → role: operator");
    console.log("  pu@demo.aduin        → role: petugas_opd (DPU)");
    console.log("  dinkes@demo.aduin    → role: petugas_opd (Dinkes)");
    console.log("  bpkad@demo.aduin     → role: petugas_opd (BPKAD)");
    console.log("  pimpinan@demo.aduin  → role: pimpinan");
    console.log("  Password: DEMO_SEED_PASSWORD dari .env.local\n");
  } catch (err) {
    console.error("\n❌ Seed gagal:", err);
    process.exitCode = 1;
  }
}

void main();
