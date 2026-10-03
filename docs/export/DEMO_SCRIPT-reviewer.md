<div class="cover">
<p class="cover-kicker">Prototipe Hackathon IBM</p>
<h1 class="cover-title">Aduin — Naskah Demo</h1>
<p class="cover-tagline">“Aduin aja, sisanya kami yang urus.”</p>
<p class="cover-meta">3 Oktober 2026</p>
</div>

# Naskah Demo Aduin

Skenario end-to-end Step 1–7 (PRD.md §5), ±10 menit. Satu presenter mengoperasikan aplikasi; tiap
langkah berisi role yang dipakai, aksi yang diklik, hasil yang diharapkan, dan yang diucapkan.

**Pindah role** lewat tombol di header (*Demo: Warga · Operator · DPU · Dinkes · BPKAD · Pimpinan*)
atau tombol "Masuk sebagai …" di landing page `/`.

**Foto demo** (siapkan di desktop laptop demo):
- `jalan-sebelum.jpg` — jalan berlubang di depan sekolah; dilampirkan warga saat melapor (Step 1).
- `jalan-sesudah-v2.jpg` — jalan yang sama setelah ditambal; diunggah petugas DPU (Step 6).

Gunakan dua foto lokasi yang sama dari sudut yang mirip. AI vision hanya memberi status
"Terverifikasi" jika kedua foto jelas memperlihatkan objek yang sama dan perubahannya nyata.

---

## Persiapan

### H-1

- [ ] `git pull`, `npm install`, `npm run build` lulus.
- [ ] Migrasi `0001`–`0004` sudah diterapkan di Supabase.
- [ ] `.env.local` lengkap: Supabase, `LANGFLOW_API_KEY`, enam `LANGFLOW_FLOW_*_ID`, `NEXT_PUBLIC_DEMO_MODE=true`, `DEMO_SEED_PASSWORD`.
- [ ] Langflow menyala; keenam flow terimpor dan Global Variables `WATSONX_API_KEY`/`WATSONX_PROJECT_ID` terhubung (termasuk di custom component **Aduin Verify Vision**).
- [ ] Uji tiap flow di Playground Langflow sekali (cukup satu test case per flow).
- [ ] `npx tsx --env-file=.env.local supabase/seed/index.ts` (atau **Reset Demo**) — output menyebut "Alert diare Sumberasih aktif".
- [ ] **Gladi penuh Step 1–7** memakai teks aduan dan foto yang persis sama dengan hari-H.
- [ ] Setelah gladi: **Reset Demo** di `/dashboard` (menghapus aduan gladi, memulihkan data seed).
- [ ] `jalan-sebelum.jpg` dan `jalan-sesudah-v2.jpg` ada di desktop.

### 1 jam sebelum demo

- [ ] Langflow menyala: `curl http://localhost:7860/health` → `{"status":"ok"}`.
- [ ] Aplikasi menyala (`npm run dev` atau `npm run build && npm run start`) dan `http://localhost:3000` terbuka.
- [ ] `npx tsx --env-file=.env.local supabase/seed/refresh-demo-timeline.ts` — output menampilkan alert **Kesehatan & Sanitasi — Sumberasih** (`[BARU]` atau `[DIPERBARUI]`, `ringkasan=done`). Jika ada aduan sisa latihan, pakai **Reset Demo** sebagai gantinya.
- [ ] Buka `/alert` sebagai Operator: alert diare tampil **dengan ringkasan AI**. Jika tertulis "Ringkasan AI belum tersedia", klik **Coba Lagi**.
- [ ] Coba pindah ke keenam role sekali lewat header.
- [ ] Zoom browser 110–125%, tutup tab lain, matikan notifikasi.

---

## Step 1 — Intake aduan baru (± 1 menit)

**Role:** Warga · **Halaman:** `/lapor`

**Aksi**
1. Pilih lokasi **Bantaran — Kec. Bantaran**.
2. Klik **Lampirkan foto** → `jalan-sebelum.jpg`.
3. Ketik lalu **Kirim**:
   > Pak, jalan di depan SD Negeri 1 Bantaran berlubang besar, sudah seminggu belum diperbaiki, berbahaya untuk anak sekolah.

**Hasil yang diharapkan:** bot tidak bertanya balik (detail sudah cukup). Dalam < 10 detik muncul
balasan "Aduan Anda sudah tercatat dan diproses AI ✅" dengan kategori, OPD, urgensi, dan alasan.
Aduan muncul di daftar **Aduan Saya** di bawah chat.

