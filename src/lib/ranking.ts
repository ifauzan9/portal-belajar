// ============================================================================
// Ranking nilai ulangan (competition ranking: 1, 2, 2, 4).
//
// Dipakai bersama oleh:
//  - halaman input nilai (ranking per kelas / semua kelas yang tampil)
//  - halaman ranking seluruh siswa (semua kelas)
//
// Siswa tanpa nilai tidak ikut ranking; mereka tetap mendapat entri
// `ranking: null` supaya komponen yang memetakan id siswa tidak error.
// ============================================================================

export type InfoRanking = {
  ranking: number | null;
  // Jumlah siswa dengan nilai yang sama (termasuk diri sendiri).
  // 1 berarti tidak ada yang seri.
  tiedWith: number;
};

export type SiswaPeringkat = {
  id: string;
  nama_siswa: string;
  nilai: number | null;
};

export function hitungRanking<T extends SiswaPeringkat>(
  daftar: T[],
): Map<string, InfoRanking> {
  const hasil = new Map<string, InfoRanking>();

  const dinilai = daftar
    .filter((s): s is T & { nilai: number } => s.nilai !== null)
    .sort((a, b) => {
      if (b.nilai - a.nilai !== 0) return b.nilai - a.nilai;
      return a.nama_siswa.localeCompare(b.nama_siswa, "id", {
        numeric: true,
        sensitivity: "base",
      });
    });

  let urutan = 0;
  for (let i = 0; i < dinilai.length; i++) {
    const s = dinilai[i];
    // Posisi berubah saat nilainya beda dari sebelumnya.
    if (i === 0 || s.nilai !== dinilai[i - 1].nilai) {
      urutan = i + 1;
    }
    // tiedWith = berapa banyak siswa dengan nilai sama.
    let tiedWith = 1;
    for (let j = i + 1; j < dinilai.length; j++) {
      if (dinilai[j].nilai === s.nilai) tiedWith++;
      else break;
    }
    hasil.set(s.id, { ranking: urutan, tiedWith });
  }

  // Sisanya (belum dinilai) tidak punya ranking.
  for (const s of daftar) {
    if (!hasil.has(s.id)) {
      hasil.set(s.id, { ranking: null, tiedWith: 0 });
    }
  }

  return hasil;
}
