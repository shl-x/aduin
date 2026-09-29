/**
 * supabase/seed/uuid.ts
 *
 * UUID v5 deterministik untuk data seed Aduin.
 *
 * UUID v5 = SHA-1(namespace + name), diformat sebagai UUID.
 * Namespace tetap (Aduin-specific) memastikan hasil sama setiap kali
 * seed dijalankan ulang, sehingga referensi FK antar tabel selalu konsisten.
 *
 * Penggunaan:
 *   import { sid } from "./uuid";
 *   sid("r-kec-bantaran")  // → "d3e4f5a6-..." (selalu sama)
 *
 * Tidak ada dependensi eksternal — hanya memakai crypto bawaan Node.js.
 */

import { createHash } from "crypto";

/**
 * Namespace khusus Aduin seed (UUID v4 acak, di-hardcode selamanya).
 * Jangan diubah — mengubahnya akan menghasilkan UUID berbeda dan merusak
 * referensi FK pada data seed yang sudah ada di database.
 */
const ADUIN_SEED_NAMESPACE = "a5f3c2d1-8b7e-4f6a-9c0d-1e2b3a4d5f60";

/**
 * Konversi namespace UUID string ke Buffer 16 byte.
 */
function namespaceToBytes(ns: string): Buffer {
  const hex = ns.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

const NS_BYTES = namespaceToBytes(ADUIN_SEED_NAMESPACE);

/**
 * Hasilkan UUID v5 deterministik dari slug.
 *
 * @param slug - String unik yang mengidentifikasi entitas seed
 *               (contoh: "r-kec-bantaran", "opd-dpu", "c-ban-001")
 * @returns UUID v5 berformat xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx
 */
export function sid(slug: string): string {
  const hash = createHash("sha1")
    .update(NS_BYTES)
    .update(slug)
    .digest();

  // Set version bits (v5 = 0x50)
  hash[6] = (hash[6] & 0x0f) | 0x50;
  // Set variant bits (10xx)
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
