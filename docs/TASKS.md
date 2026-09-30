# TASKS — Aduin · Checklist Milestone

## Aturan Kerja

- Kerjakan milestone **berurutan** — jangan mulai M(n+1) sebelum M(n) selesai.
- **Satu milestone per sesi Bob.** Tutup sesi setelah commit.
- **Commit setelah setiap milestone selesai.** Pesan commit: `feat: milestone M<n> — <judul>`.
- Jangan lanjut ke milestone berikutnya sebelum seluruh **Definition of Done** terpenuhi.
- Kalau requirement ambigu, tanya dulu sebelum menulis kode.

---

## M0 — Setup Proyek

### Langflow (manual di UI)

- [ ] Jalankan Langflow lokal (`langflow run` atau Docker) dan pastikan UI terbuka di `http://localhost:7860`.
- [ ] Buat **Global Variable** di Langflow: nama `WATSONX_API_KEY`, isi API key IBM watsonx.ai; nama `WATSONX_PROJECT_ID`, isi project ID.
- [ ] Verifikasi koneksi ke watsonx.ai: buat flow uji coba satu komponen **IBM watsonx.ai**, kirim prompt sederhana, pastikan respons kembali.
- [ ] Hapus flow uji coba setelah berhasil.

### Kode (Bob)

- [x] Inisialisasi proyek Next.js dengan TypeScript strict: `npx create-next-app@latest aduin --typescript --tailwind --app`.
- [x] Instal dan konfigurasi shadcn/ui: `npx shadcn@latest init`, pilih tema default.
- [x] Instal dependensi: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `leaflet`, `react-leaflet`, `recharts`, `lucide-react`.
- [x] Buat `.env.example` berisi semua variabel dari ARCHITECTURE.md §9 (Supabase, Langflow, Flow IDs, Embedding, Clustering, Early Warning, Demo Mode, `DEMO_SEED_PASSWORD`), tanpa nilai asli.
- [ ] Buat `.env.local` dari `.env.example` dan isi nilai Supabase + Langflow yang sudah tersedia.
- [x] Tambahkan `.env.local` ke `.gitignore`.
- [x] Buat `src/lib/supabase/client.ts`: ekspor fungsi `createClient()` (server-side, menggunakan `SUPABASE_SERVICE_ROLE_KEY`) dan `createBrowserClient()` (menggunakan `NEXT_PUBLIC_*`).
- [x] Buat `src/lib/langflow/flows.ts`: peta nama flow ke env variable Flow ID.
- [x] Buat `src/lib/langflow/client.ts`: fungsi `runFlow(flowName, inputValue)` dengan header `x-api-key`, timeout 15 detik, dan fungsi `healthCheck()` yang mengembalikan `true`/`false`.
- [x] Buat layout dasar `src/app/layout.tsx` dengan sidebar navigasi per role (link berbeda untuk warga / operator / petugas_opd / pimpinan).
- [x] Buat halaman placeholder untuk setiap route utama: `/lapor`, `/dashboard`, `/peta`, `/alert`, `/tugas`, `/ringkasan` — masing-masing dengan loading state dan empty state.
- [x] Pastikan `npm run build` dan `npm run lint` lulus tanpa error.

### Definition of Done

- [ ] `npm run dev` berjalan tanpa error, `localhost:3000` terbuka di browser.
- [ ] `npm run build` selesai tanpa TypeScript error.
- [ ] `npm run lint` lulus tanpa warning.
- [ ] `src/lib/langflow/client.ts` → fungsi `healthCheck()` dipanggil dari konsol browser dev tools dan mengembalikan `true` (Langflow lokal berjalan).
- [ ] Sidebar menampilkan link navigasi yang berbeda bergantung role (bisa diverifikasi dengan mengubah role di state sementara).
- [ ] `.env.example` berisi semua variabel yang disebutkan di ARCHITECTURE.md §9.

---

## M1 — Database & Seed

### Langflow (manual di UI)

> Tidak ada flow baru yang dibangun di M1. Langflow lokal harus sudah berjalan dari M0.

### Kode (Bob)

