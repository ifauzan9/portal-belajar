// ============================================================================
// Helper menggabungkan kelas ulangan dari dua sumber:
//  - `exams.kelas_id` (kolom lama, 1 kelas)
//  - `exam_classes` (relasi baru, banyak kelas)
//
// Hasil: daftar id kelas unik. `[]` = "semua kelas".
// ============================================================================

type BarisUlanganKelas = {
  // Kolom lama (mungkin null)
  kelas_id?: string | null;
  // Relasi baru (mungkin null / belum ada)
  exam_classes?: { kelas_id: string }[] | null;
};

/**
 * Mengambil daftar id kelas untuk sebuah ulangan dari kedua sumber.
 * - Jika `exam_classes` ada isi → pakai daftar itu (sumber utama).
 * - Jika `exam_classes` kosong → fallback ke `kelas_id` lama (jika ada).
 * - Keduanya kosong → `[]` (= berlaku untuk semua kelas).
 */
export function ambilKelasUlangan(row: BarisUlanganKelas): string[] {
  const relasi = row.exam_classes?.map((h) => h.kelas_id) ?? [];

  // Dedup sambil menjaga urutan (relasi dulu, baru legacy).
  const hasil: string[] = [];
  for (const id of relasi) {
    if (id && !hasil.includes(id)) hasil.push(id);
  }

  if (hasil.length > 0) {
    return hasil;
  }

  // Fallback ke kolom lama.
  if (row.kelas_id && !hasil.includes(row.kelas_id)) {
    hasil.push(row.kelas_id);
  }

  return hasil;
}

/**
 * Nama-nama kelas dari daftar id, pakai map id → nama.
 * Id yang tidak ditemukan → "Kelas tak ditemukan".
 */
export function namaKelasDariIds(
  daftarId: string[],
  mapIdKeNama: Map<string, string>,
): string[] {
  return daftarId.map((id) => mapIdKeNama.get(id) ?? "Kelas tak ditemukan");
}
