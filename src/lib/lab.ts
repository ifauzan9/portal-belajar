// ============================================================================
// Helper fitur Lab Coding (Tahap 17).
// ============================================================================

// Normalisasi keluaran untuk perbandingan otomatis:
// - samakan akhir baris (\r\n → \n)
// - buang spasi/tab di ujung tiap baris
// - buang baris kosong di awal & akhir
export function normalisasiKeluaran(teks: string): string {
  return teks
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((baris) => baris.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

export function keluaranCocok(hasil: string, diharapkan: string): boolean {
  return normalisasiKeluaran(hasil) === normalisasiKeluaran(diharapkan);
}

// Jumlah baris untuk tampilan ringkas.
export function jumlahBaris(teks: string): number {
  if (!teks) return 0;
  return teks.replace(/\r\n/g, "\n").split("\n").length;
}
