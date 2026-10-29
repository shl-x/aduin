---
description: Bagaimana Aduin dikembangkan bersama IBM Bob sebagai agen pembangun.
icon: user-astronaut
---

# Dibangun bersama IBM Bob

Aduin dikembangkan bersama **IBM Bob** sebagai agen pembangun. Bob dikonfigurasi lewat beberapa file di repositori:

| File | Isi |
| --- | --- |
| `.bob/custom_modes.yaml` | Custom mode **Aduin Builder** (`aduin-builder`): engineer full-stack Next.js + Supabase + Langflow yang wajib membaca `AGENTS.md` dan semua `.bob/rules/` sebelum bekerja. |
| `AGENTS.md` | Konteks proyek, dokumen wajib baca, stack, dan aturan kerja: satu milestone per sesi, rencana sebelum kode, lalu build + lint, centang `docs/TASKS.md`, dan commit. |
| `.bob/rules/01-project.md` | Ringkasan proyek, persona, scope MVP, dan hal di luar scope. |
| `.bob/rules/02-coding-standards.md` | TypeScript strict tanpa `any`, shadcn/ui + Tailwind, teks UI Bahasa Indonesia, secret hanya di `.env.local`. |
| `.bob/rules/03-langflow.md` | Semua AI lewat `client.ts`, Flow ID dari env, validasi Zod, timeout + fallback. |
| `.bob/plans/` | Rencana kerja Bob, mis. migrasi model ke region Tokyo. |

## Pembagian kerja

`docs/TASKS.md` memisahkan setiap milestone (M0–M7) menjadi dua bagian:

* **Langflow (manual di UI)**: dikerjakan tim di Langflow.
* **Kode (Bob)**: dikerjakan agen pemrograman mengikuti aturan di atas, lengkap dengan Definition of Done.

Sebagian milestone (M3–M7) dikerjakan dengan bantuan Claude Code memakai aturan dan dokumen yang sama.
