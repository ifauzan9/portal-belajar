"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { createAdminClient } from "@/lib/supabase/admin";

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

// ============================================================================
// TOKEN LOGIN SISWA PER KELAS
// Guru membuat/mengganti/menghapus token yang dipakai siswa untuk login.
// Tabel class_tokens hanya diakses server (service-role).
// ============================================================================

const PANJANG_TOKEN_MIN = 4;
const PANJANG_TOKEN_MAX = 32;

// Huruf yang mudah dibedakan saat dibacakan (tanpa 0/O/1/I).
const HURUF_TOKEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function buatTokenAcak(panjang = 6): string {
  let hasil = "";
  for (let i = 0; i < panjang; i += 1) {
    hasil += HURUF_TOKEN[Math.floor(Math.random() * HURUF_TOKEN.length)];
  }
  return hasil;
}

export type HasilTokenKelas = { message: string | null; sukses?: boolean };

// Simpan token manual untuk sebuah kelas (insert kalau belum ada, update
// kalau sudah ada). Field: kelas_id, token
export async function setTokenKelas(
  _prevState: HasilTokenKelas,
  formData: FormData,
): Promise<HasilTokenKelas> {
  const kelasId = String(formData.get("kelas_id") ?? "");
  const token = String(formData.get("token") ?? "").trim().toUpperCase();

  if (!kelasId) {
    return { message: "Data kelas tidak ditemukan." };
  }

  if (!token) {
    return { message: "Token wajib diisi." };
  }

  if (token.length < PANJANG_TOKEN_MIN || token.length > PANJANG_TOKEN_MAX) {
    return {
      message: `Token harus ${PANJANG_TOKEN_MIN}–${PANJANG_TOKEN_MAX} karakter.`,
    };
  }

  if (!/^[A-Z0-9]+$/.test(token)) {
    return { message: "Token hanya boleh huruf dan angka." };
  }

  await requireGuru();
  const admin = createAdminClient();

  const { error } = await admin
    .from("class_tokens")
    .upsert(
      { kelas_id: kelasId, token, diubah_at: new Date().toISOString() },
      { onConflict: "kelas_id" },
    );

  if (error) {
    return { message: `Gagal menyimpan token: ${error.message}` };
  }

  revalidatePath("/guru/kelas");
  return { message: "Token berhasil disimpan.", sukses: true };
}

// Buat token acak baru untuk kelas (mengganti yang lama).
export async function buatTokenBaru(
  _prevState: HasilTokenKelas,
  formData: FormData,
): Promise<HasilTokenKelas> {
  const kelasId = String(formData.get("kelas_id") ?? "");
  if (!kelasId) {
    return { message: "Data kelas tidak ditemukan." };
  }

  await requireGuru();
  const admin = createAdminClient();
  const token = buatTokenAcak();

  const { error } = await admin
    .from("class_tokens")
    .upsert(
      { kelas_id: kelasId, token, diubah_at: new Date().toISOString() },
      { onConflict: "kelas_id" },
    );

  if (error) {
    return { message: `Gagal membuat token: ${error.message}` };
  }

  revalidatePath("/guru/kelas");
  return { message: "Token baru berhasil dibuat.", sukses: true };
}

// Hapus token kelas (menonaktifkan login token untuk kelas itu).
export async function hapusTokenKelas(formData: FormData) {
  const kelasId = String(formData.get("kelas_id") ?? "");
  if (!kelasId) return;

  await requireGuru();
  const admin = createAdminClient();
  const { error } = await admin
    .from("class_tokens")
    .delete()
    .eq("kelas_id", kelasId);

  if (error) {
    console.error("Gagal menghapus token kelas:", error.message);
  }

  revalidatePath("/guru/kelas");
}
