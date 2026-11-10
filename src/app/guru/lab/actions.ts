"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { bacaKelasDariForm } from "@/lib/pilih-kelas";

// ============================================================================
// Atur target kelas sebuah modul lab (kosong = semua kelas).
// ============================================================================

export type HasilKelasLab = { message: string | null; sukses: boolean };

export async function simpanKelasLab(
  _prevState: HasilKelasLab,
  formData: FormData,
): Promise<HasilKelasLab> {
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  if (!lessonId) {
    return { message: "Modul tidak ditemukan.", sukses: false };
  }

  const daftarKelasId = bacaKelasDariForm(formData);

  const supabase = await requireGuru();

  // Ganti hubungan lama dengan pilihan terbaru.
  const { error: hapusError } = await supabase
    .from("coding_lesson_classes")
    .delete()
    .eq("lesson_id", lessonId);

  if (hapusError) {
    return { message: `Gagal memperbarui kelas: ${hapusError.message}`, sukses: false };
  }

  if (daftarKelasId.length > 0) {
    const { error } = await supabase.from("coding_lesson_classes").insert(
      daftarKelasId.map((kelasId) => ({
        lesson_id: lessonId,
        kelas_id: kelasId,
      })),
    );

    if (error) {
      return { message: `Gagal menyimpan kelas: ${error.message}`, sukses: false };
    }
  }

  revalidatePath("/guru/lab");
  revalidatePath("/siswa/lab");

  return { message: null, sukses: true };
}

// ============================================================================
// Saklar blokir paste/drop di editor Python untuk satu modul lab.
// Default nonaktif (kolom Tahap 39). Kalau kolom belum ada, update gagal dan
// hanya dicatat di log — halaman guru tetap tampil.
// ============================================================================

export async function toggleBlokirTempelLab(formData: FormData) {
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  if (!lessonId) return;

  const supabase = await requireGuru();

  const { data, error } = await supabase
    .from("coding_lessons")
    .select("blokir_tempel")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca status blokir_tempel:", error.message);
    return;
  }

  const blokirSekarang = data?.blokir_tempel === true;
  const { error: galatUpdate } = await supabase
    .from("coding_lessons")
    .update({ blokir_tempel: !blokirSekarang })
    .eq("id", lessonId);

  if (galatUpdate) {
    console.error("Gagal membalik status blokir_tempel:", galatUpdate.message);
    return;
  }

  revalidatePath("/guru/lab");
  revalidatePath("/siswa/lab");
}

// ============================================================================
// Saklar tutup per modul Lab Coding (Tahap 42).
//
// `dibuka = false` berarti siswa tidak bisa membuka modul maupun levelnya,
// termasuk lewat URL langsung. Progres & hasil yang sudah tersimpan tetap aman
// dan tetap terlihat di halaman guru. Modul lain tidak terpengaruh.
//
// Kalau kolom `dibuka` belum ada (DDL Tahap 42 belum dijalankan), update
// gagal dan hanya dicatat di log — halaman guru tetap tampil.
// ============================================================================

export async function toggleModulLab(formData: FormData) {
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  if (!lessonId) return;

  const supabase = await requireGuru();

  const { data, error } = await supabase
    .from("coding_lessons")
    .select("dibuka")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca status dibuka modul lab:", error.message);
    return;
  }

  // null (kolom baru, baris lama) dianggap terbuka.
  const dibukaSekarang = (data as { dibuka?: boolean | null } | null)?.dibuka !== false;

  const { error: galatUpdate } = await supabase
    .from("coding_lessons")
    .update({ dibuka: !dibukaSekarang })
    .eq("id", lessonId);

  if (galatUpdate) {
    console.error("Gagal membalik status dibuka modul lab:", galatUpdate.message);
    return;
  }

  revalidatePath("/guru/lab");
  revalidatePath("/guru/lab/hasil");
  revalidatePath("/siswa");
  revalidatePath("/siswa/lab");
}
