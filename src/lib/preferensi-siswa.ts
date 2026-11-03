// ============================================================================
// Preferensi tampilan siswa — tipe, konstanta, dan parser bersama.
//
// File ini dipakai Server Component (layout & halaman profil) DAN Client
// Component (form preferensi), jadi tidak boleh menyentuh API browser.
//
// Preferensi disimpan di COOKIE (bukan database), supaya bisa dibaca saat
// render server. Dengan begitu tema sudah benar sejak HTML pertama dikirim —
// tidak ada kedip putih dan tidak perlu skrip inline.
//
// Cookie berisi pilihan pengguna ("sistem") + tema efektif hasil hitungan
// browser. Server memakai tema efektif; browser memperbaruinya bila tema
// perangkat berubah.
// ============================================================================

export const NAMA_COOKIE_TAMPILAN = "profil_siswa_tampilan";

// Preferensi berlaku setahun.
export const UMUR_COOKIE_DETIK = 60 * 60 * 24 * 365;

export type Tema = "terang" | "gelap" | "sistem";
export type UkuranTeks = "normal" | "besar";

export type Preferensi = {
  // Pilihan siswa (bisa "sistem").
  tema: Tema;
  ukuran: UkuranTeks;
};

export type PreferensiTersimpan = Preferensi & {
  // Hasil resolusi "sistem" saat terakhir dihitung di browser.
  efektif: "terang" | "gelap";
};

export const PREFERENSI_BAWAAN: PreferensiTersimpan = {
  tema: "sistem",
  ukuran: "normal",
  efektif: "terang",
};

const TEMA_VALID: Tema[] = ["terang", "gelap", "sistem"];
const UKURAN_VALID: UkuranTeks[] = ["normal", "besar"];

// Baca cookie preferensi. Data rusak / tidak ada → nilai bawaan.
export function uraiCookieTampilan(
  mentah: string | undefined | null,
): PreferensiTersimpan {
  if (!mentah) return PREFERENSI_BAWAAN;

  try {
    const data = JSON.parse(mentah) as Partial<Record<keyof PreferensiTersimpan, unknown>>;

    const tema = TEMA_VALID.includes(data.tema as Tema)
      ? (data.tema as Tema)
      : PREFERENSI_BAWAAN.tema;
    const ukuran = UKURAN_VALID.includes(data.ukuran as UkuranTeks)
      ? (data.ukuran as UkuranTeks)
      : PREFERENSI_BAWAAN.ukuran;

    // Tema efektif harus konsisten dengan pilihan:
    //  - "terang"/"gelap" → pasti sama
    //  - "sistem"         → pakai hasil hitungan browser
    const efektif: "terang" | "gelap" =
      tema === "gelap"
        ? "gelap"
        : tema === "terang"
          ? "terang"
          : data.efektif === "gelap"
            ? "gelap"
            : "terang";

    return { tema, ukuran, efektif };
  } catch {
    return PREFERENSI_BAWAAN;
  }
}

export function serialisasiPreferensi(nilai: PreferensiTersimpan): string {
  return JSON.stringify({
    tema: nilai.tema,
    ukuran: nilai.ukuran,
    efektif: nilai.efektif,
  });
}