- [x] Tulis migrasi SQL pertama `supabase/migrations/0001_init.sql`: aktifkan ekstensi `pgvector`, buat semua tabel sesuai ARCHITECTURE.md §4 (`regions`, `opd`, `complaints`, `complaint_embeddings`, `clusters`, `triage_results`, `triage_overrides`, `coordination_plans`, `tasks`, `task_dependencies`, `verifications`, `citizen_confirmations`, `alerts`, `alert_dismissals`, `ai_cache`).
- [x] Buat tabel `profiles` dengan kolom `id`, `role` (`warga|operator|petugas_opd|pimpinan`), `opd_id` (nullable), `is_demo`, dan trigger `on_auth_user_created` yang mengisi profil default saat user baru dibuat.
- [x] Terapkan RLS ke semua tabel sesuai ARCHITECTURE.md §8 (gunakan `auth.uid()` dan join ke `profiles`).
- [x] Buat `src/lib/constants/categories.ts`: array `CATEGORIES` berisi semua 7 slug dengan label tampilan dan `opd_default_short_name` sesuai LANGFLOW_FLOWS.md § Referensi Cepat: Kategori Baku.
- [x] Buat seed data wilayah (5 kecamatan, ≥ 15 desa) di `supabase/seed/regions.ts`.
- [x] Buat seed data OPD (7 OPD sesuai LANGFLOW_FLOWS.md § Referensi Cepat: Daftar OPD Seed) di `supabase/seed/opd.ts`.
- [x] Buat seed akun demo di `supabase/seed/accounts.ts`: 5 akun (`warga@demo.aduin`, `operator@demo.aduin`, `pu@demo.aduin`, `dinkes@demo.aduin`, `pimpinan@demo.aduin`) dengan password dari `DEMO_SEED_PASSWORD`.
- [x] Buat komponen `<RoleSwitcher />` yang hanya dirender saat `NEXT_PUBLIC_DEMO_MODE=true`; komponen ini memungkinkan login instan antar 5 akun demo dari header.
- [x] Buat ±150 aduan seed di `supabase/seed/complaints.ts` — tanpa hasil AI (kolom AI di-set `null`); setiap aduan memiliki `label_manual` dan `is_seed = true`; distribusi sesuai ARCHITECTURE.md §10 (5 kecamatan, semua 7 kategori, semua 8 state yang dibutuhkan demo, lonjakan tersembunyi).
- [x] Buat `supabase/seed/index.ts` yang menjalankan semua seed secara berurutan (wilayah → OPD → akun → aduan → `ai_cache` dari snapshot jika ada).
- [x] Buat `POST /api/seed/reset` (hanya aktif jika `NEXT_PUBLIC_DEMO_MODE=true`): hapus baris `is_seed = true`, jalankan ulang seed, kembalikan jumlah baris yang di-seed.
- [x] Pastikan `npm run build` dan `npm run lint` lulus.

### Definition of Done

- [ ] `npx tsx supabase/seed/index.ts` berjalan tanpa error; semua tabel terisi di Supabase dashboard.
- [ ] Tabel `complaints` memiliki ±150 baris dengan `is_seed = true`.
- [ ] Semua 7 slug kategori terwakili di seed.
- [ ] Semua 8 state (`pending`, `triage_failed`, `triaged`, `in_progress`, `ai_verified`, `needs_review`, `closed`, dan satu lagi opsional) muncul di seed sesuai jumlah minimum di ARCHITECTURE.md §10.
- [ ] `POST /api/seed/reset` mengembalikan JSON `{ "seeded": <n> }` dan tabel kembali ke kondisi seed awal.
- [ ] Komponen `<RoleSwitcher />` muncul di header ketika `NEXT_PUBLIC_DEMO_MODE=true`; klik nama role langsung berpindah sesi.
- [ ] `npm run build` dan `npm run lint` lulus tanpa error.

---

## M2 — Intake & Triage

### Langflow (manual di UI)

