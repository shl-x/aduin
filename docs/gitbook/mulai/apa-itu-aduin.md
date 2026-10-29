---
description: Masalah yang diselesaikan Aduin dan cara kerjanya.
icon: lightbulb
---

# Apa itu Aduin?

## Masalah

Banyak pemerintah daerah sudah punya kanal pengaduan berbasis WhatsApp, contohnya Halo Sae di Kabupaten Probolinggo. Kanal seperti ini **reaktif**: aduan diterima, dicatat, lalu diteruskan ke Organisasi Perangkat Daerah (OPD). Setelah itu:

* aduan tidak punya kategori dan prioritas yang konsisten, sehingga OPD yang tepat tidak selalu jelas;
* pekerjaan yang melibatkan beberapa OPD dikoordinasikan manual lewat chat atau telepon;
* tidak ada bukti bahwa masalah benar-benar selesai, dan warga tidak diminta konfirmasi;
* lonjakan masalah serupa di satu wilayah baru ketahuan setelah viral;
* pimpinan tidak punya data agregat untuk mengambil keputusan.

## Solusi: empat langkah U.R.U.S

| Langkah | Yang dilakukan Aduin |
| --- | --- |
| **U**rai aduan | AI memeriksa kelengkapan, bertanya balik bila kurang, lalu menentukan kategori, dinas, dan tingkat mendesak beserta alasannya. |
| **R**angkai pola | Aduan serupa yang berdekatan dikelompokkan di peta. Lonjakan di satu desa memicu peringatan dini. |
| **U**rutkan penanganan | AI menyusun tugas antardinas: siapa mengerjakan apa, dan tugas mana yang harus menunggu. |
| **S**ahkan penyelesaian | Foto sebelum dan sesudah dinilai AI. Aduan baru ditutup setelah warga mengonfirmasi. |

## Siapa penggunanya?

| Peran | Kebutuhan utama | Halaman |
| --- | --- | --- |
| Warga | Melapor semudah chat dan tahu kapan masalahnya beres | `/lapor` |
| Operator | Melihat semua aduan di satu antrian, mengoreksi AI, memicu koordinasi | `/dashboard`, `/peta`, `/alert` |
| Petugas OPD | Tahu tugas yang harus dikerjakan dan mengunggah bukti | `/tugas` |
| Pimpinan | Ringkasan kinerja daerah dan dinas | `/ringkasan` |

{% hint style="success" %}
Manusia tetap memegang keputusan akhir. Operator bisa mengoreksi hasil AI kapan saja, dan aduan hanya bisa ditutup oleh warga.
{% endhint %}