**Ucapkan:** "Warga cukup mengadu seperti chat WhatsApp biasa. Kalau aduannya kurang lengkap, misalnya
tanpa lokasi, Aduin akan bertanya balik dulu. Aduan ini sudah lengkap, jadi langsung diproses."

## Step 2 — Triage AI yang bisa dijelaskan (± 1 menit)

**Role:** Operator · **Halaman:** `/dashboard` → `/aduan/[id]`

**Aksi:** pindah ke **Operator**. Aduan baru ada di baris teratas `/dashboard`. Klik untuk membuka detail.

**Hasil yang diharapkan:** status *Sudah Ditriase*, Kategori **Infrastruktur Jalan**, OPD **DPU**,
urgensi sekitar 4/5, jalur **Bertahap**, dan kartu **"Kenapa AI memutuskan ini"** berisi alasan.

**Ucapkan:** "Dalam hitungan detik AI menentukan kategori, OPD tujuan, urgensi, dan jalur penanganan,
lengkap dengan alasannya. Operator tetap memegang kendali: kalau AI keliru, operator bisa
meng-override, dan koreksinya tercatat."

## Step 3 — Cluster dan peta hotspot (± 1 menit)

**Role:** Operator · **Halaman:** `/peta`

**Aksi:** buka **Peta Hotspot**, filter kategori **Infrastruktur Jalan**, perbesar ke Kecamatan
Bantaran, klik marker aduan baru di Desa Bantaran.

**Hasil yang diharapkan:** marker baru berada di Desa Bantaran, di tengah kumpulan 6 aduan jalan rusak
dari data seed (radius < 500 m). Popup menampilkan anggota cluster yang sama, dan lingkaran Kecamatan
Bantaran termasuk yang terbesar.

**Ucapkan:** "Aduin mengelompokkan aduan yang isinya mirip, lokasinya berdekatan, dan waktunya
berdekatan. Ini bukan satu jalan rusak, tapi tujuh laporan untuk titik yang sama dalam dua minggu.
Prioritasnya jadi jelas."

## Step 4 — Early warning lonjakan diare (± 1 menit)

**Role:** Operator · **Halaman:** `/alert`

**Aksi:** buka **Peringatan Dini**.

**Hasil yang diharapkan:** alert **Lonjakan Kesehatan & Sanitasi — Sumberasih** dengan
**6 aduan dalam 24 jam** vs baseline 14 hari ≈ 0/hari (z-score jauh di atas ambang 2.0), ringkasan AI
yang menyebut diare dan dugaan masalah air bersih, serta rekomendasi OPD **Dinkes** dan **PDAM**.

**Ucapkan:** "Tidak ada satu operator pun yang melaporkan ini. Sistem sendiri yang melihat bahwa enam
aduan diare dalam sehari di satu wilayah itu tidak normal dibanding dua minggu sebelumnya, lalu AI
merangkum situasinya dan menyarankan siapa yang harus turun."

**Jika ringkasan belum muncul:** klik **Coba Lagi** (butuh Langflow menyala).

## Step 5 — Koordinasi lintas OPD (± 1,5 menit)

**Role:** Operator · **Halaman:** `/aduan/[id]` (aduan jalan dari Step 1)

**Aksi:** kembali ke detail aduan jalan → **Buat Rencana Koordinasi**. Tunggu (bisa sampai 1 menit).

