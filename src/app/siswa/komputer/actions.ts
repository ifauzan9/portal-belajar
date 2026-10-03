"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ambilSesiSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Simpan hasil tantangan Lab Komputer. Dipanggil setiap kali siswa menjawab
// (benar/salah). Hasil lama ditimpa; `pernah_benar` dipakai untuk progres.
// ============================================================================

export type HasilSimpanKomputer = {
  sukses: boolean;
  message: string | null;
  percobaan: number;
  pernahBenar: boolean;
};

export async function simpanHasilKomputer(input: {
  challengeId: string;
  benar: boolean;
  waktuMs?: number | null;
  skor?: number | null;
}): Promise<HasilSimpanKomputer> {
  const sesi = await ambilSesiSiswa();
  if (!sesi) redirect("/login-siswa");

  const challengeId = String(input.challengeId ?? "").trim();
  if (!challengeId) {
    return {
      sukses: false,
      message: "Tantangan tidak ditemukan.",
      percobaan: 0,
      pernahBenar: false,
    };
  }

  const supabase = await createClient();

  const { data: lama } = await supabase
    .from("komputer_hasil")
    .select("percobaan, pernah_benar, waktu_ms, skor")
    .eq("challenge_id", challengeId)
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  const dataLama = lama as
    | {
        percobaan: number | null;
        pernah_benar: boolean | null;
        waktu_ms: number | null;
        skor: number | null;
      }
    | null;

  const percobaanLama = dataLama?.percobaan ?? 0;
  const pernahLama = dataLama?.pernah_benar ?? false;
  const percobaanBaru = percobaanLama + 1;
  const pernahBaru = pernahLama || Boolean(input.benar);

  // Simpan waktu tercepat & skor terbaik (hanya saat benar).
  let waktuBaru = dataLama?.waktu_ms ?? null;
  if (
    input.benar &&
    input.waktuMs != null &&
    (waktuBaru == null || input.waktuMs < waktuBaru)
  ) {
    waktuBaru = input.waktuMs;
  }
  let skorBaru = dataLama?.skor ?? null;
  if (
    input.benar &&
    input.skor != null &&
    (skorBaru == null || input.skor > skorBaru)
  ) {
    skorBaru = input.skor;
  }

  const { error } = await supabase.from("komputer_hasil").upsert(
    {
      challenge_id: challengeId,
      siswa_id: sesi.siswaId,
      benar: Boolean(input.benar),
      pernah_benar: pernahBaru,
      percobaan: percobaanBaru,
      waktu_ms: waktuBaru,
      skor: skorBaru,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "challenge_id,siswa_id" },
  );

  if (error) {
    return {
      sukses: false,
      message: `Gagal menyimpan hasil: ${error.message}`,
      percobaan: percobaanLama,
      pernahBenar: pernahLama,
    };
  }

  revalidatePath("/siswa/komputer");
  revalidatePath("/guru/komputer/hasil");

  return {
    sukses: true,
    message: null,
    percobaan: percobaanBaru,
    pernahBenar: pernahBaru,
  };
}
