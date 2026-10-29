---
description: Daftar route handler Next.js di /api.
icon: code
---

# API routes

Semua route berada di `src/app/api/`. Autentikasi memakai sesi Supabase lewat cookie.

## Aduan dan triase

| Method + path | Peran | Fungsi |
| --- | --- | --- |
| `POST /api/complaints` | warga | Simpan aduan baru, jalankan klarifikasi dan pipeline triase |
| `POST /api/triage/[id]` | sistem, operator | Jalankan atau ulang triase AI |
| `POST /api/triage/[id]/override` | operator | Simpan koreksi triase |

## Koordinasi dan tugas

| Method + path | Peran | Fungsi |
| --- | --- | --- |
| `POST /api/coordination/[id]` | operator | Buat rencana koordinasi lintas OPD |
| `PATCH /api/tasks/[taskId]` | petugas_opd | Perbarui status sub-tugas |

## Verifikasi

| Method + path | Peran | Fungsi |
| --- | --- | --- |
| `POST /api/verify/[id]` | petugas_opd | Unggah foto bukti dan jalankan verifikasi AI |
| `POST /api/verify/[id]/review` | operator | Setujui atau kembalikan hasil `needs_review` |
| `POST /api/verify/[id]/confirm` | warga | Konfirmasi atau tolak penyelesaian |

## Peta dan peringatan

| Method + path | Peran | Fungsi |
| --- | --- | --- |
| `GET /api/cluster` | operator | Data klaster dan centroid untuk peta |
| `POST /api/cluster` | sistem, operator | Jalankan ulang clustering |
| `GET /api/alert` | operator, pimpinan | Daftar alert aktif |
| `POST /api/alert/check` | sistem, operator | Jalankan pengecekan z-score |
| `POST /api/alert/[alertId]/summary` | operator | Coba lagi ringkasan AI |
| `POST /api/alert/[alertId]/dismiss` | operator | Tutup alert |

## Analytics

| Method + path | Peran | Fungsi |
| --- | --- | --- |
| `GET /api/analytics/kpi` | pimpinan | Total aduan, rata-rata waktu, persentase selesai |
| `GET /api/analytics/trend` | pimpinan | Tren aduan per kategori |
| `GET /api/analytics/regions` | pimpinan | Sebaran per kecamatan |
| `GET /api/analytics/opd-ranking` | pimpinan | Peringkat kinerja OPD |

## Utilitas

| Method + path | Peran | Fungsi |
| --- | --- | --- |
| `GET /api/health` | publik | Cek kesehatan aplikasi |
| `POST /api/demo/login` | publik (mode demo) | Masuk sebagai akun demo |
| `POST /api/seed/reset` | operator (mode demo) | Reset Demo |
