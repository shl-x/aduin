-- =============================================================================
-- Aduin — Storage bucket untuk foto aduan
-- File    : supabase/migrations/0002_storage.sql
-- Perintah: terapkan manual di Supabase SQL editor (sama seperti 0001_init.sql)
--
-- Dibutuhkan mulai M2 karena /lapor mengizinkan warga melampirkan foto saat
-- membuat aduan (photo_before_url). Kebijakan akses: public read (agar foto
-- bisa ditampilkan tanpa auth, dan agar Langflow bisa mengunduhnya langsung
-- di M5 aduin-verify), authenticated write.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('aduan-photos', 'aduan-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "aduan-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'aduan-photos');

CREATE POLICY "aduan-photos: authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'aduan-photos' AND auth.uid() IS NOT NULL);
