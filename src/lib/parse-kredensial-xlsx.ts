import { readSheet } from "read-excel-file/node";

// ============================================================================
// Parser kredensial siswa dari file Excel (.xlsx).
//
// Format file (baris 1 = judul, data mulai baris 2):
//   | NIS | Kelas | Username | Password |
//
// NIS dipakai sebagai kunci ke tabel students. Kolom Kelas dipakai untuk
// validasi opsional: kalau diisi, harus cocok dengan kelas siswa di DB.
// Username wajib unik global (tidak boleh dipakai siswa lain).
// Password minimal 6 karakter.
// ============================================================================

export type BarisImportKredensial = {
  nomor: number;
  nis: string;
  kelas: string;
  username: string;
  password: string;
  siswaId: string | null;
  status: "ok" | "dilewati";
  alasan: string;
};

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_ROWS = 1000;

type SiswaReferensi = { id: string; nis: string | null; kelas_id: string | null };
type KelasReferensi = { id: string; nama_kelas: string };
type UsernameTerpakai = { username: string; siswa_id: string };

function teks(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "";
  return String(nilai).trim();
}

// Baca buffer .xlsx menjadi array baris mentah.
export async function parseKredensialXlsx(
  buffer: Buffer,
  daftarSiswa: SiswaReferensi[],
  daftarKelas: KelasReferensi[],
  usernameTerpakai: UsernameTerpakai[],
): Promise<{ rows: BarisImportKredensial[]; error: string | null }> {
  let data;
  try {
    data = await readSheet(buffer);
  } catch {
    return {
      rows: [],
      error: "File tidak bisa dibaca. Pastikan file berformat .xlsx.",
    };
  }
  return olahBaris(data, daftarSiswa, daftarKelas, usernameTerpakai);
}

// Olah baris (array) menjadi daftar baris import. Dipisah dari pembacaan
// file supaya mudah diuji.
export function olahBaris(
  data: unknown[][],
  daftarSiswa: SiswaReferensi[],
  daftarKelas: KelasReferensi[],
  usernameTerpakai: UsernameTerpakai[],
): { rows: BarisImportKredensial[]; error: string | null } {
  const baris = data.slice(1); // lewati judul

  if (baris.length > MAX_ROWS) {
    return {
      rows: [],
      error: `Terlalu banyak baris (${baris.length}). Maksimal ${MAX_ROWS} baris per file.`,
    };
  }

  const nisMap = new Map<string, SiswaReferensi>();
  for (const s of daftarSiswa) {
    if (s.nis) nisMap.set(s.nis, s);
  }

  const kelasMap = new Map(
    daftarKelas.map((kelas) => [kelas.nama_kelas.trim().toLowerCase(), kelas.id]),
  );

  // Username yang sudah dipakai (per siswa_id).
  const usernamePerSiswa = new Map<string, string>();
  for (const u of usernameTerpakai) {
    usernamePerSiswa.set(u.siswa_id, u.username.toLowerCase());
  }

  const nisTerpakaiDiFile = new Set<string>();
  const usernameTerpakaiDiFile = new Map<string, string>();
  const rows: BarisImportKredensial[] = [];

  baris.forEach((row, index) => {
    const nis = teks(row[0]);
    const kelas = teks(row[1]);
    const username = teks(row[2]);
    const password = teks(row[3]);
    const nomor = index + 2;

    // Baris kosong: abaikan.
    if (!nis && !kelas && !username && !password) return;

    // --- Validasi NIS ---
    if (!nis) {
      rows.push({
        nomor, nis: "", kelas, username, password,
        siswaId: null, status: "dilewati", alasan: "NIS kosong",
      });
      return;
    }

    const siswa = nisMap.get(nis);
    if (!siswa) {
      rows.push({
        nomor, nis, kelas, username, password,
        siswaId: null, status: "dilewati", alasan: "NIS tidak terdaftar",
      });
      return;
    }

    if (nisTerpakaiDiFile.has(nis)) {
      rows.push({
        nomor, nis, kelas, username, password,
        siswaId: siswa.id, status: "dilewati", alasan: "NIS ganda di dalam file",
      });
      return;
    }

    // --- Validasi Kelas (opsional) ---
    const alasanDefault = kelas ? `Kelas "${kelas}" terverifikasi` : "Siap";
    if (kelas) {
      const kelasId = kelasMap.get(kelas.toLowerCase());
      if (!kelasId) {
        rows.push({
          nomor, nis, kelas, username, password,
          siswaId: siswa.id, status: "dilewati",
          alasan: `Kelas "${kelas}" tidak ada di data kelas`,
        });
        return;
      }
      if (siswa.kelas_id && siswa.kelas_id !== kelasId) {
        const namaKelasSiswa =
          daftarKelas.find((k) => k.id === siswa.kelas_id)?.nama_kelas ?? "?";
        rows.push({
          nomor, nis, kelas, username, password,
          siswaId: siswa.id, status: "dilewati",
          alasan: `Siswa terdaftar di kelas ${namaKelasSiswa}, bukan ${kelas}`,
        });
        return;
      }
    }

    // --- Validasi Username ---
    if (!username) {
      rows.push({
        nomor, nis, kelas, username: "", password,
        siswaId: siswa.id, status: "dilewati", alasan: "Username kosong",
      });
      return;
    }

    if (username.length < 3 || username.length > 50) {
      rows.push({
        nomor, nis, kelas, username, password,
        siswaId: siswa.id, status: "dilewati",
        alasan: "Username harus 3–50 karakter",
      });
      return;
    }

    const usernameNorm = username.toLowerCase();
    const existing = usernamePerSiswa.get(siswa.id);
    if (existing && existing !== usernameNorm) {
      // Siswa ini sudah punya username lain — boleh update.
    }
    if (usernameTerpakaiDiFile.has(usernameNorm)) {
      const pemilik = usernameTerpakaiDiFile.get(usernameNorm)!;
      if (pemilik !== siswa.id) {
        rows.push({
          nomor, nis, kelas, username, password,
          siswaId: siswa.id, status: "dilewati",
          alasan: "Username sudah dipakai siswa lain di dalam file",
        });
        return;
      }
    }

    // --- Validasi Password ---
    if (!password) {
      rows.push({
        nomor, nis, kelas, username, password: "",
        siswaId: siswa.id, status: "dilewati", alasan: "Password kosong",
      });
      return;
    }

    if (password.length < 6) {
      rows.push({
        nomor, nis, kelas, username, password,
        siswaId: siswa.id, status: "dilewati",
        alasan: "Password minimal 6 karakter",
      });
      return;
    }

    nisTerpakaiDiFile.add(nis);
    usernameTerpakaiDiFile.set(usernameNorm, siswa.id);
    rows.push({
      nomor, nis, kelas, username, password,
      siswaId: siswa.id, status: "ok", alasan: alasanDefault,
    });
  });

  if (rows.length === 0) {
    return { rows: [], error: "Tidak ada data kredensial yang ditemukan di file." };
  }

  return { rows, error: null };
}
