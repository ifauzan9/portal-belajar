import type { SupabaseClient } from "@supabase/supabase-js";
import { jamWib } from "@/lib/waktu";

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

/** Cara guru mengelola buka/tutup login token (Tahap 45). */
export type TokenLoginMode = "otomatis" | "manual";

export type PengaturanSoal = {
  /** Siswa tidak bisa membuka/memulai soal ulangan. */
  tutupUlangan: boolean;
  /** Siswa tidak bisa membuka modul/level Lab Coding. */
  tutupLab: boolean;
  /** Saklar induk login siswa lewat token kelas (Tahap 43). */
  tokenLoginDibuka: boolean;
  /** Otomatis (tutup pukul 18.00) atau manual (guru yang menentukan). */
  tokenLoginMode: TokenLoginMode;
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
  tokenLoginMode: "otomatis",
  infoLogin: "",
  infoLoginAktif: true,
  pesan: PESAN_TUTUP_DEFAULT,
  siap: false,
};

type BarisPengaturan = {
  tutup_soal_ulangan: boolean | null;
  tutup_soal_lab: boolean | null;
  token_login_dibuka: boolean | null;
  token_login_mode: string | null;
  info_login_siswa: string | null;
  info_login_siswa_aktif: boolean | null;
  pesan_tutup: string | null;
};

function rapikanMode(nilai: string | null | undefined): TokenLoginMode {
  return nilai === "manual" ? "manual" : "otomatis";
}

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
  // 1) Skema terbaru (Tahap 41 + 43 + 44 + 45).
  const v45 = await supabase
    .from("pengaturan_guru")
    .select(
      "tutup_soal_ulangan, tutup_soal_lab, token_login_dibuka, token_login_mode, info_login_siswa, info_login_siswa_aktif, pesan_tutup",
    )
    .eq("id", 1)
    .maybeSingle();

  if (!v45.error) {
    if (!v45.data) {
      // Tabel ada tetapi baris id = 1 belum dibuat → semua default.
      return { ...defaultTerbuka, siap: true };
    }

    const baris = v45.data as unknown as BarisPengaturan;

    return {
      tutupUlangan: baris.tutup_soal_ulangan === true,
      tutupLab: baris.tutup_soal_lab === true,
      // null = kolom ada tapi baris lama belum diisi → anggap terbuka.
      tokenLoginDibuka: baris.token_login_dibuka !== false,
      tokenLoginMode: rapikanMode(baris.token_login_mode),
      infoLogin: rapikanInfo(baris.info_login_siswa),
      infoLoginAktif: baris.info_login_siswa_aktif !== false,
      pesan: rapikanPesan(baris.pesan_tutup),
      siap: true,
    };
  }

  // 2) Kolom Tahap 45 belum ada → baca skema Tahap 44.
  const v44 = await supabase
    .from("pengaturan_guru")
    .select(
      "tutup_soal_ulangan, tutup_soal_lab, token_login_dibuka, info_login_siswa, info_login_siswa_aktif, pesan_tutup",
    )
    .eq("id", 1)
    .maybeSingle();

  if (!v44.error) {
    if (!v44.data) {
      return { ...defaultTerbuka, siap: true };
    }

    const baris = v44.data as unknown as Omit<BarisPengaturan, "token_login_mode">;

    return {
      tutupUlangan: baris.tutup_soal_ulangan === true,
      tutupLab: baris.tutup_soal_lab === true,
      tokenLoginDibuka: baris.token_login_dibuka !== false,
      tokenLoginMode: "otomatis",
      infoLogin: rapikanInfo(baris.info_login_siswa),
      infoLoginAktif: baris.info_login_siswa_aktif !== false,
      pesan: rapikanPesan(baris.pesan_tutup),
      siap: true,
    };
  }

  // 3) Kolom Tahap 44 belum ada → baca kolom Tahap 43.
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
      "token_login_mode" | "info_login_siswa" | "info_login_siswa_aktif"
    >;

    return {
      tutupUlangan: baris.tutup_soal_ulangan === true,
      tutupLab: baris.tutup_soal_lab === true,
      tokenLoginDibuka: baris.token_login_dibuka !== false,
      tokenLoginMode: "otomatis",
      infoLogin: "",
      infoLoginAktif: true,
      pesan: rapikanPesan(baris.pesan_tutup),
      siap: true,
    };
  }

  // 4) Kolom Tahap 43 juga belum ada → baca kolom Tahap 41 saja.
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
    | "token_login_dibuka"
    | "token_login_mode"
    | "info_login_siswa"
    | "info_login_siswa_aktif"
  >;

  return {
    tutupUlangan: barisLama.tutup_soal_ulangan === true,
    tutupLab: barisLama.tutup_soal_lab === true,
    tokenLoginDibuka: true,
    tokenLoginMode: "otomatis",
    infoLogin: "",
    infoLoginAktif: true,
    pesan: rapikanPesan(barisLama.pesan_tutup),
    siap: true,
  };
}

// ============================================================================
// Batas jam & mode login token (Tahap 43 + 45).
//
// Mode otomatis hanya membuka token sampai pukul 18.00 WIB setiap hari.
// Mode manual mengabaikan jam: guru yang membuka/menutup lewat saklar.
// Hitungan jam memakai helper WIB supaya server (UTC) dan browser sama.
// ============================================================================

export const JAM_TUTUP_TOKEN_LOGIN = 18; // pukul 18.00 WIB

/**
 * Status akhir login token: saklar guru DAN aturan mode.
 * Dipakai di halaman login, halaman guru, dan Server Action.
 */
export function tokenLoginTerbuka(
  pengaturan: Pick<PengaturanSoal, "tokenLoginDibuka" | "tokenLoginMode">,
  sekarang: Date = new Date(),
): boolean {
  if (!pengaturan.tokenLoginDibuka) return false;
  if (pengaturan.tokenLoginMode === "manual") return true;
  return jamWib(sekarang) < JAM_TUTUP_TOKEN_LOGIN;
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
