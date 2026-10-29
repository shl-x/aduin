---
description: Hasil evaluasi akurasi triase pada aduan held-out.
icon: bullseye
---

# Evaluasi triase

Triase dievaluasi pada **30 aduan held-out**, yaitu aduan baru yang tidak ada di data seed (`supabase/seed/eval/heldout.json`). Aduan ditulis dalam bahasa Indonesia informal, Jawa, dan Madura, mencakup ketujuh kategori, dan 5 di antaranya sengaja dibuat ambigu. Flow dipanggil **tanpa cache**.

| Ukuran | Hasil |
| --- | --- |
| Akurasi kategori total | **90%** (27/30) |
| Tanpa 5 kasus ambigu | **96%** (24/25) |
| Bahasa Jawa | **7/7** |
| Bahasa Madura | **7/7** |
| Bahasa Indonesia informal | 13/16 |

{% hint style="success" %}
Target PRD adalah ≥ 80%. Angka held-out dipakai sebagai acuan karena prompt disetel memakai data seed.
{% endhint %}

## Menjalankan ulang

Pastikan Langflow menyala dan `LANGFLOW_FLOW_TRIAGE_ID` benar, lalu:

```bash
npx tsx --env-file=.env.local supabase/seed/eval-triage.ts
```

Script tidak menulis ke database. Hasilnya berupa akurasi total, akurasi per kategori dan per bahasa, serta daftar aduan yang tidak cocok.
