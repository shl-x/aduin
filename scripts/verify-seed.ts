// Skrip verifikasi ringan — TIDAK import Supabase client
// Hanya memvalidasi distribusi aduan seed secara lokal

// Baca data seed sebagai teks dan ekstrak pola
import { readFileSync } from "fs";

const text = readFileSync("./supabase/seed/complaints.ts", "utf-8");

// Hitung id: "c-xxx-NNN" patterns
const idMatches = text.match(/id:\s*"c-[a-z]+-\d+"/g) ?? [];
const total = idMatches.length;

// Status counts
const statusCounts: Record<string, number> = {};
const statusRe = /status:\s*"([^"]+)"/g;
let m: RegExpExecArray | null;
while ((m = statusRe.exec(text)) !== null) {
  statusCounts[m[1]] = (statusCounts[m[1]] ?? 0) + 1;
}

// Category counts
const catCounts: Record<string, number> = {};
const catRe = /label_manual:\s*"([^"]+)"/g;
while ((m = catRe.exec(text)) !== null) {
  catCounts[m[1]] = (catCounts[m[1]] ?? 0) + 1;
}

console.log("=== VERIFIKASI SEED COMPLAINTS ===");
console.log(`Total aduan: ${total}`);
console.log("\nDistribusi status:");
for (const [k, v] of Object.entries(statusCounts).sort()) {
  const req: Record<string, string> = {
    pending: "≥5 (min)",
    triage_failed: "≥3 (min)",
    triaged: "≥30 (min)",
    in_progress: "≥15 (min)",
    ai_verified: "≥5 (min)",
    needs_review: "≥3 (min)",
    closed: "≥20 (min)",
  };
  console.log(`  ${k.padEnd(15)} : ${String(v).padStart(3)}  ${req[k] ?? ""}`);
}

console.log("\nDistribusi kategori (semua 7 harus ada):");
const EXPECTED_SLUGS = [
  "infrastruktur_jalan",
  "kesehatan_diare",
  "pengelolaan_sampah",
  "banjir_drainase",
  "air_bersih_pdam",
  "pendidikan",
  "pkl_tata_ruang",
];
let catOk = true;
for (const slug of EXPECTED_SLUGS) {
  const count = catCounts[slug] ?? 0;
  if (count === 0) catOk = false;
  console.log(`  ${slug.padEnd(22)} : ${count}`);
}

// Spike check
const spikeLines = text.match(/hoursAgo\(\d+\)/g) ?? [];
const clustLines = text.match(/"c-ban-00[1-6]"/g) ?? [];
console.log(`\nSpike diare Sumberasih (hoursAgo): ${spikeLines.length} aduan dalam 24 jam`);
console.log(`Cluster jalan Bantaran: ${clustLines.length} aduan (dibutuhkan ≥6)`);

console.log("\n=== HASIL ===");
const minOk =
  (statusCounts["pending"] ?? 0) >= 5 &&
  (statusCounts["triage_failed"] ?? 0) >= 3 &&
  (statusCounts["triaged"] ?? 0) >= 30 &&
  (statusCounts["in_progress"] ?? 0) >= 15 &&
  (statusCounts["ai_verified"] ?? 0) >= 5 &&
  (statusCounts["needs_review"] ?? 0) >= 3 &&
  (statusCounts["closed"] ?? 0) >= 20;
console.log(`Status minimum terpenuhi: ${minOk ? "✅ YA" : "❌ TIDAK"}`);
console.log(`Semua 7 kategori ada: ${catOk ? "✅ YA" : "❌ TIDAK"}`);
console.log(`Total ~150: ${total >= 140 && total <= 160 ? "✅ YA" : `⚠️  ${total} (di luar rentang)`}`);