**Flow `aduin-clarify`:**
- [ ] Buat flow baru bernama `aduin-clarify` di UI Langflow.
- [ ] Susun komponen: **Chat Input** → **Prompt** (salin isi system prompt dari `langflow/prompts/clarify.md`, variabel `{input_json}`) → **IBM watsonx.ai** (model `ibm/granite-4-h-small`, temperature 0.0, max tokens 200) → **Chat Output**.
- [ ] Tes di Playground dengan test cases dari LANGFLOW_FLOWS.md §Flow 1 (TC-1 aduan lengkap, TC-2 tanpa lokasi, TC-3 terlalu singkat).
- [ ] Setelah semua TC lulus, export flow sebagai JSON ke `langflow/flows/aduin-clarify.json`.
- [ ] Catat Flow ID (UUID di URL Langflow) ke `.env.local` sebagai `LANGFLOW_FLOW_CLARIFY_ID`.

**Flow `aduin-triage`:**
- [ ] Buat flow baru bernama `aduin-triage` di UI Langflow.
- [ ] Susun komponen: **Chat Input** → **Prompt** (salin isi system prompt dari `langflow/prompts/triage.md`, variabel `{input_json}`) → **IBM watsonx.ai** (model `ibm/granite-4-h-small`, temperature 0.0, max tokens 300) → **Chat Output**.
- [ ] Tes di Playground dengan 4 test cases dari LANGFLOW_FLOWS.md §Flow 2 (TC-1 jalan rusak, TC-2 diare, TC-3 sampah pasar, TC-4 aduan ambigu); verifikasi output sesuai skema JSON.
- [ ] Verifikasi bahwa `opd_short_name` yang dihasilkan **tidak pernah** `BPKAD` untuk test cases di atas.
- [ ] Setelah semua TC lulus, export flow ke `langflow/flows/aduin-triage.json`.
- [ ] Catat Flow ID ke `.env.local` sebagai `LANGFLOW_FLOW_TRIAGE_ID`.

### Kode (Bob)

- [x] Buat `src/lib/langflow/schemas.ts`: ekspor `clarifyOutputSchema`, `triageOutputSchema` (dengan `OPD_SHORT_NAMES` tanpa `BPKAD`), dan tipe inferensi Zod masing-masing sesuai LANGFLOW_FLOWS.md.
- [x] Perbarui `src/lib/langflow/client.ts`: tambahkan fungsi `runClarify()` dan `runTriage()` yang memanggil `runFlow()` dan memvalidasi output dengan Zod; kembalikan typed result atau `null` jika gagal.
- [x] Buat halaman Simulator WhatsApp `src/app/(warga)/lapor/page.tsx`: tampilan gelembung chat, input teks, tombol kirim, pilih lokasi (dropdown desa/kecamatan), upload foto opsional; loading state saat menunggu AI; empty state saat percakapan kosong.
- [x] Buat `POST /api/complaints`: simpan aduan ke `complaints` dengan status `pending`; jika clarify diperlukan (field `needs_clarification = true` dari flow), kembalikan pertanyaan balik; jika lengkap, trigger pipeline triage.
- [x] Buat pipeline triage di `POST /api/triage/[id]`: panggil `runTriage()`, validasi Zod, simpan ke `triage_results`; jika sukses set `complaints.status = 'triaged'` dan buat `coordination_plan` sederhana (1 task ke `effective_opd_id`); jika gagal set `status = 'triage_failed'`.
- [x] Buat `POST /api/triage/[id]/override`: simpan override ke `triage_overrides` (operator only), perbarui `effective_category` dan `effective_opd_id`.
- [x] Buat halaman daftar aduan `src/app/(operator)/dashboard/page.tsx`: tabel aduan dengan kolom status, kategori, OPD, urgensi, wilayah, tanggal; filter by status/OPD/kategori; loading state dan empty state.
- [x] Buat `supabase/seed/triage-seed.ts`: men-triage semua aduan seed berstatus `pending` lewat pipeline AI sungguhan (konkurensi maksimal 3), tampilkan progres, cetak akurasi kategori vs `label_manual` di akhir. Jalankan: `npx tsx --env-file=.env.local supabase/seed/triage-seed.ts`.
- [x] Buat halaman detail aduan `src/app/aduan/[id]/page.tsx` — **satu halaman kanonik** untuk operator dan petugas_opd (bukan dua salinan di `(operator)/aduan/[id]` + `(opd)/aduan/[id]`: dua route group yang resolve ke path URL identik gagal di-build oleh Next.js App Router; ARCHITECTURE.md §7 sendiri hanya mendaftar satu path `/aduan/[id]`). Menampilkan hasil triage AI + alasan; tombol override untuk operator; status badge + badge "Override".
- [x] Pastikan `npm run build` dan `npm run lint` lulus.

