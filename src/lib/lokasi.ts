// ============================================================================
// Lokasi siswa (GPS perangkat) — tipe, label, validasi, dan pemformat bersama.
//
// File ini dipakai Server Component (halaman guru), Server Action (simpan
// lokasi), DAN Client Component (pelacak lokasi). Karena itu tidak boleh
// menyentuh API server-only maupun API browser.
//
// Catatan penting soal ketelitian:
//  - HP/tablet dengan GPS sungguhan → akurasi ±5–30 m (bisa dipercaya).
//  - Laptop dengan WiFi            → ±20–50 m di area kota.
//  - PC lab dengan kabel LAN       → jatuh ke IP geolocation: 1–50 KM,
//    sering salah kota. Karena itu angka akurasi SELALU disimpan dan
//    ditampilkan apa adanya supaya guru bisa menilai sendiri.
// ============================================================================

// Status pengambilan lokasi. Dipakai juga sebagai nilai kolom "status".
export type StatusLokasi =
  | "diizinkan"
  | "ditolak"
  | "tidak_didukung"
  | "gagal";

export const LABEL_STATUS_LOKASI: Record<StatusLokasi, string> = {
  diizinkan: "Terlacak",
  ditolak: "Izin ditolak",
  tidak_didukung: "Tidak didukung",
  gagal: "Gagal dilacak",
};

export const STATUS_LOKASI_VALID: StatusLokasi[] = [
  "diizinkan",
  "ditolak",
  "tidak_didukung",
  "gagal",
];

export function statusLokasiValid(nilai: unknown): nilai is StatusLokasi {
  return (
    typeof nilai === "string" &&
    (STATUS_LOKASI_VALID as string[]).includes(nilai)
  );
}

// Batas kewajaran akurasi (meter). Di atas ini lokasinya nyaris tak berguna
// (biasanya hasil IP geolocation), tapi tetap disimpan supaya guru tahu.
export const MAKS_AKURASI_M = 5_000_000;

export type Koordinat = { lat: number; lng: number; akurasi: number | null };

// Validasi koordinat dari klien. Data dari browser TIDAK dipercaya, jadi
// rentangnya diperiksa di server sebelum disimpan.
export function koordinatValid(
  lat: number,
  lng: number,
  akurasi: number | null,
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  // (0,0) di tengah Samudra Atlantik hampir selalu nilai bawaan yang gagal
  // dibaca, bukan lokasi sungguhan. Tolak supaya data tidak menyesatkan.
  if (lat === 0 && lng === 0) return false;
  if (
    akurasi !== null &&
    (!Number.isFinite(akurasi) || akurasi < 0 || akurasi > MAKS_AKURASI_M)
  ) {
    return false;
  }
  return true;
}

// Tautan Google Maps ke titik koordinat.
export function tautanPeta(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Koordinat dengan 5 angka di belakang koma (≈ 1 m) supaya ringkas tapi presisi.
export function formatKoordinat(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Akurasi dalam meter. Angka besar dibulatkan ke km agar mudah dibaca.
export function formatAkurasi(akurasi: number | null): string {
  if (akurasi === null) return "tanpa info akurasi";
  if (akurasi >= 1000) return `±${(akurasi / 1000).toFixed(1)} km`;
  return `±${Math.round(akurasi)} m`;
}
