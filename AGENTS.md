# Aduin — Konteks Proyek

Aduin adalah web app "otak analitik" di balik kanal pengaduan masyarakat pemerintah daerah. Dibuat untuk hackathon IBM.
Tagline: "Aduin aja, sisanya kami yang urus."

## Dokumen wajib dibaca
- docs/PRD.md — apa dan kenapa
- docs/ARCHITECTURE.md — stack dan skema
- docs/LANGFLOW_FLOWS.md — kontrak setiap flow AI
- docs/TASKS.md — checklist milestone

## Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres, pgvector, Storage, Auth)
- Semua AI dijalankan lewat Langflow (model IBM watsonx.ai Granite). Aplikasi TIDAK memanggil watsonx langsung.
- Peta: Leaflet + OpenStreetMap. Grafik: Recharts.

## Aturan kerja
- Kerjakan satu milestone per sesi, jangan keluar scope.
- Sebelum menulis kode, jelaskan rencana dan daftar file yang akan diubah.
- Setelah selesai: jalankan build dan lint, perbaiki error, centang docs/TASKS.md, buat commit.
- Kalau requirement ambigu, tanya dulu.