### Definition of Done

- [ ] Buka `localhost:3000/lapor`, ketik aduan lengkap, tekan kirim → kartu aduan muncul di `/dashboard` dalam < 10 detik dengan kategori, OPD, urgensi, dan alasan terisi.
- [ ] Ketik aduan tanpa lokasi → chatbot menampilkan pertanyaan klarifikasi sebelum menyimpan.
- [ ] Buka aduan di `/dashboard`, klik override kategori → perubahan tersimpan dan badge "Override" muncul.
- [ ] Aduan yang Langflow-nya sengaja di-timeout (matikan Langflow) masuk dengan `status = triage_failed` dan tidak crash UI.
- [ ] `triageOutputSchema` Zod di `schemas.ts` menolak input `opd_short_name: "BPKAD"` (bisa diverifikasi dengan unit test sederhana atau `node -e`).
- [ ] `npm run build` dan `npm run lint` lulus tanpa error.

---

## M3 — Embedding & Clustering

### Langflow (manual di UI)

**Flow `aduin-embed`:**
- [x] Buat flow baru bernama `aduin-embed` di UI Langflow.
- [x] Susun komponen sesuai LANGFLOW_FLOWS.md §Flow 3: **Chat Input** → komponen embedding `ibm/granite-embedding-278m-multilingual` (Custom Component yang memanggil watsonx.ai embedding) → **Chat Output** yang mengembalikan vektor JSON.
- [x] Tes di Playground dengan test cases dari LANGFLOW_FLOWS.md §Flow 3 (TC-1 jalan rusak, TC-2 sampah, TC-3 dua aduan serupa, TC-4 dua aduan berbeda kategori); verifikasi vektor bertipe array 768 angka float.
- [x] Setelah semua TC lulus, export flow ke `langflow/flows/aduin-embed.json`.
- [x] Catat Flow ID ke `.env.local` sebagai `LANGFLOW_FLOW_EMBED_ID`.

### Kode (Bob)

- [x] Tambahkan `embedOutputSchema` ke `src/lib/langflow/schemas.ts`: validasi array 768 angka float.
- [x] Tambahkan fungsi `runEmbed()` ke `src/lib/langflow/client.ts`.
- [x] Perbarui pipeline `POST /api/triage/[id]`: setelah triage berhasil, panggil `runEmbed()`, simpan vektor ke `complaint_embeddings`; jika gagal, log error tapi jangan gagalkan triage.
- [x] Buat `src/lib/analytics/clustering.ts`: fungsi `runClustering()` yang membaca `complaint_embeddings` + koordinat + timestamp, mengelompokkan aduan berdasarkan cosine similarity ≥ `CLUSTER_SIMILARITY_THRESHOLD`, jarak ≤ `CLUSTER_RADIUS_METERS`, dan rentang waktu ≤ `CLUSTER_WINDOW_DAYS`; simpan ke tabel `clusters`.
- [x] Buat `POST /api/cluster`: trigger `runClustering()` (dipanggil setiap aduan baru masuk atau manual oleh operator).
- [x] Buat `GET /api/cluster`: kembalikan data cluster (centroid, jumlah anggota, label, kategori) untuk peta.
- [x] Buat halaman peta `src/app/(operator)/peta/page.tsx` dengan Leaflet: marker individual per aduan (warna per kategori), lingkaran per kecamatan (warna/ukuran berdasarkan jumlah aduan aktif — pengganti choropleth karena tidak ada GeoJSON batas wilayah); filter kategori + jalur; loading state dan empty state; klik marker tampilkan ringkasan aduan + anggota cluster-nya di popup.
- [x] Pastikan `npm run build` dan `npm run lint` lulus.

