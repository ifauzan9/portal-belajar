// ============================================================================
// Kuota harian sederhana (in-memory).
//
// Dipakai untuk membatasi jumlah ganti password siswa (3x per hari).
// Jendela dihitung per tanggal lokal Asia/Jakarta, jadi hitungan reset saat
// tengah malam WIB.
//
// Batasan (sama seperti src/lib/rate-limit.ts):
//  - Hanya hidup selama proses server berjalan; hilang saat restart.
//  - Di Vercel/serverless tiap instance punya penghitung sendiri, jadi siswa
//    yang berpindah instance bisa mendapat kuota tambahan.
//  - Cukup untuk mencegah spam tidak sengaja, bukan benteng keamanan penuh.
//
// Kalau nanti butuh akurat lintas instance, pindahkan hitungan ke tabel
// database (mis. kolom password_diubah_terakhir / tabel kuota_harian).
// ============================================================================

import { tanggalWibDariDate } from "@/lib/waktu";

type Catatan = {
  tanggal: string; // "YYYY-MM-DD" menurut zona Asia/Jakarta
  terpakai: number;
};

const peta = new Map<string, Catatan>();

// Format tanggal "YYYY-MM-DD" di zona Asia/Jakarta tanpa bergantung pada
// locale mesin server.
function tanggalHariIni(sekarang: Date): string {
  return tanggalWibDariDate(sekarang);
}

export type HasilKuota = {
  boleh: boolean;
  terpakai: number;
  sisa: number;
  maks: number;
};

// Baca kuota yang tersisa tanpa menambah hitungan.
export function cekKuota(
  kunci: string,
  maks: number,
  sekarang = new Date(),
): HasilKuota {
  const tanggal = tanggalHariIni(sekarang);
  const catatan = peta.get(kunci);

  // Catatan dari hari lain dianggap kosong (reset harian).
  const terpakai = catatan && catatan.tanggal === tanggal ? catatan.terpakai : 0;
  const sisa = Math.max(0, maks - terpakai);

  return { boleh: sisa > 0, terpakai, sisa, maks };
}

// Pakai satu kuota. Hanya dipanggil setelah aksi sukses.
export function pakaiKuota(
  kunci: string,
  maks: number,
  sekarang = new Date(),
): HasilKuota {
  const tanggal = tanggalHariIni(sekarang);
  const catatan = peta.get(kunci);
  const terpakaiSebelumnya =
    catatan && catatan.tanggal === tanggal ? catatan.terpakai : 0;

  if (terpakaiSebelumnya >= maks) {
    return {
      boleh: false,
      terpakai: terpakaiSebelumnya,
      sisa: 0,
      maks,
    };
  }

  const terpakai = terpakaiSebelumnya + 1;
  peta.set(kunci, { tanggal, terpakai });

  return { boleh: true, terpakai, sisa: Math.max(0, maks - terpakai), maks };
}
