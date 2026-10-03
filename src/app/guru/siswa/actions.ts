"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";

const MAX_NIS = 50;
const MAX_NAMA = 200;

function bacaForm(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nis = String(formData.get("nis") ?? "").trim();
  const namaSiswa = String(formData.get("nama_siswa") ?? "").trim();
  const kelasId = String(formData.get("kelas_id") ?? "").trim();

  return { id, nis, namaSiswa, kelasId: kelasId ? kelasId : null };
}

function pesanGagal(
  error: { code?: string; message: string },
  aksi: string,
): string {
  if (error.code === "23505") {
    return "NIS sudah dipakai siswa lain.";
  }
  return `Gagal ${aksi} siswa: ${error.message}`;
}

export async function addSiswa(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const { nis, namaSiswa, kelasId } = bacaForm(formData);

  if (!nis) {
    return { message: "NIS wajib diisi." };
  }

  if (nis.length > MAX_NIS) {
    return { message: `NIS maksimal ${MAX_NIS} karakter.` };
  }

  if (!namaSiswa) {
    return { message: "Nama siswa wajib diisi." };
  }

  if (namaSiswa.length > MAX_NAMA) {
    return { message: `Nama siswa maksimal ${MAX_NAMA} karakter.` };
  }

  const supabase = await requireGuru();
  const { error } = await supabase.from("students").insert({
    nis,
    nama_siswa: namaSiswa,
    kelas_id: kelasId,
  });

  if (error) {
    return { message: pesanGagal(error, "menambah") };
  }

  revalidatePath("/guru/siswa");
  return { message: null };
}

export async function updateSiswa(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const { id, nis, namaSiswa, kelasId } = bacaForm(formData);

  if (!id) {
    return { message: "Data siswa tidak ditemukan." };
  }

  if (!nis) {
    return { message: "NIS wajib diisi." };
  }

  if (nis.length > MAX_NIS) {
    return { message: `NIS maksimal ${MAX_NIS} karakter.` };
  }

  if (!namaSiswa) {
    return { message: "Nama siswa wajib diisi." };
  }

  if (namaSiswa.length > MAX_NAMA) {
    return { message: `Nama siswa maksimal ${MAX_NAMA} karakter.` };
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("students")
    .update({ nis, nama_siswa: namaSiswa, kelas_id: kelasId })
    .eq("id", id)
    .select("id");

  if (error) {
    return { message: pesanGagal(error, "mengubah") };
  }

  if (!data || data.length === 0) {
    return {
      message:
        "Gagal mengubah siswa. Jalankan lagi schema.sql supaya izin update aktif.",
    };
  }

  revalidatePath("/guru/siswa");
  return { message: null };
}

export async function deleteSiswa(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();
  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    console.error("Gagal menghapus siswa:", error.message);
  }

  revalidatePath("/guru/siswa");
}

// ============================================================================
// Aksi massal untuk siswa terpilih (dari checkbox di halaman Data Siswa).
// Field: `ids` (boleh banyak), `aksi` = salah satu:
//   aktifkan | nonaktifkan | hapus-akun | hapus-siswa
// ============================================================================

export type HasilAksiSiswaBanyak = {
  message: string | null;
  sukses: boolean;
  info: string | null;
};

export async function aksiSiswaBanyak(
  _prevState: HasilAksiSiswaBanyak,
  formData: FormData,
): Promise<HasilAksiSiswaBanyak> {
  const aksi = String(formData.get("aksi") ?? "");
  const ids = formData
    .getAll("ids")
    .map((nilai) => String(nilai))
    .filter(Boolean);

  if (ids.length === 0) {
    return { message: "Tidak ada siswa yang dipilih.", sukses: false, info: null };
  }

  const supabase = await requireGuru();

  if (aksi === "aktifkan" || aksi === "nonaktifkan") {
    const aktif = aksi === "aktifkan";
    const { error, count } = await supabase
      .from("student_accounts")
      .update({ is_active: aktif }, { count: "exact" })
      .in("siswa_id", ids);

    if (error) {
      return {
        message: `Gagal mengubah status akun: ${error.message}`,
        sukses: false,
        info: null,
      };
    }

    revalidatePath("/guru/siswa");
    return {
      message: null,
      sukses: true,
      info: `${count ?? 0} akun ${aktif ? "diaktifkan" : "dinonaktifkan"}.`,
    };
  }

  if (aksi === "hapus-akun") {
    const { error, count } = await supabase
      .from("student_accounts")
      .delete({ count: "exact" })
      .in("siswa_id", ids);

    if (error) {
      return {
        message: `Gagal menghapus akun: ${error.message}`,
        sukses: false,
        info: null,
      };
    }

    revalidatePath("/guru/siswa");
    return {
      message: null,
      sukses: true,
      info: `${count ?? 0} akun login dihapus (siswa tetap ada).`,
    };
  }

  if (aksi === "hapus-siswa") {
    const { error, count } = await supabase
      .from("students")
      .delete({ count: "exact" })
      .in("id", ids);

    if (error) {
      return {
        message: `Gagal menghapus siswa: ${error.message}`,
        sukses: false,
        info: null,
      };
    }

    revalidatePath("/guru/siswa");
    revalidatePath("/guru");
    return {
      message: null,
      sukses: true,
      info: `${count ?? 0} siswa dihapus.`,
    };
  }

  return { message: "Aksi tidak dikenal.", sukses: false, info: null };
}
