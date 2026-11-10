"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { MAKS_PESAN_TUTUP } from "@/lib/pengaturan-soal";

// ============================================================================
// Simpan pengaturan global "tutup akses soal" (Tahap 41).
//
// Satu baris tabel pengaturan_guru (id = 1). Upsert dipakai supaya tombol
// simpan tetap bekerja walau baris belum ada (mis. DDL dijalankan sebagian).
// ============================================================================

export type HasilPengaturanSoal = {
  message: string | null;
  sukses: boolean;
};

export async function simpanPengaturanSoal(
  _prevState: HasilPengaturanSoal,
  formData: FormData,
): Promise<HasilPengaturanSoal> {
  const tutupUlangan = formData.get("tutup_ulangan") === "on";
  const tutupLab = formData.get("tutup_lab") === "on";
  const pesanMentah = String(formData.get("pesan_tutup") ?? "").trim();

  if (pesanMentah.length > MAKS_PESAN_TUTUP) {
    return {
      message: `Pesan terlalu panjang (maks ${MAKS_PESAN_TUTUP} karakter).`,
      sukses: false,
    };
  }

  const supabase = await requireGuru();

  const { error } = await supabase.from("pengaturan_guru").upsert(
    {
      id: 1,
      tutup_soal_ulangan: tutupUlangan,
      tutup_soal_lab: tutupLab,
      pesan_tutup: pesanMentah || null,
      diperbarui_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return {
      message:
        error.message.includes("pengaturan_guru") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
          ? "Tabel pengaturan belum ada. Jalankan schema.sql Tahap 41 di Supabase."
          : `Gagal menyimpan pengaturan: ${error.message}`,
      sukses: false,
    };
  }

  revalidatePath("/guru/pengaturan");
  revalidatePath("/guru");
  revalidatePath("/guru/ulangan");
  revalidatePath("/guru/lab");
  revalidatePath("/siswa");
  revalidatePath("/siswa/ulangan");
  revalidatePath("/siswa/nilai");
  revalidatePath("/siswa/lab");

  return { message: null, sukses: true };
}
