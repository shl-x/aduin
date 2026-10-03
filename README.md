# Aduin

> **Aduin aja, sisanya kami yang urus.**

Aduin adalah "otak analitik" di balik kanal pengaduan masyarakat pemerintah daerah (studi kasus:
Kabupaten Probolinggo). Warga cukup mengadu lewat chat; Aduin men-triase aduan dengan AI, memetakan
hotspot, mendeteksi lonjakan aduan, menyusun koordinasi lintas OPD, dan baru menutup aduan setelah
bukti penyelesaian diverifikasi AI dan dikonfirmasi warga. Dibuat untuk hackathon IBM.

| Fitur | Halaman | Role |
|---|---|---|
| Simulator WhatsApp + klarifikasi otomatis, daftar "Aduan Saya" | `/lapor` | warga |
| Daftar aduan, triage AI yang bisa dijelaskan + override, Reset Demo | `/dashboard`, `/aduan/[id]` | operator |
| Peta hotspot + clustering aduan serupa | `/peta` | operator |
| Peringatan dini lonjakan (z-score) + ringkasan AI | `/alert` | operator |
| Rencana koordinasi lintas OPD (AI) | `/aduan/[id]` | operator |
| Tugas per OPD + unggah bukti penyelesaian | `/tugas` | petugas OPD |
| KPI, tren, sebaran kecamatan, peringkat OPD | `/ringkasan` | pimpinan |

