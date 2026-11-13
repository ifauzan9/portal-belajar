// ============================================================================
// Jenis soal yang benar-benar ada dalam sebuah ulangan.
//
// Dipakai untuk memutuskan kartu/badge nilai mana yang ditampilkan:
// ulangan berisi soal koding saja tidak perlu menampilkan "Nilai PG" dan
// "Nilai Esai" yang selalu 0.
// ============================================================================

export type JenisSoal = { pg: boolean; esai: boolean; kode: boolean };

export function jenisSoalTersedia(
  jenisList: string[] | null | undefined,
): JenisSoal {
  // null/undefined = query gagal / data belum ada → tampilkan semua demi
  // keamanan, supaya tidak ada nilai yang hilang dari tampilan.
  if (!jenisList) return { pg: true, esai: true, kode: true };

  const set = new Set(jenisList);
  return { pg: set.has("pg"), esai: set.has("esai"), kode: set.has("kode") };
}
