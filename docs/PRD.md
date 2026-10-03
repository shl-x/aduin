# PRD — Aduin

> "Aduin aja, sisanya kami yang urus."

Versi: 0.2 · Hackathon IBM · Status: Draft

---

## 1. Ringkasan dan Problem Statement

### 1.1 Konteks

Sejumlah pemerintah daerah sudah mengoperasikan kanal pengaduan berbasis WhatsApp AI (contoh: Halo Sae, Kab. Probolinggo). Kanal ini bersifat **reaktif**: menerima aduan warga, mencatat, lalu meneruskan ke OPD terkait. Setelah itu tidak ada yang memastikan aduan ditindaklanjuti, tidak ada analisis lintas aduan, dan tidak ada sinyal ke pimpinan ketika masalah yang sama meledak di satu wilayah.

### 1.2 Masalah

| # | Masalah | Dampak |
|---|---------|--------|
| 1 | Aduan masuk tanpa kategorisasi dan prioritas yang konsisten | OPD mana yang harus menangani tidak selalu jelas; aduan menumpuk tanpa urutan |
| 2 | Koordinasi lintas OPD dilakukan manual via chat/telepon | Pekerjaan yang bergantung antar-OPD sering terlambat atau terputus |
| 3 | Tidak ada verifikasi bahwa penyelesaian benar-benar terjadi | Warga tidak mendapat konfirmasi; data penyelesaian tidak bisa dipercaya |
| 4 | Tidak ada deteksi pola atau lonjakan | Masalah sistemik baru terlihat setelah viral di media sosial |
| 5 | Pimpinan daerah/Bappeda tidak punya data agregat real-time | Keputusan anggaran dan prioritas program tidak berbasis bukti aduan |

### 1.3 Solusi

Aduin adalah **lapisan analitik** yang dipasang di atas kanal pengaduan yang sudah ada. Aduin tidak menggantikan kanal tersebut — ia menambahkan:

- Triage AI yang eksplainable (bisa diaudit alasannya)
- Koordinasi lintas OPD berbasis sub-tugas dengan ketergantungan
- Verifikasi penyelesaian dengan foto + konfirmasi warga
- Deteksi dini lonjakan aduan serupa di satu wilayah

---

## 2. Tujuan dan Metrik

### 2.1 Tujuan

1. Mengurangi waktu dari aduan masuk ke OPD yang tepat menerima penugasan.
2. Meningkatkan persentase aduan yang status penyelesaiannya terverifikasi (bukan hanya "diteruskan").
3. Memungkinkan operator command center mendeteksi lonjakan masalah serupa sebelum viral.
4. Menyediakan data agregat aduan per wilayah dan kategori untuk perencanaan.

### 2.2 Metrik Sukses (Demo / Hackathon)

| Metrik | Target Demo |
|--------|-------------|
| Akurasi kategori triage AI vs label manual (150 data seed) | ≥ 80% |
| Aduan yang berhasil di-cluster ke grup yang relevan | ≥ 70% data seed masuk cluster yang koheren |
| Latensi triage (end-to-end, termasuk Langflow) | < 10 detik per aduan |
| Early warning lonjakan diare terpicu dari data seed | Terpicu pada skenario demo yang disiapkan |
| Alert early warning menyertakan ringkasan AI dan rekomendasi OPD | 100% alert punya ringkasan |
| Tiket hanya closed setelah AI terverifikasi DAN warga konfirmasi | 100% alur verifikasi |
| Alur demo end-to-end berjalan tanpa error fatal | 100% |

---

## 3. Persona dan User Stories

### 3.1 Persona

**Budi — Warga Pelapor**
Warga kecamatan yang melaporkan jalan berlubang, banjir, atau masalah kesehatan lewat WhatsApp. Dapat melampirkan foto dan memilih lokasi. Tidak tahu OPD mana yang bertanggung jawab. Ingin tahu aduannya sudah diproses dan mendapat konfirmasi foto hasil perbaikan.

