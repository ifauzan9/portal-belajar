"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/hash-password";
import { ambilSesiSiswa, hapusSesiSesi } from "@/lib/sesi-siswa";
import { cekKuota, pakaiKuota } from "@/lib/kuota-harian";
import {
  MAKS_GANTI_PASSWORD_HARIAN,
  kunciKuotaPassword,
} from "@/lib/kuota-password";

// ============================================================================
// Ganti password dari halaman PROFIL siswa.
//
// Perbedaan dengan gantiPassword() di src/app/siswa/actions.ts:
//  - TIDAK meminta password lama (siswa dianggap sudah terautentikasi lewat
//    cookie sesi).
//  - Dibatasi 3x per hari per akun.
//  - Password asli tidak pernah dikembalikan ke browser: hasil hanya berisi
//    pesan + sisa kuota.
//
// Field form: password_baru, password_konfirmasi
// ============================================================================

export type HasilGantiPasswordProfil = {
  message: string | null;
  sukses: boolean;
  sisaKuota: number;
  maksKuota: number;
};

export async function gantiPasswordProfil(
  _prevState: HasilGantiPasswordProfil,
  formData: FormData,
): Promise<HasilGantiPasswordProfil> {
  const admin = createAdminClient();
  const sesi = await ambilSesiSiswa();

  if (!sesi) {
    redirect("/login-siswa");
  }

  // Akun dicari lewat siswa_id (unik) supaya tetap ketemu walau sesi lama
  // masih memakai username "token:<kelasId>".
  const { data: account } = await admin
    .from("student_accounts")
    .select("id, username, is_active")
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  const accountRow = account as {
    id: string;
    username: string;
    is_active: boolean;
  } | null;

  // Tanpa akun / akun nonaktif → sesi tidak berlaku lagi.
  if (!accountRow || !accountRow.is_active) {
    await hapusSesiSesi();
    redirect("/login-siswa");
  }

  // Kuota dikunci per USERNAME ASLI, bukan per username sesi, supaya tidak
  // pernah jatuh ke kunci "token:<kelasId>" yang dibagi seluruh kelas.
  const kunciAkun = kunciKuotaPassword(accountRow.username);
  const kuota = cekKuota(kunciAkun, MAKS_GANTI_PASSWORD_HARIAN);
  if (!kuota.boleh) {
    return {
      message:
        "Batas ganti password sudah tercapai (3x per hari). Coba lagi besok.",
      sukses: false,
      sisaKuota: kuota.sisa,
      maksKuota: kuota.maks,
    };
  }

  const passwordBaru = String(formData.get("password_baru") ?? "");
  const passwordKonfirmasi = String(formData.get("password_konfirmasi") ?? "");

  if (passwordBaru.length < 6) {
    return {
      message: "Password baru minimal 6 karakter.",
      sukses: false,
      sisaKuota: kuota.sisa,
      maksKuota: kuota.maks,
    };
  }

  if (passwordBaru !== passwordKonfirmasi) {
    return {
      message: "Konfirmasi password tidak cocok.",
      sukses: false,
      sisaKuota: kuota.sisa,
      maksKuota: kuota.maks,
    };
  }

  const hashBaru = hashPassword(passwordBaru);
  const { error } = await admin
    .from("student_accounts")
    .update({ password_hash: hashBaru })
    .eq("id", accountRow.id);

  if (error) {
    return {
      message: `Gagal menyimpan: ${error.message}`,
      sukses: false,
      sisaKuota: kuota.sisa,
      maksKuota: kuota.maks,
    };
  }

  // Kuota dipotong hanya saat berhasil, supaya salah ketik tidak memakan jatah.
  const setelah = pakaiKuota(kunciAkun, MAKS_GANTI_PASSWORD_HARIAN);

  revalidatePath("/siswa");
  revalidatePath("/siswa/profil");

  return {
    message: "Password berhasil diganti.",
    sukses: true,
    sisaKuota: setelah.sisa,
    maksKuota: setelah.maks,
  };
}
