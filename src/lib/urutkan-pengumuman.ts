export type UrutPengumuman = "judul" | "tanggal";
export type Arah = "asc" | "desc";

type PengumumanUrut = {
  judul: string;
  created_at: string | null;
};

// Arah urutan (naik/turun). Nilai selain "desc" dianggap naik.
export function bacaArah(nilai: unknown): Arah {
  return nilai === "desc" ? "desc" : "asc";
}

// Kolom urut: "judul" atau "tanggal". Nilai lain dianggap "judul".
export function bacaUrutPengumuman(nilai: unknown): UrutPengumuman {
  return nilai === "tanggal" ? "tanggal" : "judul";
}

// Mengurutkan daftar pengumuman berdasarkan kolom pilihan.
// Judul: A→Z / Z→A. Tanggal: lama→baru (asc) / baru→lama (desc).
export function urutkanPengumuman<T extends PengumumanUrut>(
  rows: T[],
  urut: UrutPengumuman,
  arah: Arah,
): T[] {
  const naik = arah === "asc";

  return [...rows].sort((a, b) => {
    let banding: number;

    if (urut === "tanggal") {
      const waktuA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const waktuB = b.created_at ? new Date(b.created_at).getTime() : 0;
      banding = waktuA - waktuB;
    } else {
      banding = a.judul.localeCompare(b.judul, "id", {
        numeric: true,
        sensitivity: "base",
      });
    }

    return naik ? banding : -banding;
  });
}

// Menyaring daftar pengumuman berdasarkan kata kunci.
// Kata dicari di judul DAN nama-nama kelas yang berlaku.
export function filterPengumuman<T extends { judul: string }>(
  rows: T[],
  kata: string,
  namaKelas?: (row: T) => string[],
): T[] {
  const q = kata.trim().toLowerCase();

  if (!q) {
    return rows;
  }

  return rows.filter((row) => {
    if (row.judul.toLowerCase().includes(q)) {
      return true;
    }

    if (!namaKelas) {
      return false;
    }

    return namaKelas(row).some((nama) => nama.toLowerCase().includes(q));
  });
}