**Siti — Operator Command Center**
Pegawai yang memonitor semua aduan masuk dari berbagai kanal. Bertanggung jawab memastikan aduan terdistribusi ke OPD yang benar. Butuh tampilan agregat dan alert kalau ada lonjakan.

**Pak Eko — Petugas OPD (misal: Dinas PU)**
Menerima penugasan untuk aduan yang relevan dengan instansinya. Perlu tahu sub-tugas apa yang harus diselesaikan, bergantung pada siapa, dan bukti penyelesaian apa yang diminta.

**Bu Rina — Kepala Bappeda / Pimpinan Daerah**
Membutuhkan gambaran besar: kecamatan mana paling banyak aduan, kategori masalah apa yang dominan, OPD mana yang paling lambat merespons.

### 3.2 User Stories

#### Warga Pelapor
- Sebagai warga, saya ingin mengirim aduan lewat antarmuka simulasi WhatsApp (teks, foto opsional, dan lokasi) agar alur pelaporan terasa nyata.
- Sebagai warga, saya ingin chatbot bertanya balik jika detail aduan saya kurang lengkap, agar petugas mendapat informasi yang cukup.
- Sebagai warga, saya ingin mendapat konfirmasi beserta foto hasil perbaikan dan bisa mengonfirmasi atau menolaknya, agar saya yakin laporan saya tidak diabaikan.

#### Operator Command Center
- Sebagai operator, saya ingin melihat semua aduan masuk dengan hasil triage AI (kategori, OPD, urgensi, alasan) agar saya tidak perlu menilai satu per satu secara manual.
- Sebagai operator, saya ingin bisa meng-override kategori, OPD, atau jalur yang dihasilkan AI jika dinilai kurang tepat, dan override tersebut tercatat.
- Sebagai operator, saya ingin melihat peta hotspot aduan per kecamatan beserta posisi cluster di koordinat aslinya agar saya dapat mengidentifikasi area yang perlu perhatian lebih.
- Sebagai operator, saya ingin mendapat peringatan otomatis dengan ringkasan AI dan rekomendasi OPD ketika ada lonjakan aduan serupa di satu wilayah agar bisa segera berkoordinasi.

#### Petugas OPD
- Sebagai petugas OPD, saya ingin melihat sub-tugas yang harus saya selesaikan beserta urutannya agar koordinasi dengan OPD lain tidak tumpang tindih.
- Sebagai petugas OPD, saya ingin mengunggah foto hasil pengerjaan agar penyelesaian bisa diverifikasi AI dan statusnya berubah di sistem.

#### Pimpinan Daerah / Bappeda
- Sebagai pimpinan, saya ingin melihat dashboard KPI (total aduan, rata-rata waktu penyelesaian, persentase terverifikasi), tren per kategori, sebaran per kecamatan, alert aktif, dan peringkat kinerja OPD agar dapat membuat keputusan berbasis data.

---

## 4. Detail Fitur dan Acceptance Criteria

### Fitur 1 — Simulator WhatsApp + Data Seed

**Deskripsi:** Antarmuka simulasi percakapan WhatsApp di web untuk mengirim aduan baru. Warga dapat mengirim teks, melampirkan foto (opsional), dan memilih lokasi (pilih desa/kecamatan dari dropdown atau pin di peta mini). Jika lokasi atau detail aduan kurang jelas, chatbot bertanya balik lewat flow Langflow sebelum aduan disimpan. Data seed berisi ±150 aduan dengan metadata lengkap untuk demo.

