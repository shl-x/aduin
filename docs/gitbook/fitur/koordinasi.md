---
description: AI menyusun tugas lintas OPD beserta urutan dan ketergantungannya.
icon: diagram-project
---

# Rencana koordinasi OPD

**Halaman:** `/aduan/[id]` · **Peran:** Operator · **Flow AI:** `aduin-opd-agent`

Setelah triase berhasil, sistem otomatis membuat **Rencana Sederhana**: satu tugas untuk OPD tujuan. Petugas langsung bisa bekerja tanpa menunggu operator.

Untuk masalah yang butuh beberapa dinas, operator menekan **Buat Rencana Koordinasi**. AI menyusun sub-tugas berurutan dan menggantikan rencana sederhana secara atomik.

<figure><img src="../.gitbook/assets/rencana-koordinasi.jpg" alt="Rencana penanganan lintas OPD"><figcaption><p>DPU mengevaluasi kondisi jalan lebih dulu. BPKAD menyusun anggaran setelah tugas DPU selesai.</p></figcaption></figure>

## Aturan ketergantungan

* Tugas yang bergantung baru bisa dimulai setelah semua tugas yang ditunggunya selesai.
* Rencana tidak bisa diganti lagi setelah petugas OPD mulai mengerjakan tugas.
* Kalau `aduin-opd-agent` gagal, pesan error tampil di UI dan rencana sederhana tetap aktif.

## Dari sisi petugas OPD

Petugas melihat tugasnya di `/tugas`, dikelompokkan per status: **Belum mulai**, **Sedang dikerjakan**, **Selesai**. Tombol **Mulai Kerjakan** dan **Tandai Selesai** memperbarui status tugas.

<figure><img src="../.gitbook/assets/tugas-opd.jpg" alt="Halaman tugas petugas OPD"><figcaption><p>Daftar tugas untuk petugas DPU.</p></figcaption></figure>
