"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";

export async function addKelas(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const namaKelas = String(formData.get("nama_kelas") ?? "").trim();

  if (!namaKelas) {
    return { message: "Nama kelas wajib diisi." };
  }

  const supabase = await requireGuru();
  const { error } = await supabase.from("classes").insert({
    nama_kelas: namaKelas,
  });

  if (error) {
    return { message: `Gagal menambah kelas: ${error.message}` };
  }

  revalidatePath("/guru/kelas");
  return { message: null };
}

export async function updateKelas(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const id = String(formData.get("id") ?? "");
  const namaKelas = String(formData.get("nama_kelas") ?? "").trim();

  if (!id) {
    return { message: "Data kelas tidak ditemukan." };
  }

  if (!namaKelas) {
    return { message: "Nama kelas wajib diisi." };
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("classes")
    .update({ nama_kelas: namaKelas })
    .eq("id", id)
    .select("id");

  if (error) {
    return { message: `Gagal mengubah kelas: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return {
      message:
        "Gagal mengubah kelas. Jalankan lagi schema.sql supaya izin update aktif.",
    };
  }

  revalidatePath("/guru/kelas");
  return { message: null };
}

export async function deleteKelas(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();
  const { error } = await supabase.from("classes").delete().eq("id", id);

  if (error) {
    console.error("Gagal menghapus kelas:", error.message);
  }

  revalidatePath("/guru/kelas");
}
