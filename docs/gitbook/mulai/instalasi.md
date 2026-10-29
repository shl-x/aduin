---
description: Jalankan Aduin di komputer sendiri.
icon: rocket
---

# Instalasi cepat

## Prasyarat

| Kebutuhan | Keterangan |
| --- | --- |
| Node.js 20+ dan npm | Untuk Next.js 16 |
| Proyek Supabase | Postgres dengan ekstensi `vector` |
| Python 3.10+ dan Langflow 1.12 | `pip install langflow` lalu `langflow run` (port 7860), atau Docker |
| Akun IBM watsonx.ai | API key dan Project ID dengan akses region Tokyo (`jp-tok`) |

## Langkah-langkah

{% stepper %}
{% step %}
### Siapkan Supabase

Buat proyek Supabase, lalu catat URL, anon key, dan service role key (Project Settings → API). Terapkan migrasi **berurutan** di SQL Editor atau dengan `supabase db push`:

| File | Isi |
| --- | --- |
| `supabase/migrations/0001_init.sql` | Semua tabel, pgvector, RLS, trigger profil |
| `supabase/migrations/0002_storage.sql` | Bucket `aduan-photos` (publik baca, login tulis) |
| `supabase/migrations/0003_coordination_rpc.sql` | `replace_coordination_plan` untuk mengganti rencana OPD secara atomik |
| `supabase/migrations/0004_early_warning.sql` | `alert_window_stats` (z-score) dan `shift_seed_timeline` |
{% endstep %}

{% step %}
### Siapkan Langflow

1. Jalankan `langflow run`, lalu buka `http://localhost:7860`.
2. Di **Settings → Global Variables**, buat `WATSONX_API_KEY` (tipe Credential) dan `WATSONX_PROJECT_ID` (tipe Generic).
3. Import enam flow dari folder `langflow/flows/` (New Flow → Import).
4. Pilih ulang kredensial di setiap komponen IBM watsonx.ai, karena Global Variables tidak ikut ter-export. Pastikan endpoint-nya `https://jp-tok.ml.cloud.ibm.com`.
5. Buat API key Langflow dan catat **Flow ID** tiap flow (UUID di URL editor flow).

{% hint style="warning" %}
Import membuat UUID baru. Selalu ambil Flow ID dari Langflow milikmu sendiri.
{% endhint %}
{% endstep %}

{% step %}
### Isi `.env.local`

Salin `.env.example` menjadi `.env.local`, lalu isi nilainya. Daftar lengkapnya ada di [Konfigurasi .env](konfigurasi.md).
{% endstep %}

{% step %}
### Instal dan isi data demo

```bash
npm install
npx tsx --env-file=.env.local supabase/seed/index.ts
npm run dev
```

Buka `http://localhost:3000`. Seed membuat 5 kecamatan, 7 OPD, 6 akun demo, dan ±150 aduan lengkap dengan hasil AI dari snapshot, **tanpa memanggil Langflow**.
{% endstep %}
{% endstepper %}

## Perintah pengembangan

```bash
npm run dev     # server pengembangan
npm run build   # build produksi (termasuk cek TypeScript)
npm run lint    # ESLint
```

{% hint style="danger" %}
`supabase/seed/index.ts` menghapus semua aduan, alert, dan cluster sebelum membangun ulang. Akun demo tidak dihapus.
{% endhint %}
