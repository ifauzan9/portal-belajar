// ============================================================================
// Helper: cek apakah tenggat waktu sudah lewat (deadline passed).
// Dipakai di halaman server yang menampilkan status ulangan bersoal.
// ============================================================================

/**
 * true jika `tenggat` (ISO string) sudah lewat dari waktu sekarang.
 * false jika `tenggat` null/empty atau belum lewat.
 */
export function tenggatSudahLewat(tenggat: string | null): boolean {
  if (!tenggat) return false;
  const target = new Date(tenggat).getTime();
  if (Number.isNaN(target)) return false;
  return target < new Date().getTime();
}