### Definition of Done

- [ ] Setelah aduan baru masuk, cek tabel `complaint_embeddings` di Supabase → baris baru berisi array 1024 angka.
- [ ] Buka `/peta` → marker aduan muncul di koordinat yang benar; warna choropleth kecamatan berbeda berdasarkan volume aduan.
- [ ] Data seed yang sudah ter-cluster (Bantaran) terlihat sebagai kumpulan marker berdekatan; klik salah satu marker menampilkan popup ringkasan.
- [ ] `POST /api/cluster` berhasil dipanggil dari browser dev tools (Fetch) dan mengembalikan `{ "clusters": <n> }`.
- [ ] `npm run build` dan `npm run lint` lulus tanpa error.

---

## M4 — Koordinasi OPD

### Langflow (manual di UI)

**Flow `aduin-opd-agent`:**
- [ ] Buat flow baru bernama `aduin-opd-agent` di UI Langflow.
- [ ] Susun komponen sesuai LANGFLOW_FLOWS.md §Flow 4: **Chat Input** → **Prompt** (salin isi system prompt dari `langflow/prompts/opd-agent.md`, variabel `{input_json}`) → **IBM watsonx.ai** (model `ibm/granite-4-h-small`, temperature 0.0, max tokens 600) → **Chat Output**.
- [ ] Tes di Playground dengan test cases dari LANGFLOW_FLOWS.md §Flow 4 (TC-1 jalan rusak sekolah multi-OPD, TC-2 diare single OPD, TC-3 banjir kompleks); verifikasi output memiliki `sequence` unik, `depends_on` valid, dan `opd_short_name` dari daftar yang berlaku (termasuk `BPKAD` untuk anggaran).
- [ ] Setelah semua TC lulus, export flow ke `langflow/flows/aduin-opd-agent.json`.
- [ ] Catat Flow ID ke `.env.local` sebagai `LANGFLOW_FLOW_OPD_AGENT_ID`.

### Kode (Bob)

- [ ] Tambahkan `opdAgentOutputSchema` ke `src/lib/langflow/schemas.ts` sesuai LANGFLOW_FLOWS.md §Flow 4 (termasuk `superRefine` validasi sequence unik dan `depends_on` hanya merujuk sequence lebih kecil).
- [ ] Tambahkan fungsi `runOpdAgent()` ke `src/lib/langflow/client.ts`.
- [ ] Buat `POST /api/coordination/[id]`: panggil `runOpdAgent()`, validasi Zod, hapus `coordination_plan` dan `tasks` lama (plan_type sederhana), insert plan baru dengan tasks dan dependencies; tandai `plan_type = 'ai_generated'`; jika gagal kembalikan error tanpa mengubah plan yang ada.
- [ ] Buat `PATCH /api/tasks/[taskId]`: update `tasks.status` (`belum_mulai|proses|selesai`) oleh petugas_opd yang ditugaskan; perbarui `complaints.status` ke `in_progress` jika belum.
- [ ] Perbarui halaman detail aduan `/aduan/[id]`: tampilkan daftar sub-tugas dengan OPD, urutan, ketergantungan, dan status; tombol "Buat Rencana Koordinasi" untuk operator (muncul setelah aduan `triaged`); status tiap sub-tugas bisa diperbarui oleh petugas_opd dari halaman yang sama.
- [ ] Buat halaman portal tugas `src/app/(opd)/tugas/page.tsx`: daftar tasks yang ditugaskan ke OPD pengguna yang sedang login; filter by status; link ke detail aduan.
- [ ] Buat halaman detail tugas `src/app/(opd)/tugas/[taskId]/page.tsx`: detail sub-tugas, tombol perbarui status.
- [ ] Pastikan `npm run build` dan `npm run lint` lulus.

### Definition of Done

