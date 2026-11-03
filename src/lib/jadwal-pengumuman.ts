// ============================================================================
// Helper: pengumuman terjadwal (waktu mulai tampil).
// Dipakai server action (validasi input) dan halaman server (filter tampil).
// ============================================================================

import { parseInputLokalWib } from "@/lib/waktu";

export type HasilParseWaktu =
  | { ok: true; iso: string | null }
  | { ok: false };

/**
 * Membaca nilai input `datetime-local` (jam WIB) menjadi ISO string siap simpan.
 * - Kosong → { ok: true, iso: null } (langsung tampil).
 * - Valid  → { ok: true, iso }.
 * - Rusak  → { ok: false }.
 */
export function parseWaktuMulai(nilai: string): HasilParseWaktu {
  const teks = nilai.trim();
  if (!teks) return { ok: true, iso: null };

  const iso = parseInputLokalWib(teks);
  if (!iso) return { ok: false };

  return { ok: true, iso };
}

/**
 * true jika pengumuman sudah boleh tampil untuk siswa.
 * null/rusak → true (fail-open, supaya pengumuman tidak hilang).
 */
export function sudahTampil(
  mulaiPada: string | null,
  sekarang: Date = new Date(),
): boolean {
  if (!mulaiPada) return true;
  const target = new Date(mulaiPada).getTime();
  if (Number.isNaN(target)) return true;
  return target <= sekarang.getTime();
}
