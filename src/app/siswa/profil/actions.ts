"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/hash-password";
import { ambilSesiSiswa, hapusSesiSesi } from "@/lib/sesi-siswa";
import { kembalikanKuota, pakaiKuota } from "@/lib/kuota-harian";
import {
  MAKS_GANTI_PASSWORD_HARIAN,
  PESAN_KUOTA_HABIS,
  pesanKuotaTidakSiap,
  sisaKuotaPassword,
} from "@/lib/kuota-password";

// ============================================================================
// Ganti password dari halaman PROFIL siswa.
//
// Perbedaan dengan gantiPassword() di src/app/siswa/actions.ts:
//  - TIDAK meminta password lama (siswa dianggap sudah terautentikasi lewat
//    cookie sesi).
//  - Dibatasi 3x per hari per AKUN, dihitung di database (Tahap 31).
//  - Password asli tidak pernah dikembalikan ke browser: hasil hanya berisi
//    pesan + sisa kuota.
//
// Urutan penting:
//  1. Validasi sesi & isian form.
//  2. Baru potong kuota (atomik di database).
//  3. Simpan hash password.
//  4. Kalau penyimpanan gagal, kuota dikembalikan (best-effort).
//
// Dengan begitu salah ketik (terlalu pendek / konfirmasi beda / kuota habis)
// tidak memakan jatah.
//
// Field form: password_baru, password_konfirmasi
// ============================================================================

// Pesan saat kuota tidak bisa dihitung ada di @/lib/kuota-password, supaya
// halaman profil dan jalur ganti password lama memakai kalimat yang sama.

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
    .select("id, is_active")
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  const accountRow = account as { id: string; is_active: boolean } | null;

  // Tanpa akun / akun nonaktif → sesi tidak berlaku lagi.
  if (!accountRow || !accountRow.is_active) {
    await hapusSesiSesi();
    redirect("/login-siswa");
  }

  const kuota = await sisaKuotaPassword(admin, accountRow.id);

  // Kuota tidak terbaca → jangan tampilkan "kuota habis" (menyesatkan).
  if (!kuota.siap) {
    return {
      message: pesanKuotaTidakSiap(kuota.alasan),
      sukses: false,
      sisaKuota: 0,
      maksKuota: MAKS_GANTI_PASSWORD_HARIAN,
    };
  }

  const passwordBaru = String(formData.get("password_baru") ?? "");
  const passwordKonfirmasi = String(formData.get("password_konfirmasi") ?? "");

  // Validasi isian DULU, sebelum kuota dipotong.
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

  if (!kuota.boleh) {
    return {
      message: PESAN_KUOTA_HABIS,
      sukses: false,
      sisaKuota: kuota.sisa,
      maksKuota: kuota.maks,
    };
  }

  // Potong kuota secara atomik SEBELUM menyimpan. Kalau ada dua tab yang
  // submit bersamaan, hanya satu yang lolos di sini.
  const setelahPakai = await pakaiKuota(
    admin,
    accountRow.id,
    MAKS_GANTI_PASSWORD_HARIAN,
  );

  if (!setelahPakai.siap) {
    return {
      message: pesanKuotaTidakSiap(setelahPakai.alasan),
      sukses: false,
      sisaKuota: 0,
      maksKuota: MAKS_GANTI_PASSWORD_HARIAN,
    };
  }

  if (!setelahPakai.boleh) {
    return {
      message: PESAN_KUOTA_HABIS,
      sukses: false,
      sisaKuota: setelahPakai.sisa,
      maksKuota: setelahPakai.maks,
    };
  }

  const hashBaru = hashPassword(passwordBaru);
  const { error } = await admin
    .from("student_accounts")
    .update({ password_hash: hashBaru })
    .eq("id", accountRow.id);

  if (error) {
    // Password tidak tersimpan → jangan biarkan jatah ikut hangus.
    await kembalikanKuota(admin, accountRow.id, setelahPakai.terpakai);

    return {
      message: `Gagal menyimpan: ${error.message}`,
      sukses: false,
      sisaKuota: Math.min(kuota.sisa, setelahPakai.sisa + 1),
      maksKuota: setelahPakai.maks,
    };
  }

  revalidatePath("/siswa");
  revalidatePath("/siswa/profil");

  return {
    message: "Password berhasil diganti.",
    sukses: true,
    sisaKuota: setelahPakai.sisa,
    maksKuota: setelahPakai.maks,
  };
}
