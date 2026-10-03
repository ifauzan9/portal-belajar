// Membaca nilai-nilai dari form input nilai ulangan.
// Setiap input bernama `nilai_{siswaId}` — kalau isinya tidak ada
// atau bukan angka 0–100, siswa itu diabaikan (belum diisi).
export type HasilBacaNilai = {
  daftar: { siswaId: string; nilai: number }[];
  galat: string | null;
};

export function bacaNilaiDariForm(formData: FormData): HasilBacaNilai {
  const daftar: { siswaId: string; nilai: number }[] = [];
  let galat: string | null = null;

  for (const [nama, nilaiRaw] of formData.entries()) {
    if (!nama.startsWith("nilai_")) continue;

    const siswaId = nama.slice("nilai_".length);
    if (typeof nilaiRaw !== "string") continue;

    const teks = nilaiRaw.trim();
    if (!teks) continue; // belum diisi, lewati

    const angka = Number(teks);
    if (Number.isNaN(angka)) {
      galat = `Nilai siswa (id ${siswaId}) bukan angka yang valid.`;
      break;
    }
    if (angka < 0 || angka > 100) {
      galat = `Nilai harus antara 0 sampai 100.`;
      break;
    }

    daftar.push({ siswaId, nilai: Math.round(angka) });
  }

  return { daftar, galat };
}

// ======================================================================
// Import nilai dari Excel
// ======================================================================

// Satu baris hasil parsing (untuk pratinjau di UI).
export type BarisNilaiExcel = {
  // NIS dari file
  nis: string;
  // Nama dari file (verifikasi visual)
  nama: string;
  // Nilai dari file (0–100)
  nilai: number;
  // Status validitas baris ini
  status: "ok" | "salah";
  // Alasan kalau status salah
  alasan: string | null;
};

// Hasil parsing file Excel nilai.
export type HasilParseNilaiExcel = {
  // Semua baris (untuk pratinjau), termasuk yang salah
  daftar: BarisNilaiExcel[];
  // Galat umum (file rusak, tidak ada data, dll)
  galat: string | null;
};

// Format kolom yang diharapkan:
//   Kolom 1: NIS (string)
//   Kolom 2: Nama (diabaikan, hanya untuk verifikasi visual)
//   Kolom 3: Nilai (0–100)
// Baris 1 dianggap header dan dilewati. Baris kosong dilewati.
// NIS ganda: nilai terakhir menang (baris pertama ditandai "salah").
// Nilai di luar 0–100 atau non-angka → status "salah".
export async function parseNilaiExcel(
  buffer: Buffer,
): Promise<HasilParseNilaiExcel> {
  const { readSheet } = await import("read-excel-file/node");

  let data: unknown[][];
  try {
    data = await readSheet(buffer);
  } catch {
    return {
      daftar: [],
      galat: "Gagal membaca file Excel. Pastikan file format .xlsx yang valid.",
    };
  }

  // Lewati baris 1 (header), mulai dari baris ke-2
  const barisData = data.slice(1);

  const daftar: BarisNilaiExcel[] = [];
  // NIS yang sudah muncul sebelumnya (untuk deteksi ganda)
  const nisTelihat = new Set<string>();

  for (let i = 0; i < barisData.length; i++) {
    const row = barisData[i];
    if (!row) continue;

    const nis = String(row[0] ?? "").trim();
    const nama = String(row[1] ?? "").trim();
    const nilaiRaw = row[2];
    const nilaiString = String(nilaiRaw ?? "").trim();

    // Baris benar-benar kosong: lewati
    if (!nis && !nama && !nilaiString) continue;

    // NIS wajib
    if (!nis) {
      daftar.push({
        nis: "",
        nama,
        nilai: 0,
        status: "salah",
        alasan: `Baris ${i + 2}: NIS kosong`,
      });
      continue;
    }

    // Nilai wajib
    if (!nilaiString) {
      daftar.push({
        nis,
        nama,
        nilai: 0,
        status: "salah",
        alasan: `Baris ${i + 2}: nilai kosong`,
      });
      continue;
    }

    const angka = Number(nilaiString);
    if (Number.isNaN(angka)) {
      daftar.push({
        nis,
        nama,
        nilai: 0,
        status: "salah",
        alasan: `Baris ${i + 2}: nilai bukan angka`,
      });
      continue;
    }
    if (angka < 0 || angka > 100) {
      daftar.push({
        nis,
        nama,
        nilai: 0,
        status: "salah",
        alasan: `Baris ${i + 2}: nilai di luar 0–100`,
      });
      continue;
    }

    // NIS ganda: tandai baris lama "salah", pakai nilai terakhir
    if (nisTelihat.has(nis)) {
      // Tandai baris pertama (yang sudah di daftar) sebagai salah
      const barisLama = daftar.find(
        (b) => b.nis === nis && b.status === "ok",
      );
      if (barisLama) {
        barisLama.status = "salah";
        barisLama.alasan = `Baris ${i - 1 + 1}: NIS ganda (nilai terakhir yang dipakai)`;
      }
    }

    daftar.push({
      nis,
      nama,
      nilai: Math.round(angka),
      status: "ok",
      alasan: null,
    });
    nisTelihat.add(nis);
  }

  if (daftar.length === 0) {
    return { daftar, galat: "File Excel tidak berisi data nilai yang valid." };
  }

  return { daftar, galat: null };
}
