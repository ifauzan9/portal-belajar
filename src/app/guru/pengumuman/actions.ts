"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { bacaKelasDariForm } from "@/lib/pilih-kelas";
import { parseWaktuMulai } from "@/lib/jadwal-pengumuman";

const MAX_JUDUL = 200;
const MAX_ISI = 5000;

async function simpanKelas(
  supabase: Awaited<ReturnType<typeof requireGuru>>,
  pengumumanId: string,
  daftarKelasId: string[],
) {
  // Kosongkan dulu hubungan lama, baru isi ulang dengan pilihan terbaru
  // (update = hapus + sisipkan, karena relasi banyak-ke-banyak).
  if (daftarKelasId.length > 0) {
    const { error } = await supabase
      .from("announcement_classes")
      .upsert(
        daftarKelasId.map((kelasId) => ({
          pengumuman_id: pengumumanId,
          kelas_id: kelasId,
        })),
      );

    if (error) {
      throw new Error(`gagal menyimpan hubungan kelas: ${error.message}`);
    }
  } else {
    // "Semua kelas" = tidak ada baris hubungan
    const { error } = await supabase
      .from("announcement_classes")
      .delete()
      .eq("pengumuman_id", pengumumanId);

    if (error) {
      throw new Error(`gagal menghapus hubungan kelas: ${error.message}`);
    }
  }
}

export async function addPengumuman(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const judul = String(formData.get("judul") ?? "").trim();
  const isi = String(formData.get("isi") ?? "").trim();
  const daftarKelasId = bacaKelasDariForm(formData);
  const mulai = parseWaktuMulai(String(formData.get("mulai_pada") ?? ""));

  if (!judul) {
    return { message: "Judul wajib diisi." };
  }

  if (judul.length > MAX_JUDUL) {
    return { message: `Judul maksimal ${MAX_JUDUL} karakter.` };
  }

  if (!isi) {
    return { message: "Isi pengumuman wajib diisi." };
  }

  if (isi.length > MAX_ISI) {
    return { message: `Isi pengumuman maksimal ${MAX_ISI} karakter.` };
  }

  if (!mulai.ok) {
    return { message: "Format waktu mulai tampil tidak valid." };
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("announcements")
    .insert({ judul, isi, mulai_pada: mulai.iso })
    .select("id")
    .single();

  if (error) {
    return { message: `Gagal menambah pengumuman: ${error.message}` };
  }

  try {
    await simpanKelas(supabase, data.id, daftarKelasId);
  } catch {
    // Rollback sederhana: pengumuman baru hapus juga kalau hubungannya gagal
    const { id: idBaru } = data;
    await supabase.from("announcements").delete().eq("id", idBaru);
    return {
      message:
        "Pengumuman tersimpan, tapi gagal mengatur kelasnya. " +
        "Jalankan dulu bagian DDL terbaru di Supabase SQL Editor.",
    };
  }

  revalidatePath("/guru/pengumuman");
  return { message: null };
}

export async function updatePengumuman(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const id = String(formData.get("id") ?? "");
  const judul = String(formData.get("judul") ?? "").trim();
  const isi = String(formData.get("isi") ?? "").trim();
  const daftarKelasId = bacaKelasDariForm(formData);
  const mulai = parseWaktuMulai(String(formData.get("mulai_pada") ?? ""));

  if (!id) {
    return { message: "Data pengumuman tidak ditemukan." };
  }

  if (!judul) {
    return { message: "Judul wajib diisi." };
  }

  if (judul.length > MAX_JUDUL) {
    return { message: `Judul maksimal ${MAX_JUDUL} karakter.` };
  }

  if (!isi) {
    return { message: "Isi pengumuman wajib diisi." };
  }

  if (isi.length > MAX_ISI) {
    return { message: `Isi pengumuman maksimal ${MAX_ISI} karakter.` };
  }

  if (!mulai.ok) {
    return { message: "Format waktu mulai tampil tidak valid." };
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("announcements")
    .update({ judul, isi, mulai_pada: mulai.iso })
    .eq("id", id)
    .select("id");

  if (error) {
    return { message: `Gagal mengubah pengumuman: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return {
      message:
        "Gagal mengubah pengumuman. Jalankan lagi schema.sql supaya izin update aktif.",
    };
  }

  try {
    await simpanKelas(supabase, id, daftarKelasId);
  } catch {
    return {
      message:
        "Judul dan isi sudah tersimpan, tapi gagal mengatur kelasnya. " +
        "Jalankan dulu bagian DDL terbaru di Supabase SQL Editor.",
    };
  }

  revalidatePath("/guru/pengumuman");
  return { message: null };
}

export async function deletePengumuman(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Gagal menghapus pengumuman:", error.message);
  }

  revalidatePath("/guru/pengumuman");
}
