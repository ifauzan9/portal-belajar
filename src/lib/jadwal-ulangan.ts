// ============================================================================
// Helper jadwal mulai ulangan.
//
// `exams.tanggal` adalah tanggal kalender (YYYY-MM-DD) dalam WIB. Ulangan
// dianggap boleh dimulai sejak pukul 00.00 WIB pada tanggal tersebut.
// Null = tidak ada jadwal mulai (boleh dikerjakan kapan saja selama terbuka).
// ============================================================================

import { OFFSET_WIB } from "@/lib/waktu";

// Ubah tanggal kalender WIB (YYYY-MM-DD) menjadi milidetik epoch.
// Mengembalikan null jika kosong / formatnya tidak valid.
export function mulaiUlanganMs(tanggal: string | null): number | null {
  if (!tanggal) return null;

  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal.trim());
  if (!cocok) return null;

  const [, tahun, bulan, hari] = cocok;
  const waktu = new Date(
    `${tahun}-${bulan}-${hari}T00:00:00${OFFSET_WIB}`,
  );

  if (Number.isNaN(waktu.getTime())) return null;
  return waktu.getTime();
}

// true jika sekarang masih SEBELUM tanggal mulai ulangan.
export function belumWaktunyaMulai(
  tanggal: string | null,
  sekarangMs: number = Date.now(),
): boolean {
  const mulaiMs = mulaiUlanganMs(tanggal);
  return mulaiMs !== null && sekarangMs < mulaiMs;
}

// Sisa waktu pengerjaan (menit, dibulatkan ke atas). Null jika durasi tidak
// diatur. Nilai 0 berarti waktu sudah habis.
export function sisaMenitUjian(
  mulaiAt: string,
  durasi: number | null,
): number | null {
  if (!durasi || durasi <= 0) return null;

  const sisaMs =
    new Date(mulaiAt).getTime() + durasi * 60_000 - Date.now();
  if (Number.isNaN(sisaMs)) return null;
  return Math.max(0, Math.ceil(sisaMs / 60_000));
}