---
description: Cara Aduin mengelompokkan aduan dan mendeteksi lonjakan.
icon: chart-network
---

# Clustering dan early warning

Kedua algoritma berjalan di route handler Next.js dan SQL, **bukan** di Langflow. Langflow hanya menyediakan embedding dan ringkasan.

## Clustering

Aduan baru bergabung ke klaster yang ada jika ketiga syarat terpenuhi terhadap salah satu anggotanya:

| Syarat | Default | Env |
| --- | --- | --- |
| Cosine similarity embedding | ≥ 0,75 | `CLUSTER_SIMILARITY_THRESHOLD` |
| Jarak haversine | ≤ 500 m | `CLUSTER_RADIUS_METERS` |
| Selisih waktu lapor | ≤ 14 hari | `CLUSTER_WINDOW_DAYS` |

Kalau tidak ada yang cocok, klaster baru dibuat. Centroid klaster dihitung ulang setiap ada anggota baru.

```
function runClustering(newComplaint):
  for each candidate in aduan 14 hari terakhir (bukan closed):
    if cosine ≥ threshold AND jarak ≤ radius AND selisih ≤ window:
      gabung ke cluster kandidat; return
  buat cluster baru
```

Clustering berjalan otomatis setelah embedding dibuat, atau manual lewat **Hitung Ulang Cluster** di `/peta`.

## Early warning (z-score)

```
z = (count_24h − mean_14d) / std_14d
```

Alert terpicu jika `z ≥ ALERT_THRESHOLD_Z` (2,0) **dan** `count_24h ≥ ALERT_MIN_COUNT` (3).

Statistik dihitung fungsi Postgres `alert_window_stats` (migrasi `0004_early_warning.sql`):

* `count_24h`: aduan dalam 24 jam terakhir per kategori × wilayah.
* Baseline: tepat 14 jendela 24 jam berurutan sebelumnya. Hari tanpa aduan dihitung 0.
* `std_14d`: `STDDEV_POP` dengan batas bawah 1,0 agar z tidak meledak saat baseline nol.

{% hint style="info" %}
Pengecekan berjalan setelah setiap triase berhasil (hanya untuk kategori dan wilayah aduan itu), lewat tombol **Periksa Sekarang** di `/alert`, dan setelah timeline seed digeser.
{% endhint %}
