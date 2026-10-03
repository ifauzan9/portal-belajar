export type UrutUlangan = "judul" | "tanggal";
export type Arah = "asc" | "desc";

type UlanganUrut = {
  judul: string;
  tanggal: string | null;
};

export function bacaArah(nilai: unknown): Arah {
  return nilai === "desc" ? "desc" : "asc";
}

export function bacaUrutUlangan(nilai: unknown): UrutUlangan {
  return nilai === "tanggal" ? "tanggal" : "judul";
}

// Mengurutkan daftar ulangan berdasarkan kolom pilihan.
// Judul: A→Z / Z→A. Tanggal: lama→baru (asc) / baru→lama (desc).
// Tanggal kosong selalu diletakkan paling bawah.
export function urutkanUlangan<T extends UlanganUrut>(
  rows: T[],
  urut: UrutUlangan,
  arah: Arah,
): T[] {
  const naik = arah === "asc";

  return [...rows].sort((a, b) => {
    let banding: number;

    if (urut === "tanggal") {
      const waktuA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
      const waktuB = b.tanggal ? new Date(b.tanggal).getTime() : 0;

      // Tanggal kosong selalu di bawah
      if (waktuA === 0 && waktuB === 0) return 0;
      if (waktuA === 0) return 1;
      if (waktuB === 0) return -1;

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

// Menyaring daftar ulangan berdasarkan kata kunci (judul).
export function filterUlangan<T extends { judul: string }>(
  rows: T[],
  kata: string,
): T[] {
  const q = kata.trim().toLowerCase();

  if (!q) {
    return rows;
  }

  return rows.filter((row) => row.judul.toLowerCase().includes(q));
}
