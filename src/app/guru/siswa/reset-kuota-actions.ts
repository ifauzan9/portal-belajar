"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { createAdminClient } from "@/lib/supabase/admin";
import { galatKolomKuotaBelumAda, resetKuotaSiswa } from "@/lib/kuota-harian";

export type HasilResetKuota = {
  message: string | null;
  sukses?: boolean;
};

// Guru mereset batas ganti password siswa (mengembalikan jatah penuh hari ini).
export async function resetKuotaPasswordSiswa(
  _prevState: HasilResetKuota,
  formData: FormData,
): Promise<HasilResetKuota> {
  const siswaId = String(formData.get("siswa_id") ?? "");
  if (!siswaId) {
    return { message: "Data siswa tidak ditemukan." };
  }

  await requireGuru();
  const admin = createAdminClient();

  // Cari akun siswa lewat siswa_id.
  const { data: akun, error: galatCari } = await admin
    .from("student_accounts")
    .select("id")
    .eq("siswa_id", siswaId)
    .maybeSingle();

  if (galatCari || !akun) {
    return {
      message: galatCari && galatKolomKuotaBelumAda(galatCari)
        ? "Fitur kuota belum aktif: jalankan schema Tahap 31 di Supabase terlebih dahulu."
        : "Akun login siswa tidak ditemukan.",
    };
  }

  const hasil = await resetKuotaSiswa(admin, akun.id);

  if (!hasil.sukses) {
    return { message: hasil.pesan };
  }

  revalidatePath("/guru/siswa");
  return { message: "Batas ganti password siswa telah direset.", sukses: true };
}