**Acceptance Criteria:**
- [ ] Pengguna dapat mengetik aduan teks di antarmuka simulasi dan menekan kirim.
- [ ] Pengguna dapat melampirkan foto (opsional) sebelum mengirim; foto tersimpan di Supabase Storage.
- [ ] Pengguna dapat memilih lokasi via dropdown desa/kecamatan atau pin di peta mini; koordinat tersimpan bersama aduan.
- [ ] Jika teks aduan tidak menyebutkan lokasi atau detail masalah yang cukup, flow Langflow menghasilkan pertanyaan lanjutan yang ditampilkan sebagai balasan chatbot.
- [ ] Aduan baru tersimpan ke tabel `complaints` di Supabase dengan status `pending` hanya setelah detail minimum terpenuhi.
- [ ] Data seed dapat dimuat ulang (reset) dari UI tanpa perlu akses database langsung.
- [ ] Data seed mencakup ±150 aduan di minimal 5 kecamatan, dengan minimal 5 kategori berbeda.
- [ ] Setiap aduan dalam data seed memiliki label kategori manual (`label_manual`) untuk mengukur akurasi triage.
- [ ] Data seed menyertakan lonjakan tersembunyi: ≥ 5 aduan dengan kategori "Kesehatan & Sanitasi" (slug `kesehatan_diare`) di satu desa dalam rentang 48 jam, sebaran timestamp realistis.

---

### Fitur 2 — Triage AI Explainable

**Deskripsi:** Setiap aduan masuk diproses oleh flow Langflow yang mengembalikan: kategori masalah, OPD tujuan, tingkat urgensi (1–5), estimasi dampak (rendah/sedang/tinggi), jalur penanganan (Quick fix / Bertahap / Butuh data), dan alasan keputusan dalam kalimat singkat.

**Acceptance Criteria:**
- [ ] Setiap aduan baru memicu panggilan ke flow triage Langflow secara otomatis.
- [ ] Hasil triage ditampilkan di kartu aduan: kategori, OPD, urgensi, dampak, jalur, dan alasan.
- [ ] Alasan triage ditampilkan dalam Bahasa Indonesia yang dapat dibaca warga.
- [ ] Operator dapat meng-override kategori, OPD, dan jalur hasil AI; setiap override dicatat di tabel `triage_overrides` dengan timestamp dan user.
- [ ] Jika Langflow timeout atau error, aduan tetap tersimpan dengan status `triage_failed` dan tidak crash UI.
- [ ] Hasil triage untuk data seed di-cache di database sehingga demo tidak bergantung pada Langflow real-time.
- [ ] Output divalidasi dengan skema Zod sebelum disimpan; jika invalid, masuk ke `triage_failed`.

---

### Fitur 3 — Clustering + Peta Hotspot

**Deskripsi:** Aduan dikelompokkan ke dalam cluster jika memenuhi tiga syarat sekaligus: kemiripan teks (cosine similarity embedding ≥ threshold), jarak koordinat ≤ 500 m, dan selisih waktu ≤ 14 hari. Peta menampilkan marker di koordinat asli setiap aduan, ditambah lapisan warna agregat per kecamatan yang merepresentasikan intensitas aduan aktif.

**Acceptance Criteria:**
- [ ] Aduan dimasukkan ke cluster yang sama hanya jika: (a) cosine similarity embedding ≥ threshold yang dapat dikonfigurasi, (b) jarak koordinat antar aduan ≤ 500 m, dan (c) selisih waktu ≤ 14 hari.
- [ ] Peta menampilkan marker individual di koordinat asli setiap aduan; warna marker mengikuti kategori.
- [ ] Peta menampilkan lapisan warna agregat per kecamatan (choropleth) berdasarkan jumlah aduan aktif.
- [ ] Klik marker individual menampilkan ringkasan aduan; klik area kecamatan menampilkan daftar cluster di kecamatan tersebut.
- [ ] Clustering dijalankan ulang setiap kali aduan baru masuk atau dipicu manual oleh operator.
- [ ] Peta memiliki loading state dan empty state jika belum ada data.

---

### Fitur 4 — AI Agent Koordinasi Lintas OPD

**Deskripsi:** Untuk aduan yang membutuhkan lebih dari satu OPD, flow Langflow menghasilkan rencana koordinasi: daftar sub-tugas, OPD penanggung jawab per sub-tugas, urutan, dan ketergantungan antar sub-tugas.