Dokumen rinci: [`docs/PRD.md`](docs/PRD.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/LANGFLOW_FLOWS.md`](docs/LANGFLOW_FLOWS.md), [`docs/TASKS.md`](docs/TASKS.md),
naskah demo [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

---

## Arsitektur singkat

```
Browser ──► Next.js (App Router, Route Handlers) ──► Supabase (Postgres + pgvector, Storage, Auth)
                     │
                     └──► Langflow (6 flow) ──► IBM watsonx.ai (region Tokyo)
```

- **Next.js + TypeScript + Tailwind + shadcn/ui.** Semua akses AI lewat `src/lib/langflow/client.ts`
  (cache `ai_cache` → panggil Langflow → parsing tahan banting → validasi Zod). Aplikasi **tidak**
  memanggil watsonx.ai langsung.
- **Supabase**: data + RLS, `pgvector` untuk embedding, bucket Storage `aduan-photos` (publik baca).
  Statistik early warning dan penggeseran timeline demo dihitung oleh fungsi Postgres (migrasi 0004).
- **Langflow**: enam flow — `aduin-clarify`, `aduin-triage`, `aduin-embed`, `aduin-opd-agent`,
  `aduin-verify`, `aduin-alert-summary`.
- Peta: Leaflet + OpenStreetMap. Grafik: Recharts.

## Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Node.js 20+ dan npm | Next.js 16 |
| Proyek Supabase | Postgres dengan ekstensi `vector` |
| Langflow 1.12 | lokal (`langflow run`) atau Docker, port 7860 |
| Akun IBM watsonx.ai | API key + Project ID, akses region Tokyo (`jp-tok`) |

---

## 1. Setup Supabase

1. Buat proyek Supabase, lalu salin URL, anon key, dan service role key (Project Settings → API).
2. Terapkan migrasi **berurutan** di SQL editor (atau `supabase db push`):

   | File | Isi |
   |---|---|
   | `supabase/migrations/0001_init.sql` | Semua tabel, pgvector, RLS, trigger profil |
   | `supabase/migrations/0002_storage.sql` | Bucket `aduan-photos` (publik baca, login tulis) |
   | `supabase/migrations/0003_coordination_rpc.sql` | `replace_coordination_plan` (ganti rencana OPD secara atomik) |
   | `supabase/migrations/0004_early_warning.sql` | `alert_window_stats` (z-score) dan `shift_seed_timeline` |

## 2. Setup Langflow

Panduan lengkap: [`langflow/README.md`](langflow/README.md).

1. Jalankan Langflow (`langflow run`) dan buka `http://localhost:7860`.
2. **Global Variables** (Settings → Global Variables): `WATSONX_API_KEY` (Credential) dan
   `WATSONX_PROJECT_ID` (Generic).
3. **Import enam flow** dari `langflow/flows/` (New Flow → Import): `aduin-clarify.json`,
   `aduin-triage.json`, `aduin-embed.json`, `aduin-opd-agent.json`, `aduin-verify.json`,
   `aduin-alert-summary.json`. Setelah import, hubungkan ulang Global Variables di setiap komponen
   IBM watsonx.ai dan di custom component **Aduin Verify Vision**.
4. Buat API key Langflow (Settings → API Keys) dan catat **Flow ID** tiap flow (UUID di URL).

Model yang dipakai (semua region Tokyo, `https://jp-tok.ml.cloud.ibm.com`):

| Flow | Model | Temperature / max tokens |
|---|---|---|
| aduin-clarify | `mistralai/mistral-small-3-1-24b-instruct-2503` | 0.1 / 1000 |
| aduin-triage | `mistralai/mistral-small-3-1-24b-instruct-2503` | 0.0 / 400 |
| aduin-embed | `ibm/granite-embedding-278m-multilingual` (768 dimensi) | — |
| aduin-opd-agent | `mistralai/mistral-small-3-1-24b-instruct-2503` (tanpa komponen Agent) | 0.1 / 800 |
| aduin-verify | `mistralai/mistral-small-3-1-24b-instruct-2503` (vision, via custom component) | 0 / 300 |
| aduin-alert-summary | `mistralai/mistral-small-3-1-24b-instruct-2503` | 0.3 / 400 |

Prompt tiap flow ada di `langflow/prompts/`.

## 3. `.env.local`

Salin `.env.example` menjadi `.env.local`, lalu isi:

| Variabel | Isi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Dari Supabase |
| `LANGFLOW_BASE_URL` | `http://127.0.0.1:7860` |
| `LANGFLOW_API_KEY` | API key Langflow |
| `LANGFLOW_FLOW_*_ID` (6 variabel) | Flow ID tiap flow |
| `EMBEDDING_DIMENSION` | `768` |
| `CLUSTER_SIMILARITY_THRESHOLD`, `CLUSTER_RADIUS_METERS`, `CLUSTER_WINDOW_DAYS` | `0.75`, `500`, `14` |
| `ALERT_THRESHOLD_Z`, `ALERT_MIN_COUNT`, `LANGFLOW_ALERT_TIMEOUT_MS` | `2.0`, `3`, `10000` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` untuk demo (RoleSwitcher, login per role, Reset Demo) |
| `DEMO_SEED_PASSWORD` | Password semua akun demo (hanya dibaca server) |

## 4. Instal dan isi data

```bash
npm install
npx tsx --env-file=.env.local supabase/seed/index.ts
npm run dev        # http://localhost:3000
```

`index.ts` membangun keadaan demo lengkap **tanpa memanggil Langflow**: wilayah, OPD, 6 akun demo,
±150 aduan seed, hasil AI dari `supabase/seed/ai-cache-snapshot.json` (triage, embedding, isi
`ai_cache`), rencana koordinasi sederhana, clustering, timeline segar, dan deteksi early warning
(alert diare Sumberasih). ⚠️ Script ini menghapus semua aduan (termasuk aduan latihan), alert, dan
cluster sebelum membangun ulang; akun demo tidak dihapus.

### Script lain (`npx tsx --env-file=.env.local <script>`)

| Script | Kapan dipakai |
|---|---|
| `supabase/seed/refresh-demo-timeline.ts` | **Sebelum demo.** Menggeser timeline seed agar aduan diare Sumberasih terbaru ±2 jam lalu, lalu menjalankan early warning. Aman diulang. |
| `supabase/seed/triage-seed.ts` | Membuat ulang hasil triage seed lewat Langflow (mis. setelah prompt berubah). |
| `supabase/seed/embed-seed.ts` | Membuat embedding yang belum ada lewat Langflow + clustering ulang. |
| `supabase/seed/precompute-ai.ts` | Mengekspor hasil AI dari database ke `ai-cache-snapshot.json` (tanpa Langflow) dan mencetak akurasi triage seed. Commit file hasilnya. |
| `supabase/seed/fix-coordinates.ts` | Memperbarui koordinat wilayah/aduan di database lama ke tata letak terbaru tanpa menghapus hasil AI, lalu clustering ulang. |
| `supabase/seed/eval-triage.ts` | Evaluasi held-out: 30 aduan baru (`supabase/seed/eval/heldout.json`) ke aduin-triage tanpa cache, tanpa menulis DB; mencetak akurasi total, per kategori, dan daftar yang tidak cocok. |

Urutan untuk memperbarui snapshot AI: `triage-seed.ts` → `embed-seed.ts` → `precompute-ai.ts` →
commit `ai-cache-snapshot.json`.

## Akun demo

Password semua akun = `DEMO_SEED_PASSWORD`. Saat `NEXT_PUBLIC_DEMO_MODE=true`, masuk lewat tombol di
landing page `/` atau RoleSwitcher di header.

| Email | Role | Halaman utama |
|---|---|---|
| `warga@demo.aduin` | warga | `/lapor` |
| `operator@demo.aduin` | operator | `/dashboard` |
| `pu@demo.aduin` | petugas OPD (DPU) | `/tugas` |
| `dinkes@demo.aduin` | petugas OPD (Dinkes) | `/tugas` |
| `bpkad@demo.aduin` | petugas OPD (BPKAD) — tugas anggaran di rencana koordinasi | `/tugas` |
| `pimpinan@demo.aduin` | pimpinan | `/ringkasan` |

## Reset demo

- **Dari aplikasi:** masuk sebagai operator → `/dashboard` → **Reset Demo** → konfirmasi
  (±1 menit). Aduan seed dan hasil AI dipulihkan dari snapshot, aduan latihan dihapus, timeline
  digeser, dan early warning dijalankan; pesan hasil menyebut apakah alert diare Sumberasih aktif.
- **Dari terminal:** `npx tsx --env-file=.env.local supabase/seed/index.ts`.

Naskah demo dan checklist persiapan: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Triage selalu `triage_failed` | Langflow mati atau Flow ID salah. Cek `curl http://localhost:7860/health` dan `LANGFLOW_FLOW_TRIAGE_ID`. |
| `401 Unauthorized` dari Langflow | `LANGFLOW_API_KEY` salah. |
| Error "Terapkan migrasi …0003/0004…" | Migrasi belum diterapkan — jalankan file SQL yang disebut. |
| Alert diare Sumberasih tidak muncul | Timeline seed sudah lewat 24 jam. Jalankan `refresh-demo-timeline.ts` atau Reset Demo. |
| Alert ada tapi "Ringkasan AI belum tersedia" | Langflow gagal/timeout saat alert dibuat. Nyalakan Langflow lalu klik **Coba Lagi** di `/alert`. |
| Verifikasi foto selalu "Perlu Ditinjau" dengan alasan "Verifikasi AI gagal" | Flow aduin-verify gagal (Langflow mati, kredensial Aduin Verify Vision belum terhubung, atau foto tidak bisa diunduh — bucket `aduan-photos` harus publik). |
| "Gagal membuat rencana koordinasi" | Langflow gagal atau timeout (batas 60 detik); rencana lama tetap utuh — coba lagi. |
| Peta kosong | Aduan belum punya koordinat atau embedding — jalankan seed utama. |
| Embedding gagal validasi | Model di aduin-embed harus `ibm/granite-embedding-278m-multilingual` (768 dimensi). |
| Prompt Langflow error "unclosed tag" | Kurung kurawal ganda tidak berpasangan di template — lihat `langflow/README.md`. |
| Reset Demo ditolak 403 | Hanya operator dan hanya jika `NEXT_PUBLIC_DEMO_MODE=true`. |

## Perintah pengembangan

```bash
npm run dev     # server pengembangan
npm run build   # build produksi (cek TypeScript)
npm run lint    # ESLint
```
