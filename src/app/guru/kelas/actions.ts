"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAKS_INFO_TOKEN_LOGIN,
  type TokenLoginMode,
} from "@/lib/pengaturan-soal";

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

// ============================================================================
// Kontrol login token siswa (Tahap 43 + 45 + 46).
//
//   Mode otomatis → token terbuka sampai jam tutup yang diatur, lalu tutup
//                   sendiri setiap hari (bawaan 18:00 WIB).
//   Mode manual   → guru yang membuka/menutup; batas jam tidak berlaku.
//
// Saklar `token_login_dibuka` tetap menjadi tombol matikan total kapan pun.
// Login password tidak terpengaruh.
// ============================================================================

export type HasilTokenLogin = {
  message: string | null;
  sukses?: boolean;
};

function pesanTahap43BelumSiap(pesan: string): boolean {
  return (
    pesan.includes("token_login_dibuka") ||
    pesan.includes("pengaturan_guru") ||
    pesan.includes("42P01") ||
    pesan.includes("42703") ||
    pesan.includes("PGRST205")
  );
}

export async function setTokenLoginDibuka(
  _prevState: HasilTokenLogin,
  formData: FormData,
): Promise<HasilTokenLogin> {
  const dibuka = formData.get("dibuka") === "true";

  await requireGuru();
  const admin = createAdminClient();

  const { error } = await admin.from("pengaturan_guru").upsert(
    {
      id: 1,
      token_login_dibuka: dibuka,
      diperbarui_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Gagal menyimpan saklar login token:", error.message);
    return {
      message: pesanTahap43BelumSiap(error.message)
        ? "Kolom pengaturan token belum ada. Jalankan schema.sql Tahap 43 di Supabase."
        : `Gagal menyimpan saklar: ${error.message}`,
    };
  }

  revalidatePath("/guru/kelas");
  revalidatePath("/login-siswa");

  return {
    message: dibuka
      ? "Login token dibuka lagi untuk siswa."
      : "Login token ditutup untuk semua kelas.",
    sukses: true,
  };
}

// Ganti mode pengelolaan login token (Tahap 45).
//   otomatis → tutup sendiri pada jam yang diatur (Tahap 46).
//   manual   → guru buka/tutup sendiri, batas jam tidak berlaku.
export async function setTokenLoginMode(
  _prevState: HasilTokenLogin,
  formData: FormData,
): Promise<HasilTokenLogin> {
  const mode: TokenLoginMode =
    formData.get("mode") === "manual" ? "manual" : "otomatis";

  await requireGuru();
  const admin = createAdminClient();

  const { error } = await admin.from("pengaturan_guru").upsert(
    {
      id: 1,
      token_login_mode: mode,
      diperbarui_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Gagal menyimpan mode login token:", error.message);
    const kolomBelumAda =
      error.message.includes("token_login_mode") ||
      error.code === "42703" ||
      error.code === "PGRST204";

    return {
      message: kolomBelumAda
        ? "Kolom mode login token belum ada. Jalankan schema.sql Tahap 45 di Supabase."
        : `Gagal menyimpan mode: ${error.message}`,
    };
  }

  revalidatePath("/guru/kelas");
  revalidatePath("/login-siswa");

  return {
    message:
      mode === "manual"
        ? "Mode manual aktif: Anda yang membuka/menutup token."
        : "Mode otomatis aktif: token tertutup sendiri sesuai jam yang diatur.",
    sukses: true,
  };
}

// Simpan jam tutup otomatis login token (Tahap 46).
export async function setTokenLoginWaktuTutup(
  _prevState: HasilTokenLogin,
  formData: FormData,
): Promise<HasilTokenLogin> {
  const waktu = String(formData.get("waktu") ?? "").trim();

  // Hanya terima "HH:MM" 24 jam. Jangan diam-diam diganti default supaya
  // guru sadar kalau inputnya tidak valid.
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(waktu)) {
    return { message: "Format jam harus HH:MM, contoh 18:00." };
  }

  await requireGuru();
  const admin = createAdminClient();

  const { error } = await admin.from("pengaturan_guru").upsert(
    {
      id: 1,
      token_login_tutup_waktu: waktu,
      diperbarui_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Gagal menyimpan jam tutup token:", error.message);
    const kolomBelumAda =
      error.message.includes("token_login_tutup_waktu") ||
      error.code === "42703" ||
      error.code === "PGRST204";

    return {
      message: kolomBelumAda
        ? "Kolom jam tutup token belum ada. Jalankan schema.sql Tahap 46 di Supabase."
        : `Gagal menyimpan jam tutup: ${error.message}`,
    };
  }

  revalidatePath("/guru/kelas");
  revalidatePath("/login-siswa");

  return {
    message: `Token akan tertutup otomatis pukul ${waktu} WIB setiap hari.`,
    sukses: true,
  };
}

// Simpan kalimat informasi khusus login token (Tahap 47).
//
// Saat aktif dan teksnya tidak kosong, kalimat ini MENGGANTIKAN keterangan
// otomatis status token di /login-siswa. Saat tidak aktif, banner keterangan
// login token disembunyikan sepenuhnya (teks tidak dihapus).
export async function simpanInfoTokenLogin(
  _prevState: HasilTokenLogin,
  formData: FormData,
): Promise<HasilTokenLogin> {
  const info = String(formData.get("info_token_login") ?? "").trim();
  const aktif = formData.get("info_token_login_aktif") === "on";

  if (info.length > MAKS_INFO_TOKEN_LOGIN) {
    return {
      message: `Informasi terlalu panjang (maks ${MAKS_INFO_TOKEN_LOGIN} karakter).`,
    };
  }

  await requireGuru();
  const admin = createAdminClient();

  const { error } = await admin.from("pengaturan_guru").upsert(
    {
      id: 1,
      info_token_login: info || null,
      info_token_login_aktif: aktif,
      diperbarui_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Gagal menyimpan informasi login token:", error.message);
    const kolomBelumAda =
      error.message.includes("info_token_login") ||
      error.code === "42703" ||
      error.code === "PGRST204";

    return {
      message: kolomBelumAda
        ? "Kolom informasi login token belum ada. Jalankan schema.sql Tahap 47 di Supabase."
        : `Gagal menyimpan informasi: ${error.message}`,
    };
  }

  revalidatePath("/guru/kelas");
  revalidatePath("/login-siswa");

  return {
    message: aktif
      ? info
        ? "Informasi login token dipublish ke halaman login siswa."
        : "Pengaturan disimpan. Isi kalimatnya agar tampil di halaman login."
      : "Informasi login token disembunyikan dari halaman login siswa.",
    sukses: true,
  };
}

// Hapus SEMUA token kelas sekaligus (tombol "Hapus semua token").
export async function hapusSemuaTokenKelas(
  _prevState: HasilTokenLogin,
  formData: FormData,
): Promise<HasilTokenLogin> {
  // Penjaga tambahan: tombol harus mengirim konfirmasi eksplisit.
  if (String(formData.get("konfirmasi") ?? "") !== "hapus-semua") {
    return { message: "Konfirmasi tidak valid. Coba lagi dari halaman Kelas." };
  }

  await requireGuru();
  const admin = createAdminClient();

  // Supabase menolak delete tanpa filter, jadi id diambil dulu lalu dihapus
  // berdasarkan daftar id tersebut.
  const { data, error: errorBaca } = await admin
    .from("class_tokens")
    .select("id");

  if (errorBaca) {
    console.error("Gagal membaca token kelas:", errorBaca.message);
    return { message: `Gagal membaca token: ${errorBaca.message}` };
  }

  const daftarId = (data ?? []).map((baris) => (baris as { id: string }).id);

  if (daftarId.length === 0) {
    return { message: "Tidak ada token yang perlu dihapus.", sukses: true };
  }

  const { error } = await admin
    .from("class_tokens")
    .delete()
    .in("id", daftarId);

  if (error) {
    console.error("Gagal menghapus semua token:", error.message);
    return { message: `Gagal menghapus token: ${error.message}` };
  }

  revalidatePath("/guru/kelas");
  revalidatePath("/login-siswa");

  return {
    message: `${daftarId.length} token dihapus. Siswa sementara tidak bisa login lewat token.`,
    sukses: true,
  };
}
