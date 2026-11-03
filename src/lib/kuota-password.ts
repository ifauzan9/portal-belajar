import type { SupabaseClient } from "@supabase/supabase-js";
import { cekKuota, type HasilKuota } from "@/lib/kuota-harian";

// ============================================================================
// Aturan kuota ganti password siswa.
//
// Dipisah dari Server Action ("use server") karena file action hanya boleh
// mengekspor fungsi async, sedangkan konstanta & helper ini dipakai juga oleh
// halaman profil (Server Component) untuk menampilkan sisa kuota.
//
// Penghitungnya per AKUN (student_accounts.id), bukan per username atau IP:
// username bisa diganti guru, dan IP bisa diakali dengan ganti jaringan.
// ============================================================================

// Batas ganti password siswa per hari (per akun).
export const MAKS_GANTI_PASSWORD_HARIAN = 3;

// Sisa kuota hari ini untuk satu akun.
//
// `admin` wajib service-role karena tabel student_accounts dicabut dari
// anon/authenticated (lihat schema Tahap 23).
export async function sisaKuotaPassword(
  admin: SupabaseClient,
  accountId: string,
): Promise<HasilKuota> {
  return cekKuota(admin, accountId, MAKS_GANTI_PASSWORD_HARIAN);
}

// Pesan saat kuota tidak bisa dipakai. Dibedakan supaya siswa tidak diberi
// instruksi yang salah ketika masalahnya hanya gangguan sementara.
export function pesanKuotaTidakSiap(alasan?: string): string {
  return alasan === "skema"
    ? "Kuota ganti password belum aktif. Hubungi guru untuk menjalankan pembaruan database (schema Tahap 31)."
    : "Kuota ganti password tidak bisa dibaca sekarang. Coba lagi sebentar lagi.";
}

// Pesan saat batas harian sudah tercapai.
export const PESAN_KUOTA_HABIS =
  "Batas ganti password sudah tercapai (3x per hari). Coba lagi besok.";