- [ ] Buka detail aduan yang sudah `triaged`, klik "Buat Rencana Koordinasi" → daftar sub-tugas muncul dengan OPD, urutan, dan ketergantungan (contoh: Survei → BPKAD → Perbaikan untuk aduan jalan rusak).
- [ ] Login sebagai `pu@demo.aduin`, buka `/tugas` → hanya tugas milik Dinas PU yang muncul.
- [ ] Klik tugas, ubah status ke "proses" → status tersimpan dan muncul di `/aduan/[id]`.
- [ ] Jika Langflow dimatikan saat klik "Buat Rencana Koordinasi" → pesan error muncul di UI; rencana sederhana sebelumnya tidak hilang.
- [ ] `npm run build` dan `npm run lint` lulus tanpa error.

---

## M5 — Verifikasi Penyelesaian

### Langflow (manual di UI)

**Flow `aduin-verify`:**
- [ ] Buat flow baru bernama `aduin-verify` di UI Langflow.
- [ ] Susun komponen sesuai LANGFLOW_FLOWS.md §Flow 5 Opsi A (Custom Component Vision dengan `ibm/granite-vision-3-3-2b`); jika Vision tidak tersedia, gunakan Opsi B (fallback teks).
- [ ] Tes di Playground dengan test cases dari LANGFLOW_FLOWS.md §Flow 5 (TC-1 foto jalan diperbaiki, TC-2 foto tidak relevan, TC-3 foto buram, TC-4 tanpa foto sebelum).
- [ ] Setelah semua TC lulus, export flow ke `langflow/flows/aduin-verify.json`.
- [ ] Catat Flow ID ke `.env.local` sebagai `LANGFLOW_FLOW_VERIFY_ID`.

### Kode (Bob)

- [ ] Tambahkan `verifyOutputSchema` ke `src/lib/langflow/schemas.ts` sesuai LANGFLOW_FLOWS.md §Flow 5.
- [ ] Tambahkan fungsi `runVerify()` ke `src/lib/langflow/client.ts`.
- [ ] Konfigurasi Supabase Storage bucket `aduan-photos` (public read, authenticated write).
- [ ] Buat `POST /api/verify/[id]`: terima multipart/form-data dengan foto; upload ke Supabase Storage; simpan URL ke `complaints.after_photo_url`; panggil `runVerify()`; validasi Zod; update `complaints.status` ke `ai_verified` atau `needs_review`; simpan ke tabel `verifications`.
- [ ] Buat `POST /api/verify/[id]/review`: operator menyetujui (status → `ai_verified`, `verification_method = 'manual_approval'`) atau mengembalikan (status → `in_progress`, simpan `rejection_note`).
- [ ] Buat `POST /api/verify/[id]/confirm`: warga mengonfirmasi (status → `closed`) atau menolak (status → `in_progress`, simpan catatan); simpan ke `citizen_confirmations`.
- [ ] Perbarui halaman detail aduan `/aduan/[id]`: tampilkan foto sebelum (dari `complaints.photo_url`) dan sesudah (dari `complaints.after_photo_url`); tombol upload foto untuk petugas_opd saat status `in_progress`; tombol review untuk operator saat `needs_review`; tombol konfirmasi / tolak untuk warga saat `ai_verified`.
- [ ] Pastikan tidak ada transisi ke `closed` tanpa melewati `ai_verified` (validasi di route handler).
- [ ] Pastikan `npm run build` dan `npm run lint` lulus.

### Definition of Done

- [ ] Login sebagai `pu@demo.aduin`, buka tugas `in_progress`, upload foto → status berubah ke `ai_verified` atau `needs_review` dalam < 15 detik.
- [ ] Jika status `needs_review`, login sebagai `operator@demo.aduin` → tombol setujui / kembalikan muncul; pilih setujui → status berubah ke `ai_verified`.
- [ ] Login sebagai `warga@demo.aduin`, buka aduan `ai_verified`, klik "Konfirmasi Selesai" → status berubah ke `closed`; klik "Tolak" → status kembali ke `in_progress`.
- [ ] Foto sebelum dan sesudah ditampilkan berdampingan di halaman detail aduan.
- [ ] Mencoba mengubah aduan langsung dari `in_progress` ke `closed` via API (`PATCH`) → ditolak dengan HTTP 422.
- [ ] `npm run build` dan `npm run lint` lulus tanpa error.

---

## M6 — Early Warning & Dashboard

