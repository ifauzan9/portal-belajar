// ============================================================================
// Saklar "bagikan nilai" per ulangan (Tahap 48).
//
// `bagikan_nilai` adalah satu-satunya penentu apakah siswa boleh melihat
// angka nilai. Kolom lama `nilai_ditampilkan` / `nilai_selesai` tidak lagi
// dipakai sebagai gerbang tampilan.
//
// Nilai default (kolom null / belum ada / DDL belum dijalankan) = TIDAK
// dibagikan. Ini membuat kegagalan baca kolom tidak pernah membocorkan nilai.
// ============================================================================

export function nilaiDibagikan(
  ulangan: { bagikan_nilai?: boolean | null } | null | undefined,
): boolean {
  return ulangan?.bagikan_nilai === true;
}