**Acceptance Criteria:**
- [ ] Operator dapat memicu "Buat Rencana Koordinasi" pada aduan yang sudah di-triage.
- [ ] Sistem menampilkan daftar sub-tugas dengan OPD penanggung jawab dan ketergantungan.
- [ ] Setiap sub-tugas dapat diperbarui statusnya oleh petugas OPD (belum mulai / proses / selesai).
- [ ] Rencana koordinasi disimpan di database dan bisa dilihat ulang tanpa memanggil Langflow lagi.
- [ ] Jika Langflow gagal, operator mendapat pesan error yang jelas; aduan tidak hilang.

---

### Fitur 5 — Verifikasi Penyelesaian

**Deskripsi:** Alur verifikasi terdiri dari empat tahap status: `in_progress` → `ai_verified` atau `needs_review` → menunggu konfirmasi warga → `closed`. Tiket hanya ditutup jika AI menyatakan terverifikasi **dan** warga mengonfirmasi. Jika warga menolak, tiket kembali ke `in_progress`.

**Acceptance Criteria:**
- [ ] Status aduan berubah ke `in_progress` saat petugas OPD mulai mengerjakan sub-tugas (bukan saat upload foto).
- [ ] Petugas OPD dapat mengunggah foto hasil pengerjaan dari halaman detail aduan ketika status `in_progress`; upload foto memicu flow verifikasi Langflow.
- [ ] Foto tersimpan di Supabase Storage; URL tersimpan di tabel `complaints`.
- [ ] Flow verifikasi Langflow mengembalikan: status verifikasi AI (`ai_verified` / `needs_review`) dan alasan singkat.
- [ ] Setelah AI memverifikasi, status berubah ke `ai_verified` dan notifikasi konfirmasi dikirim ke warga (simulasi).
- [ ] Jika AI mengembalikan `needs_review`, status tetap `needs_review`; operator mendapat notifikasi untuk tinjauan manual.
- [ ] Operator dapat meninjau tiket `needs_review` lalu: (a) menyetujuinya secara manual — status berlanjut ke konfirmasi warga dan persetujuan dicatat sebagai `manual_approval` — atau (b) mengembalikannya ke `in_progress` beserta catatan alasan.
- [ ] Warga (simulasi) dapat melihat foto sebelum/sesudah dan menekan "Konfirmasi Selesai" atau "Tolak".
- [ ] Jika warga mengonfirmasi, status berubah ke `closed`; tiket dianggap selesai.
- [ ] Jika warga menolak, status kembali ke `in_progress` beserta catatan alasan penolakan.
- [ ] Tiket tidak dapat berubah ke `closed` tanpa status `ai_verified` terlebih dahulu.
- [ ] Jika tidak ada foto "sebelum", verifikasi AI menilai foto "sesudah" berdasarkan deskripsi aduan.

---

### Fitur 6 — Early Warning Lonjakan Aduan

**Deskripsi:** Sistem mendeteksi lonjakan dengan membandingkan jumlah aduan 24 jam terakhir terhadap baseline 14 hari per kombinasi kategori × wilayah menggunakan z-score. Alert hanya terpicu jika jumlah aduan memenuhi batas minimum yang dapat dikonfigurasi. Setiap alert disertai ringkasan AI dan rekomendasi OPD dari flow Langflow.

**Acceptance Criteria:**
- [ ] Sistem memeriksa lonjakan setiap kali aduan baru masuk (atau secara berkala).
- [ ] Deteksi menggunakan z-score: z = (jumlah_24jam - mean_14hari) / std_14hari; alert terpicu jika z ≥ threshold_z (default: 2.0) DAN jumlah_24jam ≥ min_count (default: 3).
- [ ] `threshold_z` dan `min_count` dapat dikonfigurasi via environment variable.
- [ ] Untuk setiap alert yang terpicu, flow Langflow menghasilkan ringkasan situasi dan rekomendasi OPD yang relevan.
- [ ] Peringatan menampilkan: kategori masalah, wilayah (desa/kecamatan), jumlah aduan 24 jam vs baseline, z-score, ringkasan AI, rekomendasi OPD, dan tautan ke daftar aduan terkait.
- [ ] Peringatan yang sudah ditindaklanjuti dapat ditutup (dismiss) oleh operator; log dismiss tersimpan.

