import { headers } from "next/headers";

// ============================================================================
// Pembatas percobaan login sederhana (in-memory).
//
// Catatan: penyimpanan ini hanya hidup selama proses server berjalan.
// Hilang saat restart dan TIDAK cocok untuk banyak instance/serverless
// (tiap instance punya penghitung sendiri). Untuk produksi terdistribusi,
// ganti dengan penyimpanan bersama (DB/Redis).
// ============================================================================

type Catatan = {
  gagal: number; // jumlah gagal dalam jendela berjalan
  jendelaMulai: number; // waktu mulai jendela (ms)
  blokirSampai: number; // akhir blokir (ms); 0 = tidak diblokir
};

const peta = new Map<string, Catatan>();

const JENDELA_MS = 10 * 60 * 1000; // 10 menit
const MAKS_GAGAL = 5; // maksimal gagal per jendela
const DURASI_BLOKIR_MS = 15 * 60 * 1000; // 15 menit

export type HasilCek = { boleh: boolean; sisaDetik: number };

// Cek apakah sebuah kunci sedang diblokir.
export function cekBlokir(kunci: string, sekarang = Date.now()): HasilCek {
  const catatan = peta.get(kunci);
  if (!catatan) return { boleh: true, sisaDetik: 0 };

  if (catatan.blokirSampai > sekarang) {
    return {
      boleh: false,
      sisaDetik: Math.ceil((catatan.blokirSampai - sekarang) / 1000),
    };
  }

  // Blokir sudah lewat → bersihkan.
  if (catatan.blokirSampai !== 0 && catatan.blokirSampai <= sekarang) {
    peta.delete(kunci);
  }

  return { boleh: true, sisaDetik: 0 };
}

// Catat satu percobaan gagal. Setelah MAKS_GAGAL, kunci diblokir sementara.
export function catatGagal(kunci: string, sekarang = Date.now()): void {
  let catatan = peta.get(kunci);

  if (!catatan || sekarang - catatan.jendelaMulai > JENDELA_MS) {
    catatan = { gagal: 0, jendelaMulai: sekarang, blokirSampai: 0 };
  }

  catatan.gagal += 1;

  if (catatan.gagal >= MAKS_GAGAL) {
    catatan.blokirSampai = sekarang + DURASI_BLOKIR_MS;
  }

  peta.set(kunci, catatan);
}

// Reset penghitung setelah login berhasil.
export function resetGagal(kunci: string): void {
  peta.delete(kunci);
}

// Pesan seragam saat terlalu banyak percobaan.
export function pesanTerlaluBanyak(sisaDetik: number): string {
  const menit = Math.max(1, Math.ceil(sisaDetik / 60));
  return `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`;
}

// Ambil IP pengirim dari header proxy (fallback ke "unknown").
export async function ambilIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const pertama = xff.split(",")[0]?.trim();
    if (pertama) return pertama;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
