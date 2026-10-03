// Menghitung rata-rata dari daftar nilai (0–100).
// Daftar kosong → null (belum ada nilai sama sekali).
export function hitungRataRata(daftarNilai: number[]): number | null {
  if (daftarNilai.length === 0) {
    return null;
  }

  const total = daftarNilai.reduce((akum, nilai) => akum + nilai, 0);
  return Math.round((total / daftarNilai.length) * 100) / 100;
}

// Memformat rata-rata untuk tampilan: angka atau "–" kalau belum ada nilai.
export function tampilkanRataRata(rata: number | null): string {
  return rata === null ? "–" : String(rata);
}