---

### Fitur 7 — Dashboard Pimpinan

**Deskripsi:** Halaman khusus untuk pimpinan daerah dan Bappeda yang menampilkan gambaran besar kinerja penanganan aduan, tanpa detail operasional per tiket.

**Acceptance Criteria:**
- [ ] Dashboard menampilkan KPI utama: total aduan (all-time dan 30 hari terakhir), rata-rata waktu penyelesaian (dari `pending` ke `closed` dalam jam), dan persentase aduan yang berstatus `closed`.
- [ ] Tersedia grafik tren aduan per kategori dalam rentang waktu yang dapat dipilih (7 hari / 30 hari / 90 hari).
- [ ] Tersedia visualisasi sebaran aduan per kecamatan (peta choropleth atau bar chart yang dapat dipilih).
- [ ] Daftar alert early warning aktif ditampilkan dengan ringkasan AI dan rekomendasi OPD masing-masing.
- [ ] Tersedia tabel peringkat kinerja OPD berdasarkan rata-rata waktu penyelesaian dan persentase tiket selesai.
- [ ] Semua visualisasi memiliki loading state dan empty state.
- [ ] Data dashboard di-query langsung dari database; tidak memanggil Langflow.

---

## 5. Skenario Demo End-to-End

Skenario ini dijalankan berurutan saat demo untuk menunjukkan seluruh alur sistem.

**Step 1 — Intake Aduan Baru**
Demonstrator membuka Simulator WhatsApp dan mengirim aduan: *"Pak, jalan di depan SD Negeri 1 Bantaran berlubang besar, sudah seminggu belum diperbaiki, berbahaya untuk anak sekolah."* Lokasi dipilih dari dropdown: Desa Bantaran, Kec. Bantaran. Chatbot tidak bertanya balik karena detail sudah cukup.

**Step 2 — Triage AI**
Sistem memproses aduan. Dalam < 10 detik, kartu aduan muncul dengan hasil triage: Kategori = Infrastruktur Jalan, OPD = Dinas PU, Urgensi = 4/5, Dampak = Tinggi, Jalur = **Bertahap** (memerlukan survei dan alokasi anggaran sebelum perbaikan fisik), Alasan = "Kerusakan jalan aktif di area sekolah; perbaikan membutuhkan survei dan penganggaran terlebih dahulu."

**Step 3 — Cluster dan Hotspot**
Demonstrator membuka halaman Peta Hotspot. Aduan baru bergabung ke cluster "Kerusakan Jalan — Kec. Bantaran" yang sudah berisi aduan serupa dari data seed (jarak ≤ 500 m, dalam 14 hari). Marker aduan baru muncul di koordinat aslinya; warna agregat kecamatan Bantaran menggelap.

**Step 4 — Early Warning Lonjakan Diare**
Di panel alert, peringatan muncul hasil deteksi z-score pada data seed: *"Lonjakan Kesehatan & Sanitasi — Sumberasih (6 aduan dalam 24 jam terakhir vs baseline 14 hari, z-score jauh di atas ambang 2.0)."* Alert menyertakan ringkasan AI: *"Terdapat lonjakan signifikan keluhan diare dan air keruh di Desa Sumberasih dalam 24 jam terakhir, kemungkinan terkait kualitas air bersih."* Rekomendasi: Dinas Kesehatan untuk investigasi lapangan, PDAM untuk cek kualitas air.

