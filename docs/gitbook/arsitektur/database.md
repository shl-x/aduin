---
description: Tabel utama di Supabase dan aturan Row Level Security per peran.
icon: database
---

# Database dan keamanan

## Tabel utama

| Tabel | Isi |
| --- | --- |
| `regions` | Kecamatan dan desa |
| `opd` | Daftar dinas (DPU, Dinkes, DLH, PDAM, Disdik, Satpol, BPKAD) |
| `complaints` | Aduan, status, serta kategori dan OPD efektif |
| `complaint_embeddings` | Vektor 768 dimensi (pgvector) |
| `clusters` | Klaster aduan dan centroidnya |
| `triage_results` | Hasil triase AI |
| `triage_overrides` | Koreksi operator atas hasil AI |
| `coordination_plans`, `tasks`, `task_dependencies` | Rencana penanganan dan sub-tugas antardinas |
| `verifications` | Foto bukti dan hasil verifikasi AI |
| `citizen_confirmations` | Konfirmasi atau penolakan warga |
| `alerts`, `alert_dismissals` | Peringatan dini dan penutupannya |
| `ai_cache` | Cache hasil flow Langflow |
| `profiles` | Peran pengguna dan OPD-nya |

## Peran

| Peran | Akses |
| --- | --- |
| `warga` | Membaca aduan milik sendiri dan mengirim aduan baru |
| `operator` | Membaca semua aduan, mengoreksi triase, menutup alert |
| `petugas_opd` | Membaca aduan di OPD-nya, memperbarui tugas, mengunggah foto |
| `pimpinan` | Read-only semua data, akses analytics |

## Row Level Security (ringkas)

| Tabel | Warga | Operator | Petugas OPD | Pimpinan |
| --- | --- | --- | --- | --- |
| `complaints` | Milik sendiri; INSERT | Semua; UPDATE status | Aduan di OPD-nya | Semua (read-only) |
| `triage_overrides` | — | INSERT; semua | — | Semua |
| `tasks` | — | Semua | SELECT + UPDATE (OPD-nya) | Semua |
| `verifications` | Milik sendiri | Semua; UPDATE (review) | INSERT; OPD-nya | Semua |
| `citizen_confirmations` | INSERT (milik sendiri) | Semua | — | Semua |
| `alerts` | — | Semua | — | Semua |

RLS memakai `auth.uid()` yang di-join ke `profiles.role` dan `profiles.opd_id`. Skema lengkap ada di `docs/ARCHITECTURE.md` dan `supabase/migrations/`.
