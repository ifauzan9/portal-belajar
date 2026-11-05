// ============================================================================
// Menggabungkan nilai ulangan dari dua sumber:
//  - `exam_scores`      → nilai resmi (hasil input guru / sinkronisasi)
//  - `exam_submissions` → nilai otomatis saat siswa submit
//
// Nilai resmi selalu diutamakan. Nilai submission hanya dipakai untuk
// siswa yang belum punya baris di `exam_scores`. Ini membuat nilai
// otomatis tetap terlihat di halaman guru walaupun sinkronisasi ke
// `exam_scores` belum sempat berjalan (mis. izin service_role belum
// dijalankan di database).
// ============================================================================

export type NilaiResmiUlangan = {
  siswa_id: string;
  nilai: number;
};

export type NilaiSubmitUlangan = {
  siswa_id: string;
  nilai_total: number;
};

export function gabungNilaiUlangan(
  nilaiResmi: NilaiResmiUlangan[] | null | undefined,
  nilaiSubmit: NilaiSubmitUlangan[] | null | undefined,
): Map<string, number> {
  const hasil = new Map<string, number>();

  for (const baris of nilaiResmi ?? []) {
    hasil.set(baris.siswa_id, baris.nilai);
  }

  for (const baris of nilaiSubmit ?? []) {
    if (!hasil.has(baris.siswa_id)) {
      hasil.set(baris.siswa_id, baris.nilai_total);
    }
  }

  return hasil;
}
