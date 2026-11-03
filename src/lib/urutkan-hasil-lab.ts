import type { Arah } from "./urutkan-siswa";

// ============================================================================
// Pengurutan ringkasan hasil Lab Coding untuk guru.
//
// Baris yang ditampilkan adalah ringkasan per siswa:
//   { siswa, selesai, total, totalPercobaan }
//
// Kolom yang bisa diurutkan sengaja dibatasi pada data yang memang tampil di
// tabel, supaya judul kolom yang bisa diklik sama dengan isi tabelnya.
// ============================================================================

export type UrutHasilLab =
  | "nama"
  | "nis"
  | "kelas"
  | "selesai"
  | "percobaan";

type SiswaRingkas = {
  nama_siswa: string;
  nis: string | null;
  kelas_id: string | null;
};

export type BarisHasilLab = {
  siswa: SiswaRingkas;
  selesai: number;
  totalPercobaan: number;
};

// Nilai tak dikenal jatuh ke "selesai" supaya parameter URL yang aneh tidak
// membuat daftar kosong.
export function bacaUrutHasilLab(nilai: unknown): UrutHasilLab {
  if (
    nilai === "nama" ||
    nilai === "nis" ||
    nilai === "kelas" ||
    nilai === "percobaan"
  ) {
    return nilai;
  }
  return "selesai";
}

// Teks yang dipakai untuk kolom teks. Kolom angka mengembalikan "".
function teksKolom(
  row: BarisHasilLab,
  urut: UrutHasilLab,
  namaKelas: Map<string, string>,
): string {
  if (urut === "nama") return (row.siswa.nama_siswa ?? "").trim();
  if (urut === "nis") return (row.siswa.nis ?? "").trim();
  if (urut === "kelas") {
    return row.siswa.kelas_id
      ? (namaKelas.get(row.siswa.kelas_id) ?? "").trim()
      : "";
  }
  return "";
}

function angkaKolom(row: BarisHasilLab, urut: UrutHasilLab): number {
  return urut === "percobaan" ? row.totalPercobaan : row.selesai;
}

// Mengurutkan ringkasan per siswa.
// - Kolom teks: A→Z / Z→A, angka dibandingkan secara numerik.
// - Nama/NIS/kelas yang kosong SELALU di bawah, apa pun arahnya.
// - Bila nilai sama, diurutkan menurut nama (A→Z) agar urutan stabil.
export function urutkanHasilLab<T extends BarisHasilLab>(
  rows: T[],
  namaKelas: Map<string, string>,
  urut: UrutHasilLab,
  arah: Arah,
): T[] {
  const naik = arah === "asc";
  const kolomTeks = urut === "nama" || urut === "nis" || urut === "kelas";

  return [...rows].sort((a, b) => {
    if (kolomTeks) {
      const kosongA = teksKolom(a, urut, namaKelas) === "";
      const kosongB = teksKolom(b, urut, namaKelas) === "";
      if (kosongA !== kosongB) return kosongA ? 1 : -1;
    }

    const banding = kolomTeks
      ? teksKolom(a, urut, namaKelas).localeCompare(
          teksKolom(b, urut, namaKelas),
          "id",
          { numeric: true, sensitivity: "base" },
        )
      : angkaKolom(a, urut) - angkaKolom(b, urut);

    if (banding !== 0) return naik ? banding : -banding;

    return (a.siswa.nama_siswa ?? "").localeCompare(
      b.siswa.nama_siswa ?? "",
      "id",
      { numeric: true, sensitivity: "base" },
    );
  });
}