### Langflow (manual di UI)

**Flow `aduin-alert-summary`:**
- [ ] Buat flow baru bernama `aduin-alert-summary` di UI Langflow.
- [ ] Susun komponen sesuai LANGFLOW_FLOWS.md §Flow 6: **Chat Input** → **Prompt** (salin isi system prompt dari `langflow/prompts/alert-summary.md`, variabel `{input_json}`) → **IBM watsonx.ai** (model `ibm/granite-4-h-small`, temperature 0.3, max tokens 400) → **Chat Output**.
- [ ] Tes di Playground dengan test cases dari LANGFLOW_FLOWS.md §Flow 6 (TC-1 lonjakan diare, TC-2 lonjakan jalan rusak, TC-3 lonjakan banjir lintas OPD).
- [ ] Setelah semua TC lulus, export flow ke `langflow/flows/aduin-alert-summary.json`.
- [ ] Catat Flow ID ke `.env.local` sebagai `LANGFLOW_FLOW_ALERT_SUMMARY_ID`.

### Kode (Bob)

- [ ] Tambahkan `alertSummaryOutputSchema` ke `src/lib/langflow/schemas.ts` sesuai LANGFLOW_FLOWS.md §Flow 6 (termasuk `BPKAD` dalam enum `opd_list`).
- [ ] Tambahkan fungsi `runAlertSummary()` ke `src/lib/langflow/client.ts`.
- [ ] Buat `src/lib/analytics/early-warning.ts`: fungsi `checkEarlyWarning(complaintId)` yang menghitung baseline **tepat 14 hari** per kombinasi `(category, region_id)`, menghitung z-score, dan mengembalikan data lonjakan atau `null` jika tidak ada.
- [ ] Perbarui pipeline `POST /api/complaints`: setelah aduan tersimpan dan triage selesai, panggil `checkEarlyWarning()`; jika z-score ≥ `ALERT_THRESHOLD_Z` dan count ≥ `ALERT_MIN_COUNT`, insert baris ke `alerts` dengan `summary_status = 'pending_retry'`, lalu panggil `runAlertSummary()` dan perbarui baris dengan ringkasan + `summary_status = 'done'`.
- [ ] Buat `GET /api/alert`: kembalikan daftar alert aktif (belum di-dismiss) beserta `ai_summary` dan `opd_list`.
- [ ] Buat `POST /api/alert/check`: endpoint manual untuk trigger pengecekan z-score oleh operator.
- [ ] Buat `POST /api/alert/[alertId]/dismiss`: simpan ke `alert_dismissals`, tandai alert sebagai selesai.
- [ ] Buat halaman panel alert `src/app/(operator)/alert/page.tsx`: daftar alert aktif dengan kategori, wilayah, z-score, jumlah aduan, ringkasan AI, rekomendasi OPD, link ke daftar aduan terkait, tombol "Dismiss", dan tombol "Coba Lagi" jika `summary_status = 'pending_retry'`.
- [ ] Buat halaman dashboard pimpinan `src/app/(pimpinan)/ringkasan/page.tsx`: KPI (total aduan, rata-rata waktu penyelesaian, % closed), grafik tren per kategori (Recharts), choropleth atau bar chart per kecamatan, daftar alert aktif, tabel peringkat kinerja OPD; semua dengan loading state dan empty state; data dari `GET /api/analytics/*` saja (tidak panggil Langflow).
- [ ] Buat `GET /api/analytics/kpi`, `GET /api/analytics/trend`, `GET /api/analytics/opd-ranking`.
- [ ] Pastikan `npm run build` dan `npm run lint` lulus.

### Definition of Done

- [ ] Buka `/alert` → alert lonjakan diare Sumberasih dari data seed muncul dengan z-score, ringkasan AI, dan rekomendasi OPD (Dinkes, PDAM).
- [ ] Klik "Dismiss" pada alert → alert hilang dari daftar; baris di `alert_dismissals` terbuat di Supabase.
- [ ] Jika ringkasan AI belum ada (`summary_status = 'pending_retry'`), tombol "Coba Lagi" muncul; klik → `runAlertSummary()` dipanggil ulang.
- [ ] Buka `/ringkasan` sebagai `pimpinan@demo.aduin` → KPI, grafik, dan tabel kinerja OPD terisi dari data seed.
- [ ] `GET /api/analytics/kpi` mengembalikan JSON dengan `total_complaints`, `avg_resolution_hours`, `closed_pct`.
- [ ] `npm run build` dan `npm run lint` lulus tanpa error.

