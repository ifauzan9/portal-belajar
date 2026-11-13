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

/** Batas panjang informasi bebas di halaman login siswa (Tahap 44). */
export const MAKS_INFO_LOGIN = 400;

export type PengaturanSoal = {
  /** Siswa tidak bisa membuka/memulai soal ulangan. */
  tutupUlangan: boolean;
  /** Siswa tidak bisa membuka modul/level Lab Coding. */
  tutupLab: boolean;
  /** Saklar induk login siswa lewat token kelas (Tahap 43). */
  tokenLoginDibuka: boolean;
  /** Informasi bebas dari guru untuk halaman login siswa ("" = kosong). */
  infoLogin: string;
  /** Saklar tampil/sembunyi informasi login tanpa menghapus teksnya. */
  infoLoginAktif: boolean;
  /** Pesan yang ditampilkan ke siswa (sudah diisi default bila kosong). */
  pesan: string;
  /** false = tabel belum ada (DDL Tahap 41 belum dijalankan). */
  siap: boolean;
};

const defaultTerbuka: PengaturanSoal = {
  tutupUlangan: false,
  tutupLab: false,
  tokenLoginDibuka: true,
  infoLogin: "",
  infoLoginAktif: true,
  pesan: PESAN_TUTUP_DEFAULT,
  siap: false,
};

type BarisPengaturan = {
  tutup_soal_ulangan: boolean | null;
  tutup_soal_lab: boolean | null;
  token_login_dibuka: boolean | null;
  info_login_siswa: string | null;
  info_login_siswa_aktif: boolean | null;
  pesan_tutup: string | null;
};

function rapikanPesan(nilai: string | null | undefined): string {
  const teks = String(nilai ?? "").trim();
  return teks ? teks.slice(0, MAKS_PESAN_TUTUP) : PESAN_TUTUP_DEFAULT;
}

function rapikanInfo(nilai: string | null | undefined): string {
  return String(nilai ?? "").trim().slice(0, MAKS_INFO_LOGIN);
}

/**
 * Baca pengaturan akses soal. Selalu aman dipanggil: bila tabel belum ada
 * (schema Tahap 41 belum dijalankan) hasilnya "semua terbuka".
 *
 * Kolom dari tahap yang lebih baru dibaca dengan fallback bertingkat supaya
 * aplikasi tetap jalan walau DDL Tahap 43/44 belum dijalankan.
 */
export async function ambilPengaturanSoal(
  supabase: SupabaseClient,
): Promise<PengaturanSoal> {
  // 1) Skema terbaru (Tahap 41 + 43 + 44).
  const lengkap = await supabase
    .from("pengaturan_guru")
    .select(
      "tutup_soal_ulangan, tutup_soal_lab, token_login_dibuka, info_login_siswa, info_login_siswa_aktif, pesan_tutup",
    )
    .eq("id", 1)
    .maybeSingle();

  if (!lengkap.error) {
    if (!lengkap.data) {
      // Tabel ada tetapi baris id = 1 belum dibuat → semua default.
      return { ...defaultTerbuka, siap: true };
    }

    const baris = lengkap.data as unknown as BarisPengaturan;

    return {
      tutupUlangan: baris.tutup_soal_ulangan === true,
      tutupLab: baris.tutup_soal_lab === true,
      // null = kolom ada tapi baris lama belum diisi → anggap terbuka.
      tokenLoginDibuka: baris.token_login_dibuka !== false,
      infoLogin: rapikanInfo(baris.info_login_siswa),
      infoLoginAktif: baris.info_login_siswa_aktif !== false,
      pesan: rapikanPesan(baris.pesan_tutup),
      siap: true,
    };
  }

  // 2) Kolom Tahap 44 belum ada → baca kolom Tahap 43.
  const tahap43 = await supabase
    .from("pengaturan_guru")
    .select("tutup_soal_ulangan, tutup_soal_lab, token_login_dibuka, pesan_tutup")
    .eq("id", 1)
    .maybeSingle();

  if (!tahap43.error) {
    if (!tahap43.data) {
      return { ...defaultTerbuka, siap: true };
    }

    const baris = tahap43.data as unknown as Omit<
      BarisPengaturan,
      "info_login_siswa" | "info_login_siswa_aktif"
    >;

    return {
      tutupUlangan: baris.tutup_soal_ulangan === true,
      tutupLab: baris.tutup_soal_lab === true,
      tokenLoginDibuka: baris.token_login_dibuka !== false,
      infoLogin: "",
      infoLoginAktif: true,
      pesan: rapikanPesan(baris.pesan_tutup),
      siap: true,
    };
  }

  // 3) Kolom Tahap 43 juga belum ada → baca kolom Tahap 41 saja.
  const tahap41 = await supabase
    .from("pengaturan_guru")
    .select("tutup_soal_ulangan, tutup_soal_lab, pesan_tutup")
    .eq("id", 1)
    .maybeSingle();

  if (tahap41.error || !tahap41.data) {
    return defaultTerbuka;
  }

  const barisLama = tahap41.data as unknown as Omit<
    BarisPengaturan,
    "token_login_dibuka" | "info_login_siswa" | "info_login_siswa_aktif"
  >;

  return {
    tutupUlangan: barisLama.tutup_soal_ulangan === true,
    tutupLab: barisLama.tutup_soal_lab === true,
    tokenLoginDibuka: true,
    infoLogin: "",
    infoLoginAktif: true,
    pesan: rapikanPesan(barisLama.pesan_tutup),
    siap: true,
  };
}

// ============================================================================
// Batas jam login token (Tahap 43).
//
// Login token hanya dibuka sampai pukul 18.00 WIB setiap hari. Hitungan jam
// memakai helper WIB supaya server (UTC) dan browser memberi hasil sama.
// ============================================================================

export const JAM_TUTUP_TOKEN_LOGIN = 18; // pukul 18.00 WIB

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
