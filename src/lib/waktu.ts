// ============================================================================
// Helper waktu Indonesia Barat (WIB / Asia/Jakarta / UTC+7).
//
// Semua tampilan tanggal & jam di aplikasi memakai helper ini supaya hasilnya
// SAMA di server mana pun. Tanpa `timeZone`, `Intl.DateTimeFormat` memakai zona
// mesin server — di Vercel (UTC) jam jadi meleset 7 jam dibanding WIB.
//
// Catatan: Indonesia tidak memakai daylight saving time, jadi offset WIB
// selalu +07:00 (tidak perlu logika DST).
// ============================================================================

export const ZONA_WIB = "Asia/Jakarta";
export const OFFSET_WIB = "+07:00";

type OpsiFormat = Intl.DateTimeFormatOptions;

function keTanggal(iso: string | null): Date | null {
  if (!iso) return null;
  const waktu = new Date(iso);
  return Number.isNaN(waktu.getTime()) ? null : waktu;
}

function format(iso: string | null, opsi: OpsiFormat): string {
  const waktu = keTanggal(iso);
  if (!waktu) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: ZONA_WIB,
    ...opsi,
  }).format(waktu);
}

// "01 Nov 2026"
export function formatTanggalWib(iso: string | null): string {
  return format(iso, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "01 November 2026, 14.14"
export function formatWaktuPanjangWib(iso: string | null): string {
  return format(iso, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "01 Nov 2026, 14.14"
export function formatWaktuWib(iso: string | null): string {
  return format(iso, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "01 Nov 2026, 14.14.01" (log/detail yang butuh detik)
export function formatWaktuDetikWib(iso: string | null): string {
  return format(iso, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// "01 Nov, 14.14" (label tenggat ringkas tanpa tahun)
export function formatTanggalJamPendekWib(iso: string | null): string {
  return format(iso, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "01 Nov" (hanya tanggal & bulan)
export function formatTanggalBulanWib(iso: string | null): string {
  return format(iso, {
    day: "2-digit",
    month: "short",
  });
}

// Tanggal kalender saja (bukan timestamp), contoh "2026-11-01".
// Di-anchor tengah hari UTC supaya tanggal tidak bergeser oleh zona mana pun.
export function formatTanggalKalenderWib(tanggal: string | null): string {
  if (!tanggal) return "-";
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal.trim());
  if (!cocok) return "-";
  const [, tahun, bulan, hari] = cocok;
  const waktu = new Date(
    Date.UTC(Number(tahun), Number(bulan) - 1, Number(hari), 12),
  );
  if (Number.isNaN(waktu.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(waktu);
}

// Tanggal hari ini di WIB dalam format "YYYY-MM-DD".
export function tanggalWibHariIni(sekarang: Date = new Date()): string {
  return tanggalWibDariDate(sekarang);
}

/**
 * Jam dinding WIB (0–23) dari sebuah Date. Dipakai untuk aturan berbasis jam,
 * mis. jadwal atau batas waktu yang diatur guru.
 */
export function jamWib(sekarang: Date = new Date()): number {
  if (Number.isNaN(sekarang.getTime())) return 0;

  const jam = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_WIB,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(sekarang);

  return Number(jam) || 0;
}

/**
 * Menit sejak tengah malam menurut jam dinding WIB (0–1439).
 * Dipakai untuk aturan yang butuh jam + menit, mis. jam tutup login token
 * yang bisa diatur guru (Tahap 46).
 */
export function menitWib(sekarang: Date = new Date()): number {
  if (Number.isNaN(sekarang.getTime())) return 0;

  const bagian = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_WIB,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(sekarang);

  const ambil = (tipe: string) =>
    Number(bagian.find((b) => b.type === tipe)?.value ?? 0) || 0;

  return (ambil("hour") % 24) * 60 + ambil("minute");
}

// Ambil tanggal kalender WIB (YYYY-MM-DD) dari sebuah Date.
// Dipakai untuk sel Excel bertipe tanggal: apa pun zona mesin server, hasilnya
// tanggal yang terlihat di WIB.
export function tanggalWibDariDate(waktu: Date): string {
  if (Number.isNaN(waktu.getTime())) return "";

  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(waktu);

  const ambil = (tipe: string) =>
    bagian.find((b) => b.type === tipe)?.value ?? "";
  return `${ambil("year")}-${ambil("month")}-${ambil("day")}`;
}

/**
 * ISO string → nilai untuk input `datetime-local` ("YYYY-MM-DDTHH:mm"),
 * dihitung menurut jam dinding WIB.
 */
export function isoKeInputLokalWib(iso: string | null): string {
  const waktu = keTanggal(iso);
  if (!waktu) return "";

  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(waktu);

  const ambil = (tipe: string) =>
    bagian.find((b) => b.type === tipe)?.value ?? "";
  return `${ambil("year")}-${ambil("month")}-${ambil("day")}T${ambil(
    "hour",
  )}:${ambil("minute")}`;
}

/**
 * Membaca nilai input `datetime-local` sebagai jam WIB, lalu kembalikan ISO
 * UTC siap simpan. Tanpa ini, server UTC akan membaca "10:00" sebagai 10:00
 * UTC (= 17:00 WIB) sehingga tenggat bergeser 7 jam.
 * Nilai rusak/kosong → null.
 */
export function parseInputLokalWib(nilai: string): string | null {
  const teks = nilai.trim();
  if (!teks) return null;

  const isDatetimeLokal = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(teks);
  const lengkap =
    isDatetimeLokal && teks.length === 16 ? `${teks}:00` : teks;
  const waktu = new Date(
    isDatetimeLokal ? `${lengkap}${OFFSET_WIB}` : lengkap,
  );

  if (Number.isNaN(waktu.getTime())) return null;
  return waktu.toISOString();
}
