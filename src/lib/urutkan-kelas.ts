export type UrutKelas = "nama" | "tanggal";
export type Arah = "asc" | "desc";

// Arah urutan dipakai juga oleh kolom lain di halaman ini.
export function bacaArah(nilai: unknown): Arah {
  return nilai === "desc" ? "desc" : "asc";
}

type KelasUrut = { nama_kelas: string; created_at: string | null };

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// Menampilkan tanggal pendek, contoh: 30 Sep 2026
export function tanggalPendek(iso: string | null): string {
  if (!iso) return "-";

  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "-";

  return FORMAT_TANGGAL.format(tanggal);
}

function waktu(iso: string | null): number {
  if (!iso) return 0;
  const waktu = new Date(iso).getTime();
  return Number.isNaN(waktu) ? 0 : waktu;
}

// Mengurutkan daftar kelas berdasarkan kolom pilihan.
// Nama: A→Z / Z→A. Tanggal: lama→baru (asc) / baru→lama (desc).
export function urutkanKelas<T extends KelasUrut>(
  rows: T[],
  urut: UrutKelas,
  arah: Arah,
): T[] {
  const naik = arah === "asc";

  return [...rows].sort((a, b) => {
    let banding: number;

    if (urut === "tanggal") {
      banding = waktu(a.created_at) - waktu(b.created_at);
    } else {
      banding = a.nama_kelas.localeCompare(b.nama_kelas, "id", {
        numeric: true,
        sensitivity: "base",
      });
    }

    return naik ? banding : -banding;
  });
}

// Menyaring daftar kelas berdasarkan kata kunci (nama kelas).
export function filterKelas<T extends { nama_kelas: string }>(
  rows: T[],
  kata: string,
): T[] {
  const q = kata.trim().toLowerCase();

  if (!q) {
    return rows;
  }

  return rows.filter((row) => row.nama_kelas.toLowerCase().includes(q));
}

export function bacaUrutKelas(nilai: unknown): UrutKelas {
  return nilai === "tanggal" ? "tanggal" : "nama";
}
