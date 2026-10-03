/**
 * supabase/seed/complaints.ts
 *
 * ±150 aduan seed tanpa hasil AI (status: pending, triage_failed, triaged,
 * in_progress, ai_verified, needs_review, closed).
 *
 * Skenario demo tersembunyi:
 *   1. Cluster jalan rusak Bantaran — ≥6 aduan infrastruktur_jalan di desa
 *      Bantaran dalam radius 500m, dalam 14 hari terakhir.
 *   2. Lonjakan diare Sumberasih — 6 aduan kesehatan_diare di desa Sumberasih,
 *      reported_at dalam 24 jam terakhir dari waktu seed.
 *
 * Semua timestamp dibuat relatif terhadap NOW() saat seed dijalankan.
 *
 * Koordinat: nilai lat/lng yang ditulis per aduan di bawah hanya placeholder
 * historis — buildComplaints() menimpanya dengan seedComplaintCoordinate()
 * (placement.ts): diacak deterministik 150–800 m di sekitar desanya, dan
 * cluster jalan rusak Bantaran 30–200 m dari Desa Bantaran.
 *
 * Catatan: effective_category dan effective_opd_id hanya diisi untuk status
 * triaged ke atas (tanpa hasil AI nyata — ini placeholder untuk demo).
 * Script precompute-ai.ts (M7) akan mengisi nilai yang benar dari Langflow.
 */

import { createClient } from "../../src/lib/supabase/client";
import { REGIONS } from "./regions";
import { OPD_ID_BY_SHORT } from "./opd";
import { DEMO_ACCOUNT_IDS } from "./accounts";
import { sid } from "./uuid";
import { seedComplaintCoordinate } from "./placement";
import type { CategorySlug } from "../../src/lib/constants/categories";

// ---------------------------------------------------------------------------
// Helper: cari region UUID berdasarkan nama
// ---------------------------------------------------------------------------
function regionId(name: string): string {
  const r = REGIONS.find((reg) => reg.name === name);
  if (!r) throw new Error(`Region tidak ditemukan: ${name}`);
  return r.id;
}

// ---------------------------------------------------------------------------
// Helper: offset waktu dari now
// ---------------------------------------------------------------------------
function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}
function hoursAgo(h: number): string {
  return minutesAgo(h * 60);
}
function daysAgo(d: number): string {
  return hoursAgo(d * 24);
}

// ---------------------------------------------------------------------------
// Tipe ringkas aduan seed
// ---------------------------------------------------------------------------
interface ComplaintSeed {
  id: string;
  text: string;
  status: string;
  region_id: string;
  lat: number;
  lng: number;
  reported_at: string;
  closed_at?: string;
  label_manual: CategorySlug;
  is_seed: true;
  effective_category: CategorySlug | null;
  effective_opd_id: string | null;
  reporter_id: string | null;
}

