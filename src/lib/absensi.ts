// ============================================================================
// Helper absensi siswa: status, validasi input, dan rekap kehadiran.
// ============================================================================

export type StatusAbsensi = "hadir" | "sakit" | "izin" | "alpa";

export const DAFTAR_STATUS: StatusAbsensi[] = [
  "hadir",
  "sakit",
  "izin",
  "alpa",
];

export const LABEL_STATUS: Record<StatusAbsensi, string> = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpa: "Alpa",
};

export const VARIAN_BADGE: Record<
  StatusAbsensi,
  "sukses" | "info" | "peringatan" | "bahaya"
> = {
  hadir: "sukses",
  sakit: "info",
  izin: "peringatan",
  alpa: "bahaya",
};

// Nilai status dari form/DB → StatusAbsensi, atau null kalau tidak dikenal.
export function bacaStatusAbsensi(nilai: unknown): StatusAbsensi | null {
  if (typeof nilai !== "string") return null;
  return (DAFTAR_STATUS as string[]).includes(nilai)
    ? (nilai as StatusAbsensi)
    : null;
}

// Validasi tanggal format YYYY-MM-DD. Mengembalikan teks aslinya bila valid.
export function bacaTanggal(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;
  const teks = nilai.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return null;
  const waktu = new Date(`${teks}T00:00:00`);
  if (Number.isNaN(waktu.getTime())) return null;
  return teks;
}

// Tanggal lokal hari ini dalam format YYYY-MM-DD (untuk default input date).
export function hariIni(): string {
  const sekarang = new Date();
  const dua = (angka: number) => String(angka).padStart(2, "0");
  return `${sekarang.getFullYear()}-${dua(sekarang.getMonth() + 1)}-${dua(
    sekarang.getDate(),
  )}`;
}

// Format tanggal (YYYY-MM-DD, waktu lokal) untuk tampilan id-ID.
export function formatTanggal(tanggal: string | null): string {
  const valid = bacaTanggal(tanggal);
  if (!valid) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${valid}T00:00:00`));
}

export type RekapAbsensi = {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  total: number;
  // Persentase kehadiran (0–100), dibulatkan. 0 kalau belum ada data.
  persenHadir: number;
};

export function hitungRekap(
  rows: { status: StatusAbsensi }[],
): RekapAbsensi {
  const rekap: RekapAbsensi = {
    hadir: 0,
    sakit: 0,
    izin: 0,
    alpa: 0,
    total: 0,
    persenHadir: 0,
  };

  for (const row of rows) {
    rekap[row.status] += 1;
    rekap.total += 1;
  }

  rekap.persenHadir =
    rekap.total === 0 ? 0 : Math.round((rekap.hadir / rekap.total) * 100);

  return rekap;
}
