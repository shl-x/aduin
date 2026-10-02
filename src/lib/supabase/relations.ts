/**
 * src/lib/supabase/relations.ts
 *
 * Helper untuk relasi embedded PostgREST/Supabase.
 *
 * Bentuk relasi embedded bergantung pada skema: relasi one-to-many
 * dikembalikan sebagai array, tetapi jika FK di tabel anak bersifat UNIQUE
 * (mis. alert_dismissals.alert_id) PostgREST menganggapnya one-to-one dan
 * mengembalikan objek tunggal atau null. Normalkan dulu sebelum memakai
 * method array (.length, .some, .map, …).
 */

/** Array tetap array, objek menjadi [objek], null/undefined menjadi []. */
export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