// ---------------------------------------------------------------------------
// Bangun daftar aduan
// ---------------------------------------------------------------------------
export function buildComplaints(): ComplaintSeed[] {
  const wargaId = DEMO_ACCOUNT_IDS["warga@demo.aduin"] ?? null;

  const rows: ComplaintSeed[] = [];

  function add(c: ComplaintSeed) {
    rows.push(c);
  }

  // ==========================================================================
  // BANTARAN — ~40 aduan
  // Termasuk cluster jalan rusak (≥6 aduan dekat SD N 1 Bantaran)
  // Koordinat SD N 1 Bantaran ~ -7.7950, 113.1220
  // ==========================================================================

  // Cluster jalan rusak (6 aduan, radius < 500 m, 14 hari terakhir)
  const clusterJalan = [
    { slug: "c-ban-001", text: "Jalan depan SD Negeri 1 Bantaran berlubang parah, sudah beberapa bulan tidak diperbaiki. Motor sering jatuh.", lat: -7.7951, lng: 113.1221, daysBack: 2 },
    { slug: "c-ban-002", text: "Lubang jalan di Jl. Raya Bantaran km 3 sangat berbahaya, sudah ada yang kecelakaan kemarin.", lat: -7.7953, lng: 113.1218, daysBack: 3 },
    { slug: "c-ban-003", text: "Aspal terkelupas dan berlubang di depan sekolah SDN 1 Bantaran. Tolong segera diperbaiki.", lat: -7.7948, lng: 113.1224, daysBack: 5 },
    { slug: "c-ban-004", text: "Jalan rusak berat antara Bantaran-Pandean, ada lubang sedalam 20cm, kendaraan harus memutar.", lat: -7.7955, lng: 113.1215, daysBack: 7 },
    { slug: "c-ban-005", text: "Jalan rusak di dekat SDN 1 Bantaran sudah lama dibiarkan. Waktu hujan jadi kubangan lumpur.", lat: -7.7949, lng: 113.1222, daysBack: 10 },
    { slug: "c-ban-006", text: "Masih ada lubang jalan besar di Bantaran dekat sekolah dasar. Anak-anak mau ke sekolah was-was.", lat: -7.7952, lng: 113.1219, daysBack: 13 },
  ];
  for (const c of clusterJalan) {
    add({
      id: sid(c.slug),
      text: c.text,
      status: "triaged",
      region_id: regionId("Bantaran"),
      lat: c.lat,
      lng: c.lng,
      reported_at: daysAgo(c.daysBack),
      label_manual: "infrastruktur_jalan",
      is_seed: true,
      effective_category: "infrastruktur_jalan",
      effective_opd_id: OPD_ID_BY_SHORT["DPU"],
      reporter_id: wargaId,
    });
  }

  // Bantaran: aduan tambahan berbagai status
  add({ id: sid("c-ban-007"), text: "Drainase meluap saat hujan, jalan Karanganyar Bantaran tergenang.", status: "in_progress", region_id: regionId("Karanganyar"), lat: -7.8024, lng: 113.1291, reported_at: daysAgo(8), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-008"), text: "Sampah menumpuk di dekat pasar Bantaran, bau tidak sedap.", status: "triaged", region_id: regionId("Bantaran"), lat: -7.7946, lng: 113.1230, reported_at: daysAgo(4), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-ban-009"), text: "Air PDAM tidak mengalir selama 3 hari di Desa Pandean.", status: "closed", region_id: regionId("Pandean"), lat: -7.7878, lng: 113.1180, reported_at: daysAgo(20), closed_at: daysAgo(5), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-ban-010"), text: "Jalan Legundi-Bantaran rusak akibat banjir bulan lalu.", status: "pending", region_id: regionId("Legundi"), lat: -7.8068, lng: 113.1336, reported_at: hoursAgo(5), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-ban-011"), text: "PKL di trotoar Bantaran menghalangi pejalan kaki.", status: "triaged", region_id: regionId("Bantaran"), lat: -7.7943, lng: 113.1228, reported_at: daysAgo(6), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-ban-012"), text: "Atap SDN 2 Bantaran bocor, perlu perbaikan segera sebelum tahun ajaran baru.", status: "in_progress", region_id: regionId("Bantaran"), lat: -7.7940, lng: 113.1215, reported_at: daysAgo(12), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-ban-013"), text: "Limbah kotoran sapi mengalir ke sungai dekat Bantaran, bau menyengat.", status: "triage_failed", region_id: regionId("Bantaran"), lat: -7.7960, lng: 113.1200, reported_at: daysAgo(9), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-ban-014"), text: "Jalan Pandean rusak dekat jembatan, berlubang besar setelah hujan deras.", status: "triaged", region_id: regionId("Pandean"), lat: -7.7879, lng: 113.1182, reported_at: daysAgo(3), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-015"), text: "Genangan air tidak surut di Karanganyar sudah seminggu.", status: "closed", region_id: regionId("Karanganyar"), lat: -7.8025, lng: 113.1290, reported_at: daysAgo(15), closed_at: daysAgo(2), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-016"), text: "Truk sampah tidak pernah datang ke Desa Legundi lebih dari seminggu.", status: "pending", region_id: regionId("Legundi"), lat: -7.8070, lng: 113.1332, reported_at: hoursAgo(3), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-ban-017"), text: "Jalan menuju Karanganyar dari Bantaran butuh pengaspalan ulang.", status: "closed", region_id: regionId("Karanganyar"), lat: -7.8022, lng: 113.1292, reported_at: daysAgo(30), closed_at: daysAgo(10), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-018"), text: "Sumur warga di Pandean tercemari, air berbau belerang.", status: "in_progress", region_id: regionId("Pandean"), lat: -7.7877, lng: 113.1177, reported_at: daysAgo(11), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-ban-019"), text: "PKL berjualan di badan jalan Bantaran, menimbulkan kemacetan.", status: "needs_review", region_id: regionId("Bantaran"), lat: -7.7944, lng: 113.1226, reported_at: daysAgo(5), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-ban-020"), text: "Jembatan kecil di Bantaran retak, perlu pemeriksaan struktural.", status: "triage_failed", region_id: regionId("Bantaran"), lat: -7.7958, lng: 113.1210, reported_at: daysAgo(7), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-ban-021"), text: "Talud sungai di Bantaran amblas, bahaya longsor saat hujan.", status: "triaged", region_id: regionId("Bantaran"), lat: -7.7961, lng: 113.1206, reported_at: daysAgo(4), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-022"), text: "Air PDAM sering keruh pagi hari di Karanganyar.", status: "ai_verified", region_id: regionId("Karanganyar"), lat: -7.8020, lng: 113.1295, reported_at: daysAgo(14), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-ban-023"), text: "Lampu jalan di Legundi mati semua, bahaya malam hari.", status: "closed", region_id: regionId("Legundi"), lat: -7.8065, lng: 113.1338, reported_at: daysAgo(22), closed_at: daysAgo(8), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-024"), text: "Siswa SDN Karanganyar kekurangan bangku dan meja belajar.", status: "in_progress", region_id: regionId("Karanganyar"), lat: -7.8024, lng: 113.1288, reported_at: daysAgo(9), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-ban-025"), text: "Saluran drainase di Pandean tersumbat sampah, menyebabkan banjir kecil.", status: "closed", region_id: regionId("Pandean"), lat: -7.7876, lng: 113.1181, reported_at: daysAgo(18), closed_at: daysAgo(6), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-026"), text: "Jalan Desa Bantaran menuju Balai Desa rusak, berlubang dan licin.", status: "pending", region_id: regionId("Bantaran"), lat: -7.7947, lng: 113.1216, reported_at: hoursAgo(2), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-ban-027"), text: "PKL di Bantaran berjualan sampai tengah malam, mengganggu warga.", status: "triaged", region_id: regionId("Bantaran"), lat: -7.7942, lng: 113.1231, reported_at: daysAgo(2), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-ban-028"), text: "Gorong-gorong di Legundi tersumbat, air tidak mengalir.", status: "needs_review", region_id: regionId("Legundi"), lat: -7.8069, lng: 113.1333, reported_at: daysAgo(6), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-029"), text: "Sampah berserakan di Jalan Raya Bantaran setiap pagi.", status: "closed", region_id: regionId("Bantaran"), lat: -7.7955, lng: 113.1225, reported_at: daysAgo(25), closed_at: daysAgo(12), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-ban-030"), text: "Jalan menuju Karanganyar terendam banjir kiriman, tidak bisa dilalui.", status: "triage_failed", region_id: regionId("Karanganyar"), lat: -7.8023, lng: 113.1293, reported_at: daysAgo(8), label_manual: "banjir_drainase", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-ban-031"), text: "Air bersih di Pandean keruh dan berwarna kecoklatan sejak seminggu lalu.", status: "in_progress", region_id: regionId("Pandean"), lat: -7.7875, lng: 113.1183, reported_at: daysAgo(7), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-ban-032"), text: "Pagar SDN Bantaran roboh, bahaya bagi keselamatan anak sekolah.", status: "ai_verified", region_id: regionId("Bantaran"), lat: -7.7950, lng: 113.1220, reported_at: daysAgo(10), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-ban-033"), text: "Jalan Raya Bantaran berlubang di tikungan, sangat berbahaya.", status: "closed", region_id: regionId("Bantaran"), lat: -7.7962, lng: 113.1219, reported_at: daysAgo(28), closed_at: daysAgo(14), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-034"), text: "Tempat pembuangan sampah sementara di Legundi penuh dan meluber.", status: "triaged", region_id: regionId("Legundi"), lat: -7.8066, lng: 113.1340, reported_at: daysAgo(3), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-ban-035"), text: "Jalan desa dekat lapangan Bantaran berlubang, sering menghambat kendaraan.", status: "pending", region_id: regionId("Bantaran"), lat: -7.7944, lng: 113.1214, reported_at: hoursAgo(7), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-ban-036"), text: "Saluran air di Karanganyar tersumbat dan menimbulkan banjir kecil.", status: "closed", region_id: regionId("Karanganyar"), lat: -7.8026, lng: 113.1287, reported_at: daysAgo(20), closed_at: daysAgo(7), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-037"), text: "Fasilitas toilet SDN Pandean rusak, siswa terpaksa ke kebun.", status: "in_progress", region_id: regionId("Pandean"), lat: -7.7880, lng: 113.1179, reported_at: daysAgo(11), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-ban-038"), text: "Ada PKL liar di persimpangan Bantaran-Pandean yang mengganggu lalu lintas.", status: "triaged", region_id: regionId("Bantaran"), lat: -7.7942, lng: 113.1227, reported_at: daysAgo(5), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-ban-039"), text: "Jalan di Desa Legundi penuh lubang setelah musim hujan.", status: "closed", region_id: regionId("Legundi"), lat: -7.8064, lng: 113.1337, reported_at: daysAgo(35), closed_at: daysAgo(20), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-ban-040"), text: "Air PDAM di Bantaran sering mati tiap malam, tidak ada pemberitahuan.", status: "needs_review", region_id: regionId("Bantaran"), lat: -7.7947, lng: 113.1223, reported_at: daysAgo(4), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });

  // ==========================================================================
  // SUMBERASIH — ~35 aduan
  // Skenario lonjakan diare: 6 aduan kesehatan_diare dalam 24 jam terakhir
  // ==========================================================================

  // 6 aduan diare dalam 24 jam (spike)
  const spikeHours = [1, 3, 6, 8, 14, 20];
  for (let i = 0; i < 6; i++) {
    add({
      id: sid(`c-sby-0${String(i + 1).padStart(2, "0")}`),
      text: [
        "Anak saya diare sejak tadi malam, sudah ke puskesmas tapi belum membaik. Air dari keran terasa aneh.",
        "Beberapa warga RT 02 Sumberasih kena diare bersamaan, diduga dari air sumur yang tercemar.",
        "Adik saya dan tetangga kena diare parah. Kami minta Dinkes segera periksa sumber air di sini.",
        "Air dari PDAM keruh sejak kemarin, setelah diminum saya dan keluarga langsung diare.",
        "Warga di dekat Sungai Sumberasih banyak yang sakit perut dan diare, tolong diperiksa sumbernya.",
        "Sudah 5 KK di RT 03 Sumberasih kena diare, diduga air tercemar. Minta bantuan Dinkes segera.",
      ][i],
      status: "triaged",
      region_id: regionId("Sumberasih"),
      lat: -7.7623 + (i * 0.0002), // ditimpa seedComplaintCoordinate()
      lng: 113.1812 + (i * 0.0003),
      reported_at: hoursAgo(spikeHours[i]),
      label_manual: "kesehatan_diare",
      is_seed: true,
      effective_category: "kesehatan_diare",
      effective_opd_id: OPD_ID_BY_SHORT["Dinkes"],
      reporter_id: wargaId,
    });
  }

  // Sumberasih: aduan lain
  add({ id: sid("c-sby-007"), text: "Jalan utama Sumberasih berlubang di 3 titik, kendaraan berat semakin memperparah.", status: "triaged", region_id: regionId("Sumberasih"), lat: -7.7626, lng: 113.1818, reported_at: daysAgo(5), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-008"), text: "Sungai Sumberasih meluap saat hujan, menggenangi rumah warga.", status: "in_progress", region_id: regionId("Sumberasih"), lat: -7.7630, lng: 113.1808, reported_at: daysAgo(9), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-009"), text: "Sampah menumpuk di pinggir jalan Banjarsari karena truk sampah tidak masuk.", status: "closed", region_id: regionId("Banjarsari"), lat: -7.7700, lng: 113.1891, reported_at: daysAgo(18), closed_at: daysAgo(5), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-sby-010"), text: "Air PDAM Sumberasih tidak mengalir selama 2 hari.", status: "pending", region_id: regionId("Sumberasih"), lat: -7.7625, lng: 113.1815, reported_at: hoursAgo(4), label_manual: "air_bersih_pdam", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-sby-011"), text: "PKL menjamur di depan SDN Sumberasih, menghalangi pintu gerbang.", status: "triaged", region_id: regionId("Sumberasih"), lat: -7.7628, lng: 113.1820, reported_at: daysAgo(6), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-sby-012"), text: "Gedung SDN Sumberasih 2 butuh renovasi, dinding retak-retak.", status: "in_progress", region_id: regionId("Sumberasih"), lat: -7.7621, lng: 113.1811, reported_at: daysAgo(12), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-sby-013"), text: "Warga Lemahkembar kesulitan air bersih, sumur mengering.", status: "ai_verified", region_id: regionId("Lemahkembar"), lat: -7.7569, lng: 113.1758, reported_at: daysAgo(10), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-sby-014"), text: "Jembatan di Banjarsari retak, perlu pemeriksaan.", status: "triaged", region_id: regionId("Banjarsari"), lat: -7.7699, lng: 113.1890, reported_at: daysAgo(4), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-015"), text: "Drainase Clarak tidak mampu menampung air hujan, selalu banjir.", status: "closed", region_id: regionId("Clarak"), lat: -7.7735, lng: 113.1924, reported_at: daysAgo(22), closed_at: daysAgo(9), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-016"), text: "Sampah dibakar sembarangan di dekat pemukiman Lemahkembar, asap mengganggu.", status: "triage_failed", region_id: regionId("Lemahkembar"), lat: -7.7568, lng: 113.1757, reported_at: daysAgo(7), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-sby-017"), text: "Jalan Desa Sumberasih menuju Lemahkembar berlubang.", status: "in_progress", region_id: regionId("Lemahkembar"), lat: -7.7570, lng: 113.1754, reported_at: daysAgo(8), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-018"), text: "Banjir di Clarak menghanyutkan beberapa perabot warga.", status: "closed", region_id: regionId("Clarak"), lat: -7.7736, lng: 113.1922, reported_at: daysAgo(30), closed_at: daysAgo(15), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-019"), text: "Air keruh di Banjarsari sejak hujan deras tadi malam.", status: "pending", region_id: regionId("Banjarsari"), lat: -7.7698, lng: 113.1892, reported_at: hoursAgo(6), label_manual: "air_bersih_pdam", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-sby-020"), text: "PKL di pintu masuk Sumberasih mengotori trotoar dan tidak mau ditertibkan.", status: "needs_review", region_id: regionId("Sumberasih"), lat: -7.7627, lng: 113.1817, reported_at: daysAgo(5), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-sby-021"), text: "Kesehatan warga Clarak terganggu, banyak yang sakit perut sejak sumber air berubah.", status: "triaged", region_id: regionId("Clarak"), lat: -7.7732, lng: 113.1926, reported_at: daysAgo(3), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-sby-022"), text: "Sekolah MI Sumberasih kekurangan guru, kelas digabung.", status: "in_progress", region_id: regionId("Sumberasih"), lat: -7.7622, lng: 113.1813, reported_at: daysAgo(10), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-sby-023"), text: "Jalan Sumberasih-Banjarsari aspalnya terkelupas, berbahaya saat hujan.", status: "closed", region_id: regionId("Banjarsari"), lat: -7.7697, lng: 113.1893, reported_at: daysAgo(25), closed_at: daysAgo(11), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-024"), text: "Sampah plastik menumpuk di muara sungai Clarak, merusak lingkungan.", status: "triaged", region_id: regionId("Clarak"), lat: -7.7733, lng: 113.1925, reported_at: daysAgo(4), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-sby-025"), text: "Tanggul sungai di Lemahkembar menipis, warga khawatir jebol saat banjir.", status: "ai_verified", region_id: regionId("Lemahkembar"), lat: -7.7568, lng: 113.1755, reported_at: daysAgo(9), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-026"), text: "Pelayanan puskesmas Sumberasih lambat, pasien antri terlalu lama.", status: "closed", region_id: regionId("Sumberasih"), lat: -7.7624, lng: 113.1814, reported_at: daysAgo(20), closed_at: daysAgo(8), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-sby-027"), text: "Jalur evakuasi banjir di Clarak tidak ada petunjuk arah.", status: "triage_failed", region_id: regionId("Clarak"), lat: -7.7734, lng: 113.1927, reported_at: daysAgo(6), label_manual: "banjir_drainase", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-sby-028"), text: "Air sumur Lemahkembar tercemar pupuk dari sawah, tidak layak minum.", status: "triaged", region_id: regionId("Lemahkembar"), lat: -7.7567, lng: 113.1759, reported_at: daysAgo(3), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-sby-029"), text: "Banjarsari banjir lagi, got mampet tidak pernah dibersihkan.", status: "in_progress", region_id: regionId("Banjarsari"), lat: -7.7700, lng: 113.1888, reported_at: daysAgo(7), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-030"), text: "PKL berdagang di depan kantor desa Sumberasih, mengganggu aktivitas warga.", status: "closed", region_id: regionId("Sumberasih"), lat: -7.7626, lng: 113.1816, reported_at: daysAgo(24), closed_at: daysAgo(10), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-sby-031"), text: "Jalan akses masuk Desa Clarak kondisinya parah sekali.", status: "pending", region_id: regionId("Clarak"), lat: -7.7735, lng: 113.1920, reported_at: hoursAgo(8), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-sby-032"), text: "Pipa PDAM di Banjarsari bocor, air menggenangi jalan.", status: "closed", region_id: regionId("Banjarsari"), lat: -7.7699, lng: 113.1889, reported_at: daysAgo(16), closed_at: daysAgo(4), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-sby-033"), text: "Posyandu Clarak kekurangan peralatan, timbangan rusak.", status: "triaged", region_id: regionId("Clarak"), lat: -7.7733, lng: 113.1924, reported_at: daysAgo(5), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-sby-034"), text: "Jalan Lemahkembar menuju sawah banyak lubang, petani susah angkut hasil panen.", status: "in_progress", region_id: regionId("Lemahkembar"), lat: -7.7566, lng: 113.1760, reported_at: daysAgo(9), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-sby-035"), text: "Tanah longsor kecil di tepi jalan Clarak setelah hujan lebat.", status: "needs_review", region_id: regionId("Clarak"), lat: -7.7736, lng: 113.1921, reported_at: daysAgo(4), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });

  // ==========================================================================
  // DRINGU — ~25 aduan (variasi: banjir, sampah, PKL)
  // ==========================================================================
  add({ id: sid("c-dri-001"), text: "Drainase Dringu tidak berfungsi, air menggenang di depan kantor desa.", status: "triaged", region_id: regionId("Dringu"), lat: -7.7425, lng: 113.2200, reported_at: daysAgo(5), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-002"), text: "Sampah berserakan di pasar Dringu setiap hari, tidak segera diangkut.", status: "in_progress", region_id: regionId("Dringu"), lat: -7.7428, lng: 113.2195, reported_at: daysAgo(8), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-dri-003"), text: "PKL memenuhi trotoar Pabean, pejalan kaki terpaksa berjalan di jalan raya.", status: "triaged", region_id: regionId("Pabean"), lat: -7.7490, lng: 113.2268, reported_at: daysAgo(4), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-dri-004"), text: "Jalan Dringu-Pabean berlubang besar di beberapa titik.", status: "closed", region_id: regionId("Dringu"), lat: -7.7426, lng: 113.2202, reported_at: daysAgo(25), closed_at: daysAgo(12), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-005"), text: "Air PDAM Dringu keruh setelah hujan, warga takut minum.", status: "pending", region_id: regionId("Dringu"), lat: -7.7424, lng: 113.2197, reported_at: hoursAgo(5), label_manual: "air_bersih_pdam", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-dri-006"), text: "Sungai di Sumberkedawung meluap, jalan desa terendam.", status: "in_progress", region_id: regionId("Sumberkedawung"), lat: -7.7514, lng: 113.2147, reported_at: daysAgo(7), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-007"), text: "Pembakaran sampah di Pabean membuat udara sesak.", status: "triaged", region_id: regionId("Pabean"), lat: -7.7491, lng: 113.2266, reported_at: daysAgo(3), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-dri-008"), text: "PKL Dringu berjualan di badan jalan, menyebabkan kemacetan.", status: "closed", region_id: regionId("Dringu"), lat: -7.7427, lng: 113.2198, reported_at: daysAgo(18), closed_at: daysAgo(6), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-dri-009"), text: "Warga Sumberkedawung butuh fasilitas MCK umum, tidak ada toilet.", status: "triage_failed", region_id: regionId("Sumberkedawung"), lat: -7.7513, lng: 113.2146, reported_at: daysAgo(9), label_manual: "kesehatan_diare", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-dri-010"), text: "Gedung PAUD Dringu belum memiliki tempat bermain yang layak.", status: "triaged", region_id: regionId("Dringu"), lat: -7.7422, lng: 113.2200, reported_at: daysAgo(6), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-dri-011"), text: "Genangan di depan SD Pabean tidak kunjung surut.", status: "closed", region_id: regionId("Pabean"), lat: -7.7488, lng: 113.2270, reported_at: daysAgo(20), closed_at: daysAgo(8), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-012"), text: "Truk sampah melintas malam hari dan berisik, mengganggu warga.", status: "pending", region_id: regionId("Dringu"), lat: -7.7426, lng: 113.2196, reported_at: hoursAgo(9), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-dri-013"), text: "Jalan Sumberkedawung retak parah akibat beban truk tambang.", status: "in_progress", region_id: regionId("Sumberkedawung"), lat: -7.7512, lng: 113.2148, reported_at: daysAgo(10), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-014"), text: "Air sumur warga Pabean berbau, diduga tercemar limbah.", status: "triaged", region_id: regionId("Pabean"), lat: -7.7490, lng: 113.2265, reported_at: daysAgo(5), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-dri-015"), text: "PKL di dekat Pasar Dringu tidak mau pindah, sudah diingatkan berkali-kali.", status: "ai_verified", region_id: regionId("Dringu"), lat: -7.7428, lng: 113.2194, reported_at: daysAgo(11), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-dri-016"), text: "Saluran irigasi Dringu rusak, petani tidak bisa mengairi sawah.", status: "closed", region_id: regionId("Dringu"), lat: -7.7425, lng: 113.2203, reported_at: daysAgo(28), closed_at: daysAgo(14), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-017"), text: "Warga Sumberkedawung tidak mendapat distribusi air bersih dalam seminggu.", status: "triaged", region_id: regionId("Sumberkedawung"), lat: -7.7511, lng: 113.2150, reported_at: daysAgo(4), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-dri-018"), text: "Jalan Pabean berlubang, terutama di area pasar ikan.", status: "closed", region_id: regionId("Pabean"), lat: -7.7489, lng: 113.2268, reported_at: daysAgo(22), closed_at: daysAgo(9), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-019"), text: "Banjir dari sungai merendam kebun warga Dringu.", status: "in_progress", region_id: regionId("Dringu"), lat: -7.7424, lng: 113.2201, reported_at: daysAgo(8), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-dri-020"), text: "Perpustakaan SDN Sumberkedawung tidak berfungsi, buku rusak semua.", status: "triaged", region_id: regionId("Sumberkedawung"), lat: -7.7513, lng: 113.2145, reported_at: daysAgo(6), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-dri-021"), text: "Lampu penerangan jalan Dringu banyak yang mati sejak setahun lalu.", status: "pending", region_id: regionId("Dringu"), lat: -7.7427, lng: 113.2197, reported_at: hoursAgo(6), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-dri-022"), text: "Sampah di TPS Pabean meluber ke jalan sejak dua hari lalu.", status: "closed", region_id: regionId("Pabean"), lat: -7.7491, lng: 113.2269, reported_at: daysAgo(15), closed_at: daysAgo(5), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-dri-023"), text: "PKL berjualan di bahu jalan Sumberkedawung pagi-malam tanpa izin.", status: "needs_review", region_id: regionId("Sumberkedawung"), lat: -7.7514, lng: 113.2144, reported_at: daysAgo(5), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-dri-024"), text: "Pipa air bersih di Dringu bocor, air terbuang percuma.", status: "triaged", region_id: regionId("Dringu"), lat: -7.7426, lng: 113.2199, reported_at: daysAgo(3), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-dri-025"), text: "Jalan masuk ke Desa Pabean dari jalan raya kondisinya sangat buruk.", status: "closed", region_id: regionId("Pabean"), lat: -7.7488, lng: 113.2271, reported_at: daysAgo(32), closed_at: daysAgo(18), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });

  // ==========================================================================
  // WONOMERTO — ~25 aduan (air bersih, pendidikan, kesehatan)
  // ==========================================================================
  add({ id: sid("c-wno-001"), text: "Sumber air bersih di Wonomerto mengering di musim kemarau.", status: "triaged", region_id: regionId("Wonomerto"), lat: -7.8100, lng: 113.1614, reported_at: daysAgo(5), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-wno-002"), text: "Guru SDN Wonomerto 1 sudah pensiun, kelas kosong tidak ada penggantinya.", status: "in_progress", region_id: regionId("Wonomerto"), lat: -7.8097, lng: 113.1615, reported_at: daysAgo(9), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-wno-003"), text: "Warga Desa Sumber mengeluh air sumur berbau dan keruh sejak seminggu.", status: "triaged", region_id: regionId("Sumber"), lat: -7.8158, lng: 113.1680, reported_at: daysAgo(4), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-wno-004"), text: "Jalan Wonomerto-Sumber rusak parah, truk sulit lewat.", status: "closed", region_id: regionId("Wonomerto"), lat: -7.8099, lng: 113.1613, reported_at: daysAgo(26), closed_at: daysAgo(13), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-wno-005"), text: "Sampah di Patalan tidak diangkut, tumpukan semakin besar.", status: "pending", region_id: regionId("Patalan"), lat: -7.8036, lng: 113.1590, reported_at: hoursAgo(4), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-wno-006"), text: "Banjir di Sumber merendam halaman rumah warga.", status: "triaged", region_id: regionId("Sumber"), lat: -7.8157, lng: 113.1679, reported_at: daysAgo(6), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-wno-007"), text: "Instalasi air bersih Wonomerto tidak berfungsi, warga beli air gallon.", status: "in_progress", region_id: regionId("Wonomerto"), lat: -7.8098, lng: 113.1616, reported_at: daysAgo(8), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-wno-008"), text: "Lapangan SDN Patalan tergenang air, siswa tidak bisa olahraga.", status: "closed", region_id: regionId("Patalan"), lat: -7.8035, lng: 113.1591, reported_at: daysAgo(20), closed_at: daysAgo(7), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-wno-009"), text: "Jalan Patalan menuju pasar berlubang, sering menghambat kendaraan niaga.", status: "triaged", region_id: regionId("Patalan"), lat: -7.8037, lng: 113.1588, reported_at: daysAgo(4), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-wno-010"), text: "PKL di Wonomerto menempati fasilitas umum tanpa izin.", status: "ai_verified", region_id: regionId("Wonomerto"), lat: -7.8101, lng: 113.1611, reported_at: daysAgo(10), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-wno-011"), text: "Air minum anak-anak di SDN Sumber tidak tersedia, tidak ada kantin sehat.", status: "triaged", region_id: regionId("Sumber"), lat: -7.8156, lng: 113.1681, reported_at: daysAgo(5), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-wno-012"), text: "Saluran irigasi Sumber tersumbat, petani kekurangan air sawah.", status: "in_progress", region_id: regionId("Sumber"), lat: -7.8155, lng: 113.1682, reported_at: daysAgo(9), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-wno-013"), text: "Warga Wonomerto mengeluh sakit perut setelah minum air dari sumur baru.", status: "triage_failed", region_id: regionId("Wonomerto"), lat: -7.8100, lng: 113.1613, reported_at: daysAgo(8), label_manual: "kesehatan_diare", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-wno-014"), text: "Sampah di TPS Sumber tidak terangkut tiga hari berturut-turut.", status: "closed", region_id: regionId("Sumber"), lat: -7.8157, lng: 113.1678, reported_at: daysAgo(16), closed_at: daysAgo(6), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-wno-015"), text: "Jalan di Wonomerto dekat lapangan retak dan berlubang.", status: "pending", region_id: regionId("Wonomerto"), lat: -7.8097, lng: 113.1617, reported_at: hoursAgo(7), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-wno-016"), text: "Posyandu Patalan tidak punya timbangan bayi yang layak.", status: "triaged", region_id: regionId("Patalan"), lat: -7.8034, lng: 113.1592, reported_at: daysAgo(5), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-wno-017"), text: "PKL di Patalan mendirikan lapak permanen di fasilitas umum.", status: "needs_review", region_id: regionId("Patalan"), lat: -7.8036, lng: 113.1587, reported_at: daysAgo(6), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-wno-018"), text: "Sungai di Patalan mendangkal, sering meluap saat hujan deras.", status: "in_progress", region_id: regionId("Patalan"), lat: -7.8035, lng: 113.1589, reported_at: daysAgo(10), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-wno-019"), text: "Komputer SDN Wonomerto rusak semua, tidak ada gantinya.", status: "closed", region_id: regionId("Wonomerto"), lat: -7.8099, lng: 113.1614, reported_at: daysAgo(24), closed_at: daysAgo(11), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-wno-020"), text: "Air bersih Sumber sering bau kaporit berlebihan.", status: "triaged", region_id: regionId("Sumber"), lat: -7.8156, lng: 113.1683, reported_at: daysAgo(3), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-wno-021"), text: "Jalan Sumber-Wonomerto licin saat hujan, tidak ada marka jalan.", status: "closed", region_id: regionId("Sumber"), lat: -7.8155, lng: 113.1684, reported_at: daysAgo(28), closed_at: daysAgo(16), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-wno-022"), text: "Warga Patalan tidak memiliki akses MCK layak.", status: "triage_failed", region_id: regionId("Patalan"), lat: -7.8036, lng: 113.1591, reported_at: daysAgo(7), label_manual: "kesehatan_diare", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-wno-023"), text: "Drainase Wonomerto tidak memadai, rumah warga terendam tiap hujan.", status: "triaged", region_id: regionId("Wonomerto"), lat: -7.8100, lng: 113.1612, reported_at: daysAgo(4), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-wno-024"), text: "Kebakaran sampah di TPS Patalan kemarin mengepulkan asap hitam.", status: "closed", region_id: regionId("Patalan"), lat: -7.8034, lng: 113.1593, reported_at: daysAgo(14), closed_at: daysAgo(5), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-wno-025"), text: "Pompa air PDAM Wonomerto bocor, tekanan air rumah warga turun drastis.", status: "ai_verified", region_id: regionId("Wonomerto"), lat: -7.8098, lng: 113.1618, reported_at: daysAgo(9), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });

  // ==========================================================================
  // LECES — ~25 aduan (mix, termasuk beberapa closed untuk dashboard)
  // ==========================================================================
  add({ id: sid("c-lcs-001"), text: "Jalan Leces menuju pasar lebar tapi berlubang-lubang, perlu perbaikan.", status: "closed", region_id: regionId("Leces"), lat: -7.7813, lng: 113.1980, reported_at: daysAgo(30), closed_at: daysAgo(15), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-002"), text: "Drainase Warujinggo tidak berfungsi, got penuh tanah.", status: "triaged", region_id: regionId("Warujinggo"), lat: -7.7868, lng: 113.2057, reported_at: daysAgo(5), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-003"), text: "Sampah di Tigasan menumpuk karena jadwal angkut tidak teratur.", status: "closed", region_id: regionId("Tigasan"), lat: -7.7746, lng: 113.1935, reported_at: daysAgo(22), closed_at: daysAgo(10), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-lcs-004"), text: "Air minum warga Leces berbau tidak sedap sejak minggu lalu.", status: "in_progress", region_id: regionId("Leces"), lat: -7.7812, lng: 113.1979, reported_at: daysAgo(8), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-lcs-005"), text: "PKL di Tigasan berjualan di area taman, merusak fasilitas publik.", status: "closed", region_id: regionId("Tigasan"), lat: -7.7745, lng: 113.1936, reported_at: daysAgo(18), closed_at: daysAgo(7), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-lcs-006"), text: "Gedung SDN Leces 3 bocor, lantai basah saat hujan.", status: "triaged", region_id: regionId("Leces"), lat: -7.7814, lng: 113.1977, reported_at: daysAgo(4), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-lcs-007"), text: "Warga Warujinggo diare massal, diduga dari air sungai yang tercemar.", status: "in_progress", region_id: regionId("Warujinggo"), lat: -7.7869, lng: 113.2055, reported_at: daysAgo(7), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-lcs-008"), text: "Jalan Warujinggo berlubang, sudah lama tidak diperbaiki.", status: "closed", region_id: regionId("Warujinggo"), lat: -7.7867, lng: 113.2058, reported_at: daysAgo(28), closed_at: daysAgo(14), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-009"), text: "Banjir di Tigasan merendam jalan utama desa setiap hujan lebat.", status: "triaged", region_id: regionId("Tigasan"), lat: -7.7746, lng: 113.1933, reported_at: daysAgo(3), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-010"), text: "Air PDAM Warujinggo tidak mengalir sudah tiga hari.", status: "pending", region_id: regionId("Warujinggo"), lat: -7.7868, lng: 113.2056, reported_at: hoursAgo(5), label_manual: "air_bersih_pdam", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-lcs-011"), text: "Ruang kelas SDN Tigasan kekurangan pencahayaan, siswa susah membaca.", status: "closed", region_id: regionId("Tigasan"), lat: -7.7747, lng: 113.1934, reported_at: daysAgo(20), closed_at: daysAgo(9), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-lcs-012"), text: "Sampah kiriman dari kota menumpuk di Leces setiap hari.", status: "in_progress", region_id: regionId("Leces"), lat: -7.7815, lng: 113.1976, reported_at: daysAgo(9), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-lcs-013"), text: "PKL di Warujinggo berjualan sampai tengah malam, bising dan kotor.", status: "triaged", region_id: regionId("Warujinggo"), lat: -7.7869, lng: 113.2054, reported_at: daysAgo(5), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-lcs-014"), text: "Warga Leces mengeluhkan pipa PDAM sering bocor, tagihan naik.", status: "closed", region_id: regionId("Leces"), lat: -7.7813, lng: 113.1981, reported_at: daysAgo(25), closed_at: daysAgo(12), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-lcs-015"), text: "Jembatan di Tigasan kondisi memprihatinkan, plat besi berkarat.", status: "triaged", region_id: regionId("Tigasan"), lat: -7.7744, lng: 113.1937, reported_at: daysAgo(4), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-016"), text: "Tidak ada posyandu di Warujinggo, ibu hamil harus jauh ke puskesmas.", status: "in_progress", region_id: regionId("Warujinggo"), lat: -7.7866, lng: 113.2059, reported_at: daysAgo(10), label_manual: "kesehatan_diare", is_seed: true, effective_category: "kesehatan_diare", effective_opd_id: OPD_ID_BY_SHORT["Dinkes"], reporter_id: wargaId });
  add({ id: sid("c-lcs-017"), text: "Jalan Tigasan retak panjang akibat amblesan tanah.", status: "closed", region_id: regionId("Tigasan"), lat: -7.7748, lng: 113.1932, reported_at: daysAgo(35), closed_at: daysAgo(20), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-018"), text: "Drainase di Leces tidak mampu menampung hujan deras, jalan tergenang.", status: "triage_failed", region_id: regionId("Leces"), lat: -7.7812, lng: 113.1982, reported_at: daysAgo(7), label_manual: "banjir_drainase", is_seed: true, effective_category: null, effective_opd_id: null, reporter_id: wargaId });
  add({ id: sid("c-lcs-019"), text: "Air bersih di Tigasan jarang mengalir, sering mati 2-3 hari.", status: "triaged", region_id: regionId("Tigasan"), lat: -7.7745, lng: 113.1935, reported_at: daysAgo(5), label_manual: "air_bersih_pdam", is_seed: true, effective_category: "air_bersih_pdam", effective_opd_id: OPD_ID_BY_SHORT["PDAM"], reporter_id: wargaId });
  add({ id: sid("c-lcs-020"), text: "Ruang guru SDN Warujinggo tidak layak, atap bocor dan dinding lembab.", status: "closed", region_id: regionId("Warujinggo"), lat: -7.7867, lng: 113.2060, reported_at: daysAgo(22), closed_at: daysAgo(8), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });
  add({ id: sid("c-lcs-021"), text: "Limbah pabrik di dekat Leces mencemari sungai, ikan mati.", status: "needs_review", region_id: regionId("Leces"), lat: -7.7814, lng: 113.1978, reported_at: daysAgo(6), label_manual: "pengelolaan_sampah", is_seed: true, effective_category: "pengelolaan_sampah", effective_opd_id: OPD_ID_BY_SHORT["DLH"], reporter_id: wargaId });
  add({ id: sid("c-lcs-022"), text: "Jalan Leces-Warujinggo sempit dan rusak, sering macet.", status: "closed", region_id: regionId("Leces"), lat: -7.7813, lng: 113.1983, reported_at: daysAgo(29), closed_at: daysAgo(17), label_manual: "infrastruktur_jalan", is_seed: true, effective_category: "infrastruktur_jalan", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-023"), text: "PKL liar di Leces mendirikan lapak di fasilitas umum, merusak taman.", status: "triaged", region_id: regionId("Leces"), lat: -7.7815, lng: 113.1975, reported_at: daysAgo(4), label_manual: "pkl_tata_ruang", is_seed: true, effective_category: "pkl_tata_ruang", effective_opd_id: OPD_ID_BY_SHORT["Satpol"], reporter_id: wargaId });
  add({ id: sid("c-lcs-024"), text: "Banjir Warujinggo menenggelamkan sawah warga, butuh normalisasi sungai.", status: "in_progress", region_id: regionId("Warujinggo"), lat: -7.7866, lng: 113.2061, reported_at: daysAgo(9), label_manual: "banjir_drainase", is_seed: true, effective_category: "banjir_drainase", effective_opd_id: OPD_ID_BY_SHORT["DPU"], reporter_id: wargaId });
  add({ id: sid("c-lcs-025"), text: "Siswa SDN Leces 2 belum mendapat buku teks kurikulum baru.", status: "closed", region_id: regionId("Leces"), lat: -7.7812, lng: 113.1984, reported_at: daysAgo(18), closed_at: daysAgo(6), label_manual: "pendidikan", is_seed: true, effective_category: "pendidikan", effective_opd_id: OPD_ID_BY_SHORT["Disdik"], reporter_id: wargaId });

  return rows.map((row) => {
    const coord = seedComplaintCoordinate(row.id, row.region_id);
    return coord ? { ...row, lat: coord.lat, lng: coord.lng } : row;
  });
}

export async function seedComplaints(): Promise<number> {
  const supabase = createClient();
  const rows = buildComplaints();

  const { error } = await supabase
    .from("complaints")
    .upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Seed complaints gagal: ${error.message}`);

  console.log(`✅ complaints: ${rows.length} baris`);
  return rows.length;
}
