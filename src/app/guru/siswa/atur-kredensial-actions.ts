"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { hashPassword } from "@/lib/hash-password";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_USERNAME = 50;
const MIN_PASSWORD = 6;

export type HasilAturKredensial = {
  message: string | null;
  // Pesan sukses terpisah dari error, supaya UI bisa menampilkannya hijau.
  sukses?: boolean;
};

// Guru atur kredensial login siswa (username + password).
// Field: siswa_id, username, password
// Kalau siswa sudah punya akun → update; kalau belum → insert.
export async function aturKredensialSiswa(
  _prevState: HasilAturKredensial,
  formData: FormData,
): Promise<HasilAturKredensial> {
  const siswaId = String(formData.get("siswa_id") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!siswaId) {
    return { message: "Data siswa tidak ditemukan." };
  }

  if (!username) {
    return { message: "Username wajib diisi." };
  }

  if (username.length > MAX_USERNAME) {
    return { message: `Username maksimal ${MAX_USERNAME} karakter.` };
  }

  if (username.length < 3) {
    return { message: "Username minimal 3 karakter." };
  }

  if (password.length < MIN_PASSWORD) {
    return { message: `Password minimal ${MIN_PASSWORD} karakter.` };
  }

  await requireGuru();
  const admin = createAdminClient();

  // Cek apakah username sudah dipakai siswa LAIN (bukan siswa ini).
  // Pengecekan harus mengecualikan siswa_id ini, supaya saat guru mengedit
  // username siswa yang sudah punya akun tidak salah dianggap konflik.
  const { data: pakaiUsername } = await admin
    .from("student_accounts")
    .select("id")
    .ilike("username", username)
    .neq("siswa_id", siswaId)
    .limit(1);

  if (pakaiUsername && pakaiUsername.length > 0) {
    return { message: "Username sudah dipakai siswa lain." };
  }

  const hash = hashPassword(password);

  // Cek apakah siswa ini sudah punya akun → tentukan update atau insert.
  const { data: akunSiswa } = await admin
    .from("student_accounts")
    .select("id")
    .eq("siswa_id", siswaId)
    .maybeSingle();

  if (akunSiswa) {
    // Sudah ada akun untuk siswa ini → update.
    const { error } = await admin
      .from("student_accounts")
      .update({ username, password_hash: hash })
      .eq("id", akunSiswa.id);

    if (error) {
      return { message: `Gagal menyimpan kredensial: ${error.message}` };
    }
  } else {
    const { error } = await admin
      .from("student_accounts")
      .insert({ siswa_id: siswaId, username, password_hash: hash });

    if (error) {
      if (error.code === "23505") {
        return { message: "Username sudah dipakai siswa lain." };
      }
      return { message: `Gagal membuat kredensial: ${error.message}` };
    }
  }

  revalidatePath("/guru/siswa");
  return { message: "Username berhasil disimpan.", sukses: true };
}

// Hapus akun login siswa (kalau guru ingin nonaktifkan).
export async function hapusKredensialSiswa(formData: FormData) {
  const siswaId = String(formData.get("siswa_id") ?? "");
  if (!siswaId) return;

  await requireGuru();
  const admin = createAdminClient();
  const { error } = await admin
    .from("student_accounts")
    .delete()
    .eq("siswa_id", siswaId);

  if (error) {
    console.error("Gagal menghapus kredensial siswa:", error.message);
  }

  revalidatePath("/guru/siswa");
}

// ============================================================================
// Nonaktifkan / aktifkan akun siswa (tanpa menghapus data).
// Field: siswa_id, aktifkan (boolean: true = aktifkan, false = nonaktifkan)
// ============================================================================
export type HasilToggleAkun = { message: string | null };

export async function toggleAkunSiswa(
  _prevState: HasilToggleAkun,
  formData: FormData,
): Promise<HasilToggleAkun> {
  const siswaId = String(formData.get("siswa_id") ?? "");
  if (!siswaId) {
    return { message: "Data siswa tidak ditemukan." };
  }

  const nilaiAktifkan = formData.get("aktifkan") === "true";

  await requireGuru();
  const admin = createAdminClient();

  const { error } = await admin
    .from("student_accounts")
    .update({ is_active: nilaiAktifkan })
    .eq("siswa_id", siswaId);

  if (error) {
    return { message: `Gagal mengubah status akun: ${error.message}` };
  }

  revalidatePath("/guru/siswa");
  return { message: null };
}
