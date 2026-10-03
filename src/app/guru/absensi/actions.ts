"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { bacaStatusAbsensi, bacaTanggal } from "@/lib/absensi";

export async function simpanAbsensi(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const kelasId = String(formData.get("kelas_id") ?? "").trim();
  const tanggal = bacaTanggal(formData.get("tanggal"));

  if (!kelasId) {
    return { message: "Kelas tidak ditemukan." };
  }

  if (!tanggal) {
    return { message: "Tanggal tidak valid." };
  }

  const supabase = await requireGuru();

  // Daftar siswa diambil di server — daftar dari klien tidak dipercaya.
  const { data: siswaData, error: siswaError } = await supabase
    .from("students")
    .select("id")
    .eq("kelas_id", kelasId);

  if (siswaError) {
    return { message: `Gagal memuat siswa: ${siswaError.message}` };
  }

  const tercatat = new Date().toISOString();
  const baris = (siswaData ?? []).flatMap((s) => {
    const status = bacaStatusAbsensi(formData.get(`status_${s.id}`));
    if (!status) return [];
    return [
      {
        kelas_id: kelasId,
        siswa_id: s.id,
        tanggal,
        status,
        updated_at: tercatat,
      },
    ];
  });

  if (baris.length === 0) {
    return { message: "Tidak ada status yang bisa disimpan." };
  }

  const { error } = await supabase
    .from("attendance")
    .upsert(baris, { onConflict: "siswa_id,tanggal" });

  if (error) {
    return { message: `Gagal menyimpan absensi: ${error.message}` };
  }

  revalidatePath("/guru/absensi");
  return { message: null };
}

export async function hapusAbsensiTanggal(formData: FormData) {
  const kelasId = String(formData.get("kelas_id") ?? "").trim();
  const tanggal = bacaTanggal(formData.get("tanggal"));
  if (!kelasId || !tanggal) return;

  const supabase = await requireGuru();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("kelas_id", kelasId)
    .eq("tanggal", tanggal);

  if (error) {
    console.error("Gagal menghapus absensi:", error.message);
  }

  revalidatePath("/guru/absensi");
}
