"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ambilSesiSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Simpan hasil terakhir siswa untuk satu latihan lab. Dipanggil setiap kali
// siswa menekan "Jalankan" (hasil lama ditimpa).
// ============================================================================

export type HasilSimpanLab = {
  sukses: boolean;
  message: string | null;
  percobaan: number;
  pernahBenar: boolean;
};

export async function simpanHasilLab(input: {
  exerciseId: string;
  kode: string;
  keluaran: string;
  benar: boolean;
}): Promise<HasilSimpanLab> {
  const sesi = await ambilSesiSiswa();
  if (!sesi) redirect("/login-siswa");

  const exerciseId = String(input.exerciseId ?? "").trim();
  if (!exerciseId) {
    return {
      sukses: false,
      message: "Latihan tidak ditemukan.",
      percobaan: 0,
      pernahBenar: false,
    };
  }

  const supabase = await createClient();

  const { data: lama } = await supabase
    .from("coding_submissions")
    .select("percobaan, pernah_benar")
    .eq("exercise_id", exerciseId)
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  const dataLama = lama as
    | { percobaan: number | null; pernah_benar: boolean | null }
    | null;

  const percobaanLama = dataLama?.percobaan ?? 0;
  const pernahLama = dataLama?.pernah_benar ?? false;
  const percobaanBaru = percobaanLama + 1;
  const pernahBenarBaru = pernahLama || Boolean(input.benar);

  const { error } = await supabase.from("coding_submissions").upsert(
    {
      exercise_id: exerciseId,
      siswa_id: sesi.siswaId,
      kode: String(input.kode ?? ""),
      keluaran: String(input.keluaran ?? ""),
      benar: Boolean(input.benar),
      pernah_benar: pernahBenarBaru,
      percobaan: percobaanBaru,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "exercise_id,siswa_id" },
  );

  if (error) {
    return {
      sukses: false,
      message: `Gagal menyimpan hasil: ${error.message}`,
      percobaan: percobaanLama,
      pernahBenar: pernahLama,
    };
  }

  revalidatePath("/siswa/lab");
  revalidatePath("/guru/lab/hasil");

  return {
    sukses: true,
    message: null,
    percobaan: percobaanBaru,
    pernahBenar: pernahBenarBaru,
  };
}
