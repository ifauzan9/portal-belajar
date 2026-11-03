import { cekKuota } from "@/lib/kuota-harian";

// ============================================================================
// Aturan kuota ganti password siswa.
//
// Dipisah dari Server Action ("use server") karena file action hanya boleh
// mengekspor fungsi async, sedangkan konstanta & helper ini dipakai juga oleh
// halaman profil (Server Component) untuk menampilkan sisa kuota.
// ============================================================================

// Batas ganti password siswa per hari (per akun).
export const MAKS_GANTI_PASSWORD_HARIAN = 3;

// Kunci per akun (bukan per IP) supaya tidak bisa diakali ganti jaringan.
export function kunciKuotaPassword(username: string): string {
  return `ganti-password:${username.trim().toLowerCase()}`;
}

// Sisa kuota hari ini untuk satu username.
export function sisaKuotaPassword(username: string) {
  return cekKuota(kunciKuotaPassword(username), MAKS_GANTI_PASSWORD_HARIAN);
}
