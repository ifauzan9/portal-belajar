"use server";

import { cookies } from "next/headers";
import {
  NAMA_COOKIE_TAMPILAN,
  PREFERENSI_BAWAAN,
  serialisasiPreferensi,
  uraiCookieTampilan,
  UMUR_COOKIE_DETIK,
  type PreferensiTersimpan,
  type Tema,
  type UkuranTeks,
} from "@/lib/preferensi-siswa";

// ============================================================================
// Simpan preferensi tampilan siswa ke COOKIE.
//
// Kenapa cookie, bukan localStorage: tema perlu diketahui saat render server
// agar HTML pertama sudah bertema benar (tidak kedip). Cookie juga otomatis
// ikut terkirim, jadi tidak butuh skrip inline.
//
// Cookie ini hanya berisi preferensi tampilan — tidak ada data sensitif.
// ============================================================================

const TEMA_VALID: Tema[] = ["terang", "gelap", "sistem"];
const UKURAN_VALID: UkuranTeks[] = ["normal", "besar"];

export async function simpanTampilan(input: {
  tema: Tema;
  ukuran: UkuranTeks;
  efektif: "terang" | "gelap";
}): Promise<PreferensiTersimpan> {
  const store = await cookies();

  const lama = uraiCookieTampilan(store.get(NAMA_COOKIE_TAMPILAN)?.value);

  const tema = TEMA_VALID.includes(input.tema) ? input.tema : PREFERENSI_BAWAAN.tema;
  const ukuran = UKURAN_VALID.includes(input.ukuran)
    ? input.ukuran
    : PREFERENSI_BAWAAN.ukuran;

  const efektif: "terang" | "gelap" =
    tema === "gelap" ? "gelap" : tema === "terang" ? "terang" : input.efektif;

  const baru: PreferensiTersimpan = { tema, ukuran, efektif };

  // Hindari penulisan ulang bila nilainya sama (mengurangi respons cookie).
  if (
    lama.tema === baru.tema &&
    lama.ukuran === baru.ukuran &&
    lama.efektif === baru.efektif
  ) {
    return baru;
  }

  store.set(NAMA_COOKIE_TAMPILAN, serialisasiPreferensi(baru), {
    httpOnly: false, // boleh dibaca browser agar bisa ikut tema perangkat
    sameSite: "lax",
    path: "/",
    maxAge: UMUR_COOKIE_DETIK,
    secure: process.env.NODE_ENV === "production",
  });

  return baru;
}
