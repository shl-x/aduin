---
description: AI membandingkan foto sebelum dan sesudah sebelum aduan dianggap selesai.
icon: camera
---

# Verifikasi foto

**Halaman:** `/tugas`, `/aduan/[id]` · **Peran:** Petugas OPD, Operator, Warga · **Flow AI:** `aduin-verify`

Setelah semua tugas selesai, petugas mengunggah **foto bukti penyelesaian**. Model vision membandingkannya dengan foto dari warga.

<figure><img src="../.gitbook/assets/verifikasi-foto.jpg" alt="Verifikasi penyelesaian"><figcaption><p>Foto sebelum dan sesudah, dengan hasil AI "Terverifikasi".</p></figcaption></figure>

## Hasil yang mungkin

| Hasil AI | Artinya | Langkah berikutnya |
| --- | --- | --- |
| **Terverifikasi** (`ai_verified`) | Masalah terlihat sudah diperbaiki | Warga diminta konfirmasi |
| **Perlu ditinjau** (`needs_review`) | AI ragu, atau verifikasi gagal | Operator menyetujui atau mengembalikan dengan catatan |

## Konfirmasi warga

Aduan baru berstatus **Selesai** setelah warga memilih **Ya, sudah beres**. Kalau warga memilih **Belum beres**, aduan kembali ke tahap dikerjakan dinas.

{% hint style="success" %}
Dengan dua lapis pemeriksaan ini, AI lalu warga, status "selesai" di Aduin benar-benar bisa dipercaya.
{% endhint %}
