import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Pengaturan global "tutup akses soal" (Tahap 41).
//
// Guru bisa menutup akses soal untuk semua siswa sekaligus dari
// /guru/pengaturan. Disimpan di tabel satu baris "pengaturan_guru" (id = 1).
//
// Dipakai di dua tempat:
//   - halaman siswa (banner + menonaktifkan tombol), dan
//   - Server Action (penjagaan sesungguhnya, supaya request langsung tetap
//     ditolak walau tombol di browser diakali).
//
// Kalau DDL Tahap 41 belum dijalankan, fungsi ini mengembalikan "semua
// terbuka" supaya aplikasi tetap berjalan seperti sebelumnya.
// ============================================================================

export const PESAN_TUTUP_DEFAULT =
  "Guru menutup akses soal untuk sementara. Coba lagi nanti atau tunggu informasi dari gurumu.";

export const MAKS_PESAN_TUTUP = 200;

export type PengaturanSoal = {
  /** Siswa tidak bisa membuka/memulai soal ulangan. */
  tutupUlangan: boolean;
  /** Siswa tidak bisa membuka modul/level Lab Coding. */
  tutupLab: boolean;
  /** Pesan yang ditampilkan ke siswa (sudah diisi default bila kosong). */
  pesan: string;
  /** false = tabel belum ada (DDL Tahap 41 belum dijalankan). */
  siap: boolean;
};

const defaultTerbuka: PengaturanSoal = {
  tutupUlangan: false,
  tutupLab: false,
  pesan: PESAN_TUTUP_DEFAULT,
  siap: false,
};

type BarisPengaturan = {
  tutup_soal_ulangan: boolean | null;
  tutup_soal_lab: boolean | null;
  pesan_tutup: string | null;
};

function rapikanPesan(nilai: string | null | undefined): string {
  const teks = String(nilai ?? "").trim();
  return teks ? teks.slice(0, MAKS_PESAN_TUTUP) : PESAN_TUTUP_DEFAULT;
}

/**
 * Baca pengaturan akses soal. Selalu aman dipanggil: bila tabel belum ada
 * (schema Tahap 41 belum dijalankan) hasilnya "semua terbuka".
 */
export async function ambilPengaturanSoal(
  supabase: SupabaseClient,
): Promise<PengaturanSoal> {
  const { data, error } = await supabase
    .from("pengaturan_guru")
    .select("tutup_soal_ulangan, tutup_soal_lab, pesan_tutup")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return defaultTerbuka;
  }

  const baris = data as unknown as BarisPengaturan;

  return {
    tutupUlangan: baris.tutup_soal_ulangan === true,
    tutupLab: baris.tutup_soal_lab === true,
    pesan: rapikanPesan(baris.pesan_tutup),
    siap: true,
  };
}

/** Soal ulangan boleh diakses = saklar global terbuka DAN ulangan dibuka. */
export function ulanganBolehDiakses(
  pengaturan: Pick<PengaturanSoal, "tutupUlangan">,
  dibukaUlangan: boolean,
): boolean {
  return !pengaturan.tutupUlangan && dibukaUlangan;
}

/**
 * Modul lab boleh diakses = saklar global terbuka DAN modul tidak ditutup
 * guru (kolom `coding_lessons.dibuka`, Tahap 42).
 */
export function labBolehDiakses(
  pengaturan: Pick<PengaturanSoal, "tutupLab">,
  dibukaModul: boolean,
): boolean {
  return !pengaturan.tutupLab && dibukaModul;
}
