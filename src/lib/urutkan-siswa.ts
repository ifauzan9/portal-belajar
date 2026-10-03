export type Urut = "nis" | "nama" | "kelas";
export type Arah = "asc" | "desc";

type SiswaUrut = {
  nis: string | null;
  nama_siswa: string;
  kelas_id: string | null;
};

// Mengurutkan daftar siswa berdasarkan kolom pilihan.
// Baris yang NIS/nama/kelasnya kosong SELALU diletakkan paling bawah,
// tidak peduli arah pengurutan.
export function urutkanSiswa<T extends SiswaUrut>(
  rows: T[],
  namaKelas: Map<string, string>,
  urut: Urut,
  arah: Arah,
): T[] {
  const naik = arah === "asc";

  const isi = (row: T): string => {
    if (urut === "nis") return (row.nis ?? "").trim();
    if (urut === "nama") return (row.nama_siswa ?? "").trim();
    return row.kelas_id ? (namaKelas.get(row.kelas_id) ?? "") : "";
  };

  const kosong = (row: T): boolean => isi(row) === "";

  return [...rows].sort((a, b) => {
    const kosongA = kosong(a);
    const kosongB = kosong(b);

    // Yang kosong selalu di bawah
    if (kosongA !== kosongB) return kosongA ? 1 : -1;
    if (kosongA && kosongB) return 0;

    const banding = isi(a).localeCompare(isi(b), "id", {
      numeric: true,
      sensitivity: "base",
    });

    return naik ? banding : -banding;
  });
}

export function bacaUrut(nilai: unknown): Urut {
  return nilai === "nis" || nilai === "kelas" ? nilai : "nama";
}

export function bacaArah(nilai: unknown): Arah {
  return nilai === "desc" ? "desc" : "asc";
}

// Menyaring daftar siswa berdasarkan kata kunci: cocok dengan NIS atau nama.
// Huruf besar/kecil diabaikan, spasi di pinggir diabaikan.
export function filterSiswa<
  T extends { nis: string | null; nama_siswa: string },
>(rows: T[], kata: string): T[] {
  const q = kata.trim().toLowerCase();

  if (!q) {
    return rows;
  }

  return rows.filter(
    (row) =>
      (row.nis ?? "").toLowerCase().includes(q) ||
      row.nama_siswa.toLowerCase().includes(q),
  );
}
