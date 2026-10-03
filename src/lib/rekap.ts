// ============================================================================
// Helper halaman Rekap Siswa (Tahap 21).
// ============================================================================

// Sebuah kegiatan relevan untuk siswa kalau target kelasnya kosong
// (artinya "semua kelas") atau memuat kelas siswa.
export function relevansiKelas(
  daftarKelasId: string[],
  kelasIdSiswa: string | null,
): boolean {
  if (daftarKelasId.length === 0) return true;
  if (!kelasIdSiswa) return false;
  return daftarKelasId.includes(kelasIdSiswa);
}

// Ringkasan angka untuk satu siswa di halaman daftar.
export type RingkasanKegiatan = {
  tugasSelesai: number;
  tugasTotal: number;
  ulanganSelesai: number;
  ulanganTotal: number;
  labCodingSelesai: number;
  labCodingTotal: number;
  labKomputerSelesai: number;
  labKomputerTotal: number;
};