**Step 5 — Koordinasi Lintas OPD**
Operator membuka aduan jalan rusak dan menekan "Buat Rencana Koordinasi". AI menghasilkan: (1) Dinas PU — survei kerusakan, (2) BPKAD — alokasi anggaran darurat (bergantung #1), (3) Dinas PU — perbaikan fisik (bergantung #2).

**Step 6 — Verifikasi dan Konfirmasi Warga**
Petugas Dinas PU sudah menandai sub-tugas selesai (status tiket `in_progress`), lalu mengunggah foto hasil perbaikan. Upload foto memicu flow verifikasi Langflow: *"Permukaan jalan tampak telah diperbaiki. Tidak ada lubang terlihat dalam foto."* Status berubah ke `ai_verified`. Warga (simulasi) menerima notifikasi, melihat foto sebelum/sesudah, dan menekan "Konfirmasi Selesai". Status berubah ke `closed`.

**Step 7 — Dashboard Pimpinan**
Bu Rina membuka halaman Dashboard Pimpinan. Terlihat KPI: 151 total aduan, rata-rata waktu penyelesaian 38 jam, 12% tiket closed. Grafik tren menunjukkan lonjakan kategori Kesehatan dalam 48 jam. Alert lonjakan diare muncul di panel dengan rekomendasi OPD. Tabel kinerja OPD menunjukkan Dinas PU memiliki rata-rata penyelesaian tercepat.

---

## 6. Non-Functional Requirements

| Kategori | Requirement |
|----------|-------------|
| **Performa** | Halaman utama first load < 3 detik pada koneksi 4G stabil |
| **Ketersediaan** | Aplikasi tetap bisa diakses (read-only) saat Langflow tidak tersedia, menggunakan data cache |
| **Keamanan** | Tidak ada API key yang diekspos di frontend; semua secret di `.env.local` |
| **Aksesibilitas** | Teks UI dalam Bahasa Indonesia yang mudah dipahami; kontras warna minimal AA |
| **Skalabilitas** | Skema database mendukung pertambahan aduan tanpa migrasi ulang untuk fitur MVP |
| **Observabilitas** | Error dari Langflow di-log di server (tidak di frontend); status `triage_failed` bisa difilter di UI |
| **Typecheck** | TypeScript strict mode; tidak ada `any` |

---

## 7. Out of Scope

Fitur-fitur berikut **tidak dibangun** dalam versi ini:

- Social listening media sosial
- Transkripsi voice note bahasa daerah
- Kanal pelaporan anonim
- Akses via SMS / telepon
- Integrasi CCTV / IoT
- Estimasi waktu penyelesaian otomatis
- Sistem garansi kontraktor
- Pembuatan policy brief otomatis
- Input dari proses Musrenbang
- Indeks kepuasan warga
- Open data / API publik
- Mode bencana
- Multi-daerah dan integrasi SP4N-LAPOR!

---

## 8. Risiko dan Mitigasi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Langflow lambat atau tidak tersedia saat demo | Sedang | Tinggi | Hasil triage dan alert data seed di-cache di database; demo bisa berjalan offline dari cache |
| Akurasi triage AI rendah pada aduan ambigu | Sedang | Sedang | Operator dapat override kategori, OPD, dan jalur; override tercatat; alasan AI ditampilkan |
| Lonjakan diare tersembunyi tidak terpicu saat demo | Rendah | Tinggi | Deteksi z-score tetap dijalankan pada data seed saat demo; jika deteksi gagal, alert cadangan telah di-seed langsung ke tabel `alerts` sebagai fallback |
| Upload foto gagal di Supabase Storage | Rendah | Sedang | Tampilkan pesan error yang jelas; status aduan tidak berubah jika upload gagal |
| Clustering menghasilkan kelompok yang tidak koheren | Sedang | Rendah | Demo menggunakan data seed yang sudah dikurasi; threshold similarity, radius, dan jendela waktu dapat disetel |
| Warga menolak verifikasi sehingga tiket tidak pernah closed | Rendah | Rendah | Skenario demo menggunakan warga simulasi yang sudah dikontrol; alur tolak tetap diuji secara terpisah |
| Skenario demo tidak berjalan urut akibat bug | Sedang | Tinggi | Setiap fitur dapat didemonstrasikan secara independen; data seed mencakup semua state yang dibutuhkan |
