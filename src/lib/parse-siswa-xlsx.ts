import { readSheet } from "read-excel-file/node";

export type BarisImport = {
  nomor: number;
  nis: string;
  nama: string;
  kelas: string;
  kelasId: string | null;
  status: "ok" | "dilewati";
  alasan: string;
};

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_ROWS = 1000;

type KelasRingkas = { id: string; nama_kelas: string };

function teks(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "";
  if (nilai instanceof Date) return nilai.toISOString().slice(0, 10);
  return String(nilai).trim();
}

// Membaca file .xlsx:
// baris 1 = judul kolom (NIS, Nama, Kelas), data mulai baris 2.
export async function parseSiswaXlsx(
  buffer: Buffer,
  kelasList: KelasRingkas[],
  nisTerpakai: string[] = [],
): Promise<{ rows: BarisImport[]; error: string | null }> {
  let data;
  try {
    data = await readSheet(buffer);
  } catch {
    return {
      rows: [],
      error:
        "File tidak bisa dibaca. Pastikan file berformat .xlsx (bukan .xls atau CSV).",
    };
  }

  return olahBaris(data, kelasList, nisTerpakai);
}

// Mengolah isi tabel (array baris) menjadi daftar baris import.
// Dipisah dari pembacaan file supaya mudah diuji.
export function olahBaris(
  data: unknown[][],
  kelasList: KelasRingkas[],
  nisTerpakai: string[] = [],
): { rows: BarisImport[]; error: string | null } {
  // Lewati baris pertama (judul kolom)
  const baris = data.slice(1);

  if (baris.length > MAX_ROWS) {
    return {
      rows: [],
      error: `Terlalu banyak baris (${baris.length}). Maksimal ${MAX_ROWS} baris per file.`,
    };
  }

  const kelasMap = new Map(
    kelasList.map((kelas) => [kelas.nama_kelas.trim().toLowerCase(), kelas.id]),
  );
  const nisDiDatabase = new Set(nisTerpakai.map((nis) => nis.trim()));
  const nisDiFile = new Set<string>();

  const rows: BarisImport[] = [];

  baris.forEach((row, index) => {
    const nis = teks(row[0]);
    const nama = teks(row[1]);
    const kelas = teks(row[2]);

    // Baris benar-benar kosong: abaikan
    if (!nis && !nama && !kelas) return;

    const nomor = index + 2; // nomor baris sebenarnya di Excel

    if (!nis) {
      rows.push({
        nomor,
        nis: "",
        nama,
        kelas,
        kelasId: null,
        status: "dilewati",
        alasan: "NIS kosong",
      });
      return;
    }

    if (!nama) {
      rows.push({
        nomor,
        nis,
        nama: "",
        kelas,
        kelasId: null,
        status: "dilewati",
        alasan: "Nama kosong",
      });
      return;
    }

    if (nisDiDatabase.has(nis)) {
      rows.push({
        nomor,
        nis,
        nama,
        kelas,
        kelasId: null,
        status: "dilewati",
        alasan: "NIS sudah terdaftar",
      });
      return;
    }

    if (nisDiFile.has(nis)) {
      rows.push({
        nomor,
        nis,
        nama,
        kelas,
        kelasId: null,
        status: "dilewati",
        alasan: "NIS ganda di dalam file",
      });
      return;
    }

    let kelasId: string | null = null;
    let alasan = "Siap";

    if (kelas) {
      kelasId = kelasMap.get(kelas.toLowerCase()) ?? null;

      if (!kelasId) {
        rows.push({
          nomor,
          nis,
          nama,
          kelas,
          kelasId: null,
          status: "dilewati",
          alasan: `Kelas "${kelas}" tidak ada di data kelas`,
        });
        return;
      }
    } else {
      alasan = "Tanpa kelas";
    }

    nisDiFile.add(nis);
    rows.push({ nomor, nis, nama, kelas, kelasId, status: "ok", alasan });
  });

  if (rows.length === 0) {
    return { rows: [], error: "Tidak ada data siswa yang ditemukan di file." };
  }

  return { rows, error: null };
}
