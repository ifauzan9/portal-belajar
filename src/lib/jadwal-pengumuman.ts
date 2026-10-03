// ============================================================================
// Helper: pengumuman terjadwal (waktu mulai tampil).
// Dipakai server action (validasi input) dan halaman server (filter tampil).
// ============================================================================

export type HasilParseWaktu =
  | { ok: true; iso: string | null }
  | { ok: false };

/**
 * Membaca nilai input `datetime-local` menjadi ISO string siap simpan.
 * - Kosong → { ok: true, iso: null } (langsung tampil).
 * - Valid  → { ok: true, iso }.
 * - Rusak  → { ok: false }.
 */
export function parseWaktuMulai(nilai: string): HasilParseWaktu {
  const teks = nilai.trim();
  if (!teks) return { ok: true, iso: null };

  const waktu = new Date(teks);
  if (Number.isNaN(waktu.getTime())) return { ok: false };

  return { ok: true, iso: waktu.toISOString() };
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

/** Format tanggal + jam (id-ID) untuk penanda jadwal di portal guru. */
export function formatJadwal(iso: string | null): string {
  if (!iso) return "-";
  const waktu = new Date(iso);
  if (Number.isNaN(waktu.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(waktu);
}

/**
 * Ubah ISO string → "YYYY-MM-DDTHH:mm" waktu lokal, untuk `defaultValue`
 * input `datetime-local` di form ubah.
 */
export function isoKeInputLokal(iso: string | null): string {
  if (!iso) return "";
  const waktu = new Date(iso);
  if (Number.isNaN(waktu.getTime())) return "";

  const dua = (angka: number) => String(angka).padStart(2, "0");
  const tanggal = `${waktu.getFullYear()}-${dua(waktu.getMonth() + 1)}-${dua(
    waktu.getDate(),
  )}`;
  const jam = `${dua(waktu.getHours())}:${dua(waktu.getMinutes())}`;
  return `${tanggal}T${jam}`;
}
