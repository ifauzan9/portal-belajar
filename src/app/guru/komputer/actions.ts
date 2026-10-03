"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { bacaKelasDariForm } from "@/lib/pilih-kelas";

// ============================================================================
// Atur target kelas sebuah modul Lab Komputer (kosong = semua kelas).
// ============================================================================

export type HasilKelasKomputer = { message: string | null; sukses: boolean };

export async function simpanKelasKomputer(
  _prevState: HasilKelasKomputer,
  formData: FormData,
): Promise<HasilKelasKomputer> {
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  if (!lessonId) {
    return { message: "Modul tidak ditemukan.", sukses: false };
  }

  const daftarKelasId = bacaKelasDariForm(formData);
  const supabase = await requireGuru();

  const { error: hapusError } = await supabase
    .from("komputer_lesson_classes")
    .delete()
    .eq("lesson_id", lessonId);

  if (hapusError) {
    return {
      message: `Gagal memperbarui kelas: ${hapusError.message}`,
      sukses: false,
    };
  }

  if (daftarKelasId.length > 0) {
    const { error } = await supabase.from("komputer_lesson_classes").insert(
      daftarKelasId.map((kelasId) => ({
        lesson_id: lessonId,
        kelas_id: kelasId,
      })),
    );

    if (error) {
      return { message: `Gagal menyimpan kelas: ${error.message}`, sukses: false };
    }
  }

  revalidatePath("/guru/komputer");
  revalidatePath("/siswa/komputer");

  return { message: null, sukses: true };
}