**Hasil yang diharapkan:** badge **Rencana AI** dengan tiga sub-tugas berurutan:
1. **DPU** — survei kerusakan
2. **BPKAD** — alokasi anggaran darurat (bergantung pada #1)
3. **DPU** — perbaikan fisik (bergantung pada #2)

**Ucapkan:** "Jalan rusak di depan sekolah bukan sekadar urusan Dinas PU. Perlu survei dulu, lalu
anggaran darurat dari BPKAD, baru perbaikan. AI menyusun urutan itu beserta ketergantungannya, dan
setiap OPD langsung melihat tugasnya sendiri."

**Jika gagal:** muncul pesan merah dan rencana sederhana tetap utuh. Klik lagi sekali; jika masih
gagal, lanjutkan Step 6 dengan rencana sederhana (satu tugas DPU).

## Step 6 — Verifikasi dan konfirmasi warga (± 2,5 menit)

**Aksi**
1. **DPU** → `/tugas`. Tugas #3 berlabel **Menunggu**. Pada tugas #1 klik **Mulai Kerjakan**, lalu
   **Tandai Selesai**. Status aduan berubah menjadi *Dikerjakan*.
2. **BPKAD** → `/tugas` → tugas #2 **Mulai Kerjakan** → **Tandai Selesai**.
3. **DPU** → `/tugas` → tugas #3 **Mulai Kerjakan** → **Tandai Selesai**.
4. Masih sebagai **DPU**, di kartu **Bukti Penyelesaian** (sekarang aktif karena semua tugas selesai):
   **Pilih foto** → `jalan-sesudah-v2.jpg` → **Unggah Bukti Penyelesaian**.
5. **Warga** → `/lapor`. Di **Aduan Saya**, bot Aduin mengabarkan aduan sudah ditangani dan
   menampilkan foto sebelum dan sesudah → **Konfirmasi Selesai**.

**Catatan foto Step 6**
- `jalan-sebelum.jpg` dilampirkan warga saat melapor (Step 1); `jalan-sesudah-v2.jpg` diunggah
  petugas DPU di langkah 4.
- Keduanya disimpan di laptop demo dan di bucket Supabase Storage `aduan-photos`.
- Keduanya adalah **foto simulasi**, bukan foto lapangan asli.
- **Setiap kali isi foto diganti, ganti juga nama filenya** (mis. `jalan-sesudah-v3.jpg`) agar
  tidak terkena hasil AI lama. URL foto ikut menjadi input flow dan kunci `ai_cache`, dan objek
  publik di bucket di-cache CDN/browser. Akibatnya, file baru dengan nama dan path lama bisa tetap
  terbaca sebagai foto lama, misalnya saat menguji `aduin-verify` di Playground Langflow memakai
  URL bucket. (Unggahan lewat aplikasi selalu mendapat path baru ber-timestamp, jadi aman dari
  masalah ini.)

**Hasil yang diharapkan:** setelah unggah (< 1 menit) muncul **"Terverifikasi AI ✅ — menunggu
konfirmasi warga"** beserta alasan AI. Setelah warga mengonfirmasi, status aduan menjadi **Selesai**.

**Ucapkan:** "Tiket tidak bisa ditutup sepihak. Petugas harus mengunggah bukti, AI membandingkan foto
sebelum dan sesudah, dan yang menutup aduan adalah warga sendiri. Kalau warga menolak, aduan kembali
ke petugas lengkap dengan alasannya."

**Jika AI memberi "Perlu Ditinjau":** pindah ke **Operator** → detail aduan → **Setujui Manual**
(isi catatan singkat), lalu lanjut ke konfirmasi warga. Ucapkan: "Saat AI ragu, keputusan kembali ke
manusia, dan persetujuan manual itu tercatat."

**Hemat waktu (opsional):** tugas #1 dan #2 boleh diselesaikan sebelum naik panggung, lalu di
panggung cukup tunjukkan tugas #3, unggah foto, dan konfirmasi warga.

## Step 7 — Dashboard pimpinan (± 1 menit)

**Role:** Pimpinan · **Halaman:** `/ringkasan`

**Aksi:** pindah ke **Pimpinan**. Tunjukkan KPI, ganti rentang grafik ke **7 hari**, lalu gulir ke
alert dan tabel OPD.

**Hasil yang diharapkan:** KPI total aduan ≥ 151 (150 seed + aduan demo), rata-rata waktu
penyelesaian (jam), persentase selesai; batang **Kesehatan & Sanitasi** melonjak pada hari terakhir;
alert lonjakan diare tampil; tabel peringkat kinerja OPD terisi.

**Ucapkan:** "Untuk pimpinan, semua ini diringkas: berapa aduan, seberapa cepat ditangani, di mana
lonjakannya, dan OPD mana yang paling cepat menyelesaikan. Datanya langsung dari sistem, bukan
rekap manual."

---

## Penutup (± 30 detik)

"Aduin aja, sisanya kami yang urus. Warga cukup mengadu; triase, pemetaan, peringatan dini,
koordinasi antar-OPD, dan verifikasi penyelesaian dikerjakan Aduin dengan IBM watsonx.ai, dengan
manusia tetap memegang keputusan akhir."

## Jika ada yang tidak berjalan

| Masalah | Tindakan cepat |
|---|---|
| Balasan bot "proses triase otomatis sedang mengalami gangguan" | Langflow mati/lambat. Nyalakan Langflow; di <code class="nowrap">/aduan/[id]</code> aduan berstatus *Triase Gagal* — lanjutkan narasi memakai aduan seed jalan rusak Bantaran. |
| Alert diare tidak ada | Operator → <code class="nowrap">/dashboard</code> → **Reset Demo** (±1 menit), lalu buka <code class="nowrap">/alert</code>. |
| Tombol unggah bukti tidak aktif | Masih ada tugas yang belum *Selesai* (cek tugas BPKAD). |
| Data sisa latihan mengganggu | **Reset Demo** di <code class="nowrap">/dashboard</code>. |