---

## M7 — Demo Ready

### Langflow (manual di UI)

- [ ] Verifikasi semua 6 flow aktif dan tidak ada flow yang berstatus error di Langflow UI.
- [ ] Jalankan ulang semua test cases dari LANGFLOW_FLOWS.md untuk 6 flow; pastikan semua masih lulus setelah perubahan konfigurasi.

### Kode (Bob)

- [ ] Tulis `supabase/seed/precompute-ai.ts`: script yang membaca semua aduan seed, memanggil `runTriage()` + `runEmbed()` via `client.ts` (service role), dan menyimpan hasil ke `supabase/seed/ai-cache-snapshot.json` (hanya aduan yang lulus validasi Zod).
- [ ] Perbarui `supabase/seed/index.ts`: baca `ai-cache-snapshot.json` dan insert ke tabel `ai_cache` saat seed.
- [ ] Commit `ai-cache-snapshot.json` ke repo sehingga demo bisa berjalan offline dari cache.
- [ ] Hitung akurasi triage: dari 150 aduan seed, bandingkan `triage_results.category` vs `label_manual`; cetak laporan persentase ke terminal; target ≥ 80%.
- [ ] Verifikasi alert cadangan tersedia: cek tabel `alerts` memiliki setidaknya 1 baris dengan `summary_status = 'done'` yang di-seed langsung (fallback jika z-score tidak terpicu).
- [ ] Polish UI: pastikan semua halaman memiliki loading state, empty state, dan error state yang informatif.
- [ ] Buat `README.md` di root: setup lokal (klon, `npm install`, `.env.local`, Supabase setup, Langflow setup, seed, `npm run dev`), daftar akun demo, perintah reset seed.
- [ ] Jalankan skenario demo end-to-end (Step 1–7 dari PRD.md §5) dan catat tiap step di checklist di bawah.
- [ ] Pastikan `npm run build` dan `npm run lint` lulus final.

### Definition of Done — Checklist Gladi Skenario Demo

- [ ] **Step 1**: Buka `/lapor`, kirim aduan jalan rusak di Bantaran → aduan tersimpan dengan `status = pending`.
- [ ] **Step 2**: Dalam < 10 detik, aduan muncul di `/dashboard` dengan `status = triaged`, kategori "Infrastruktur Jalan", OPD "DPU", urgensi 4, jalur "bertahap", dan alasan terisi.
- [ ] **Step 3**: Buka `/peta` → aduan baru bergabung ke cluster Bantaran yang sudah ada dari seed; marker muncul di koordinat yang benar; choropleth kecamatan Bantaran menggelap.
- [ ] **Step 4**: Buka `/alert` → alert lonjakan diare Sumberasih muncul dengan z-score ≥ 2.8, ringkasan AI, dan rekomendasi Dinkes + PDAM.
- [ ] **Step 5**: Dari detail aduan jalan rusak, klik "Buat Rencana Koordinasi" → sub-tugas muncul: Survei (DPU) → Anggaran (BPKAD) → Perbaikan (DPU).
- [ ] **Step 6**: Login sebagai `pu@demo.aduin`, buka tugas, upload foto → status berubah ke `ai_verified`; login sebagai `warga@demo.aduin`, konfirmasi → status berubah ke `closed`.
- [ ] **Step 7**: Login sebagai `pimpinan@demo.aduin`, buka `/ringkasan` → KPI ≥ 151 aduan, grafik tren, alert lonjakan diare, dan tabel kinerja OPD semuanya terisi.
- [ ] `npm run build` selesai tanpa error.
- [ ] `npm run lint` selesai tanpa warning.
- [ ] Akurasi triage seed ≥ 80% (cetak dari skrip perbandingan).
