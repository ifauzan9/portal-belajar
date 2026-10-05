"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { hashPassword } from "@/lib/hash-password";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_USERNAME = 50;
const MIN_PASSWORD = 6;

export type HasilAturKredensial = { message: string | null };

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

  // Cek apakah username sudah dipakai siswa lain.
  const { data: pakaiUsername } = await admin
    .from("student_accounts")
    .select("id, siswa_id")
    .ilike("username", username)
    .limit(1);

  const konflik = (pakaiUsername ?? []).find(
    (a) => a.siswa_id !== siswaId,
  );
  if (konflik) {
    return { message: "Username sudah dipakai siswa lain." };
  }

  const hash = hashPassword(password);

  if (pakaiUsername && pakaiUsername.length > 0) {
    // Sudah ada akun untuk siswa ini (atau username dipakai sendiri) → update.
    const akun = pakaiUsername[0];
    const { error } = await admin
      .from("student_accounts")
      .update({ username, password_hash: hash })
      .eq("id", akun.id);

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
  return { message: null };
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
