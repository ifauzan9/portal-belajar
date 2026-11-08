"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, verifikasiPassword } from "@/lib/hash-password";
import { hapusSesiSesi, simpanSesiSesi, ambilSesiSiswa } from "@/lib/sesi-siswa";
import { koordinatValid, statusLokasiValid } from "@/lib/lokasi";
import { kembalikanKuota, pakaiKuota } from "@/lib/kuota-harian";
import {
  MAKS_GANTI_PASSWORD_HARIAN,
  PESAN_KUOTA_HABIS,
  pesanKuotaTidakSiap,
  sisaKuotaPassword,
} from "@/lib/kuota-password";
import {
  ambilIp,
  catatGagal,
  cekBlokir,
  pesanTerlaluBanyak,
  resetGagal,
} from "@/lib/rate-limit";
import {
  hitungNilaiKodeUjian,
  pecahInput,
  type AnalisisBebas,
  type AturanBebas,
} from "@/lib/lab";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { belumWaktunyaMulai } from "@/lib/jadwal-ulangan";

// ============================================================================
// Aksi auth siswa (login, logout, ganti password).
// Login memakai username + password yang diatur guru (bukan email/Supabase
// Auth). Password di-hash PBKDF2 dan diverifikasi di server.
// ============================================================================

export type HasilLogin = { message: string | null };

// Catat percobaan login siswa ke tabel login_logs.
// Dijalankan lewat after() agar penulisan log TIDAK menambah waktu tunggu
// login (dieksekusi setelah respons dikirim). Best-effort.
async function catatLogLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: {
    siswaId: string | null;
    username: string;
    berhasil: boolean;
    alasan: string | null;
  },
) {
  let ip = "unknown";
  let userAgent = "";
  try {
    const h = await headers();
    userAgent = (h.get("user-agent") ?? "").slice(0, 500);
    const xff = h.get("x-forwarded-for");
    ip = xff
      ? xff.split(",")[0]?.trim() || "unknown"
      : h.get("x-real-ip")?.trim() || "unknown";
  } catch {
    // abaikan
  }

  after(async () => {
    try {
      await supabase.from("login_logs").insert({
        siswa_id: data.siswaId,
        username: data.username,
        berhasil: data.berhasil,
        alasan: data.alasan,
        ip,
        user_agent: userAgent,
      });
    } catch {
      // abaikan
    }
  });
}

export async function loginSiswa(
  _prevState: HasilLogin,
  formData: FormData,
): Promise<HasilLogin> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { message: "Username dan password wajib diisi." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Pembatasan percobaan login (anti brute force / spam).
  const kunci = `siswa:${await ambilIp()}:${username.toLowerCase()}`;
  const cek = cekBlokir(kunci);
  if (!cek.boleh) {
    await catatLogLogin(supabase, {
      siswaId: null,
      username,
      berhasil: false,
      alasan: "diblokir",
    });
    return { message: pesanTerlaluBanyak(cek.sisaDetik) };
  }

  // Cari akun siswa berdasarkan username (case-insensitive).
  const { data: account, error } = await admin
    .from("student_accounts")
    .select("id, username, password_hash, is_active, students(*)")
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    return { message: `Gagal memuat akun: ${error.message}` };
  }

  // Pesan disamarkan agar tidak membocorkan apakah username terdaftar.
  if (!account) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId: null,
      username,
      berhasil: false,
      alasan: "username_tidak_ditemukan",
    });
    return { message: "Username atau password salah." };
  }

  const accountRow = account as {
    password_hash: string;
    is_active: boolean;
    students?: unknown;
  };

  const students = accountRow.students;
  const siswa = (Array.isArray(students) ? students[0] : students) as
    | { id: string }
    | null
    | undefined;
  const siswaId = siswa?.id ?? null;

  // Akun nonaktif tidak boleh login.
  if (!accountRow.is_active) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId,
      username,
      berhasil: false,
      alasan: "akun_nonaktif",
    });
    return { message: "Akun kamu dinonaktifkan. Hubungi gurumu." };
  }

  const hashTersimpan = accountRow.password_hash;
  if (!verifikasiPassword(password, hashTersimpan)) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId,
      username,
      berhasil: false,
      alasan: "password_salah",
    });
    return { message: "Username atau password salah." };
  }

  // Password benar → reset penghitung percobaan gagal.
  resetGagal(kunci);
  await catatLogLogin(supabase, {
    siswaId,
    username,
    berhasil: true,
    alasan: null,
  });

  if (!siswa) {
    return { message: "Akun ini tidak terhubung ke data siswa." };
  }

  // Simpan cookie sesi lalu arahkan ke dashboard siswa.
  await simpanSesiSesi({ siswaId: siswa.id, username });
  redirect("/siswa");
}

export async function logoutSiswa() {
  await hapusSesiSesi();
  redirect("/login-siswa");
}

// ============================================================================
// Login siswa memakai TOKEN KELAS.
// Field: kelas_id, siswa_id, token
// Token dibuat/diatur guru per kelas. Validasi dilakukan di server memakai
// service-role (tabel class_tokens tidak bisa dibaca browser).
// ============================================================================

export async function loginSiswaToken(
  _prevState: HasilLogin,
  formData: FormData,
): Promise<HasilLogin> {
  const kelasId = String(formData.get("kelas_id") ?? "").trim();
  const siswaId = String(formData.get("siswa_id") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim().toUpperCase();

  if (!kelasId || !siswaId || !token) {
    return { message: "Kelas, nama, dan token wajib dipilih/diisi." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Pembatasan percobaan (anti brute force) per IP + kelas.
  const kunci = `siswa-token:${await ambilIp()}:${kelasId}`;
  const cek = cekBlokir(kunci);
  if (!cek.boleh) {
    await catatLogLogin(supabase, {
      siswaId: null,
      username: `token:${kelasId}`,
      berhasil: false,
      alasan: "diblokir",
    });
    return { message: pesanTerlaluBanyak(cek.sisaDetik) };
  }

  // Pastikan siswa memang terdaftar di kelas yang dipilih (cegah manipulasi).
  const { data: siswa } = await admin
    .from("students")
    .select("id, nama_siswa, kelas_id")
    .eq("id", siswaId)
    .maybeSingle();

  const dataSiswa = siswa as
    | { id: string; nama_siswa: string; kelas_id: string | null }
    | null;

  if (!dataSiswa || dataSiswa.kelas_id !== kelasId) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId: null,
      username: `token:${kelasId}`,
      berhasil: false,
      alasan: "siswa_bukan_di_kelas",
    });
    return { message: "Data kelas atau nama tidak cocok. Coba pilih ulang." };
  }

  // Ambil token kelas dari DB (via service-role).
  const { data: tokenRow } = await admin
    .from("class_tokens")
    .select("token")
    .eq("kelas_id", kelasId)
    .maybeSingle();

  const tokenSimpan = ((tokenRow as { token: string } | null)?.token ?? "")
    .trim()
    .toUpperCase();

  if (!tokenSimpan) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId: siswaId,
      username: `token:${kelasId}`,
      berhasil: false,
      alasan: "token_kelas_belum_dibuat",
    });
    return {
      message: "Kelas ini belum punya token. Tanyakan ke gurumu.",
    };
  }

  if (token !== tokenSimpan) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId: siswaId,
      username: `token:${kelasId}`,
      berhasil: false,
      alasan: "token_salah",
    });
    return { message: "Token kelas salah. Cek lagi dengan gurumu." };
  }

  // Token benar. Sekarang wajib punya akun AKTIF: token kelas hanya boleh
  // dipakai siswa yang memang punya akun login (sama seperti login password).
  // Pengecekan dilakukan SETELAH token terbukti benar, supaya status akun
  // tidak bocor ke orang yang cuma menebak-nebak token.
  const { data: akun } = await admin
    .from("student_accounts")
    .select("username, is_active")
    .eq("siswa_id", dataSiswa.id)
    .maybeSingle();

  const akunRow = akun as { username: string; is_active: boolean } | null;

  if (!akunRow) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId: dataSiswa.id,
      username: `token:${kelasId}`,
      berhasil: false,
      alasan: "akun_belum_dibuat",
    });
    return {
      message:
        "Namamu belum punya akun login. Minta gurumu membuatkan akun dulu.",
    };
  }

  if (!akunRow.is_active) {
    catatGagal(kunci);
    await catatLogLogin(supabase, {
      siswaId: dataSiswa.id,
      username: akunRow.username,
      berhasil: false,
      alasan: "akun_nonaktif",
    });
    return { message: "Akun kamu dinonaktifkan. Hubungi gurumu." };
  }

  // Akun aktif → reset penghitung gagal, catat log, buat sesi.
  resetGagal(kunci);
  await catatLogLogin(supabase, {
    siswaId: siswaId,
    username: akunRow.username,
    berhasil: true,
    alasan: null,
  });

  // Sesi memakai username ASLI (bukan "token:<kelasId>"), supaya semua
  // halaman siswa memperlakukan login token sama seperti login password.
  await simpanSesiSesi({ siswaId: dataSiswa.id, username: akunRow.username });
  redirect("/siswa");
}

// ============================================================================
// Ganti password (siswa atur sendiri).
// Field: password_lama, password_baru
// ============================================================================

export type HasilGantiPassword = {
  message: string | null;
  sukses: boolean;
};

export async function gantiPassword(
  _prevState: HasilGantiPassword,
  formData: FormData,
): Promise<HasilGantiPassword> {
  // Verifikasi sesi dulu.
  const admin = createAdminClient();
  const sesi = await ambilSesiSiswa();

  if (!sesi) {
    redirect("/login-siswa");
  }

  const { data: account } = await admin
    .from("student_accounts")
    .select("id, password_hash, is_active")
    .ilike("username", sesi.username)
    .maybeSingle();

  if (!account) {
    await hapusSesiSesi();
    redirect("/login-siswa");
  }

  const accountRow = account as {
    password_hash: string;
    is_active: boolean;
  };

  if (!accountRow.is_active) {
    await hapusSesiSesi();
    redirect("/login-siswa");
  }

  const passwordLama = String(formData.get("password_lama") ?? "");
  const passwordBaru = String(formData.get("password_baru") ?? "");
  const passwordKonfirmasi = String(formData.get("password_konfirmasi") ?? "");

  if (!verifikasiPassword(passwordLama, account.password_hash)) {
    return { message: "Password lama salah.", sukses: false };
  }

  if (passwordBaru.length < 6) {
    return { message: "Password baru minimal 6 karakter.", sukses: false };
  }

  if (passwordBaru !== passwordKonfirmasi) {
    return { message: "Konfirmasi password tidak cocok.", sukses: false };
  }

  // Kuota harian dihitung di database (Tahap 31), sama seperti halaman profil.
  // Jalur ini tidak dipakai UI lagi, tetapi tetap dijaga supaya tidak menjadi
  // celah untuk melewati batas 3x/hari.
  const kuota = await sisaKuotaPassword(admin, account.id);

  if (!kuota.siap) {
    return { message: pesanKuotaTidakSiap(kuota.alasan), sukses: false };
  }

  if (!kuota.boleh) {
    return { message: PESAN_KUOTA_HABIS, sukses: false };
  }

  const setelahPakai = await pakaiKuota(
    admin,
    account.id,
    MAKS_GANTI_PASSWORD_HARIAN,
  );

  if (!setelahPakai.siap || !setelahPakai.boleh) {
    return {
      message: !setelahPakai.siap
        ? pesanKuotaTidakSiap(setelahPakai.alasan)
        : PESAN_KUOTA_HABIS,
      sukses: false,
    };
  }

  const hashBaru = hashPassword(passwordBaru);
  const { error } = await admin
    .from("student_accounts")
    .update({ password_hash: hashBaru })
    .eq("id", account.id);

  if (error) {
    // Gagal simpan → jatah jangan hangus.
    await kembalikanKuota(admin, account.id, setelahPakai.terpakai);
    return { message: `Gagal menyimpan: ${error.message}`, sukses: false };
  }

  // Revalidate supaya halaman profil/update akun ter-refresh.
  revalidatePath("/siswa");
  revalidatePath("/siswa/ganti-password");
  return { message: "Password berhasil diganti.", sukses: true };
}

// ============================================================================
// Submit jawaban ulangan bersoal (status "akan").
// Field: exam_id, jawaban_{soalId} (huruf untuk PG, teks untuk esai)
// Hitung nilai PG otomatis, simpan ke exam_submissions + exam_answers.
// ============================================================================

export type HasilSubmitUlangan = {
  message: string | null;
  nilaiTotal: number | null;
};

// ============================================================================
// Mulai ulangan: dipanggil dari halaman konfirmasi.
// Timer baru berjalan setelah siswa menekan "Mulai Sekarang" (baris
// exam_sessions dibuat di sini), bukan saat halaman soal pertama dibuka.
// ============================================================================

export type HasilMulaiUjian = { message: string | null };

export async function mulaiUjianSiswa(
  _prevState: HasilMulaiUjian,
  formData: FormData,
): Promise<HasilMulaiUjian> {
  const examId = String(formData.get("exam_id") ?? "").trim();

  if (!examId) {
    return { message: "Ulangan tidak ditemukan." };
  }

  const sesi = await ambilSesiSiswa();
  if (!sesi) {
    redirect("/login-siswa");
  }

  const supabase = await createClient();

  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select(
      "id, status, tanggal, tenggat, dibuka, access_code, kelas_id, exam_classes(kelas_id)",
    )
    .eq("id", examId)
    .maybeSingle();

  if (galatUlangan || !ulangan) {
    return { message: "Ulangan tidak ditemukan." };
  }

  const dataUlangan = ulangan as {
    id: string;
    status: "akan" | "sudah";
    tanggal: string | null;
    tenggat: string | null;
    dibuka: boolean | null;
    access_code: string | null;
    kelas_id: string | null;
    exam_classes?: { kelas_id: string }[] | null;
  };

  // Pastikan ulangan memang untuk kelas siswa.
  const { data: siswa } = await supabase
    .from("students")
    .select("kelas_id")
    .eq("id", sesi.siswaId)
    .maybeSingle();

  const kelasId = (siswa as { kelas_id: string | null } | null)?.kelas_id ?? null;
  const daftarKelasId = ambilKelasUlangan(dataUlangan);
  const relevan =
    daftarKelasId.length === 0 ||
    (kelasId !== null && daftarKelasId.includes(kelasId));

  if (!relevan) {
    return { message: "Ulangan ini bukan untuk kelasmu." };
  }

  if (dataUlangan.status !== "akan") {
    return { message: "Ulangan ini tidak bisa dikerjakan." };
  }

  if (dataUlangan.dibuka === false) {
    return { message: "Ulangan ini sedang ditutup oleh guru." };
  }

  if (belumWaktunyaMulai(dataUlangan.tanggal)) {
    return {
      message: "Ulangan belum dimulai. Cek jadwal mulai terlebih dahulu.",
    };
  }

  if (
    dataUlangan.tenggat &&
    new Date(dataUlangan.tenggat).getTime() < Date.now()
  ) {
    return { message: "Tenggat waktu sudah lewat." };
  }

  // Kode akses wajib cocok kalau guru mengaturnya. Pemeriksaan di server
  // ini juga mencegah siswa memulai lewat request langsung tanpa kode.
  const kodeTersimpan = (dataUlangan.access_code ?? "").trim().toUpperCase();
  const kodeInput = String(formData.get("kode") ?? "").trim().toUpperCase();

  if (kodeTersimpan && kodeInput !== kodeTersimpan) {
    return {
      message: kodeInput
        ? "Kode akses salah. Cek lagi dengan guru."
        : "Kode akses wajib diisi.",
    };
  }

  // Sudah submit → jangan buat sesi baru.
  const { data: submitLama } = await supabase
    .from("exam_submissions")
    .select("id")
    .eq("exam_id", examId)
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  if (submitLama) {
    return { message: "Kamu sudah mengerjakan ulangan ini." };
  }

  // Sudah punya sesi → timer sudah berjalan, lanjutkan saja.
  const { data: sesiLama } = await supabase
    .from("exam_sessions")
    .select("id")
    .eq("exam_id", examId)
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  if (!sesiLama) {
    const { error: galatInsert } = await supabase
      .from("exam_sessions")
      .insert({ exam_id: examId, siswa_id: sesi.siswaId });

    if (galatInsert) {
      // Bisa jadi request lain baru saja membuat sesi (unique constraint).
      const { data: sesiUlang } = await supabase
        .from("exam_sessions")
        .select("id")
        .eq("exam_id", examId)
        .eq("siswa_id", sesi.siswaId)
        .maybeSingle();

      if (!sesiUlang) {
        return {
          message: `Gagal memulai ulangan: ${galatInsert.message}`,
        };
      }
    }
  }

  revalidatePath(`/siswa/ulangan/${examId}`);
  redirect(`/siswa/ulangan/${examId}`);
}

// ============================================================================
// Catat "probe": siswa meninggalkan halaman soal / pindah tab / minimize.
// Dipanggil dari sisi client (form-jawaban) setiap kali event terjadi.
// Field: exam_id, jenis ('blur' | 'visibility' | 'freeze')
// Dianggap aman: sesi siswa diverifikasi server-side sebelum insert.
// ============================================================================

export async function catatProbe(formData: FormData) {
  const examId = String(formData.get("exam_id") ?? "");
  const jenis = String(formData.get("jenis") ?? "");

  if (!examId || !["blur", "visibility", "freeze"].includes(jenis)) {
    return;
  }

  const sesi = await ambilSesiSiswa();
  if (!sesi) return; // siswa tidak login → abaikan

  // Cek ulangan masih aktif (belum lewat tenggat, status "akan")
  const supabase = await createClient();
  const { data: ulangan } = await supabase
    .from("exams")
    .select("status, tenggat")
    .eq("id", examId)
    .maybeSingle();

  const dUlangan = ulangan as
    | { status: "akan" | "sudah"; tenggat: string | null }
    | null;

  if (!dUlangan || dUlangan.status !== "akan") return;
  if (dUlangan.tenggat && new Date(dUlangan.tenggat).getTime() < Date.now()) {
    return; // tenggat sudah lewat, jangan catat lagi
  }

  // Cek apakah siswa sudah submit — probe setelah submit tidak relevan.
  const { data: sudahSubmit } = await supabase
    .from("exam_submissions")
    .select("id")
    .eq("exam_id", examId)
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  if (sudahSubmit) return;

  // Insert probe — gagal diam-diam (DDL belum dijalankan, dll).
  await supabase.from("exam_probes").insert({
    exam_id: examId,
    siswa_id: sesi.siswaId,
    jenis,
  });
}

// ============================================================================
// Ambil input uji (input berbeda) untuk soal kode ulangan.
// Sengaja baru diambil saat siswa menekan Run / submit, supaya isinya tidak
// ikut terkirim bersama halaman.
// ============================================================================
export async function ambilMasukanUjiUlangan(
  examId: string,
  soalId: string,
): Promise<{ masukan: string } | null> {
  await ambilSesiSiswa();

  const idExam = String(examId ?? "").trim();
  const idSoal = String(soalId ?? "").trim();
  if (!idExam || !idSoal) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_questions")
    .select("masukan_uji, jenis, exam_id")
    .eq("id", idSoal)
    .eq("exam_id", idExam)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = data as {
    masukan_uji?: string | null;
    jenis?: string;
  } | null;

  if (!row || row.jenis !== "kode") return null;
  if (!row.masukan_uji || !row.masukan_uji.trim()) return null;

  return { masukan: row.masukan_uji };
}

// Baca nilai JSON dari FormData dengan aman.
function bacaJson<T>(raw: FormDataEntryValue | null, cadangan: T): T {
  if (typeof raw !== "string" || !raw.trim()) return cadangan;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return cadangan;
  }
}

export async function submitUlangan(
  _prevState: HasilSubmitUlangan,
  formData: FormData,
): Promise<HasilSubmitUlangan> {
  const examId = String(formData.get("exam_id") ?? "");

  if (!examId) {
    return { message: "Ulangan tidak ditemukan.", nilaiTotal: null };
  }

  const sesi = await ambilSesiSiswa();
  if (!sesi) {
    redirect("/login-siswa");
  }

  const supabase = await createClient();

  // Cek status + tenggat + durasi ulangan
  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select(
      "id, status, tanggal, tenggat, durasi, nilai_ditampilkan, nilai_selesai, dibuka",
    )
    .eq("id", examId)
    .maybeSingle();

  if (galatUlangan || !ulangan) {
    return { message: "Ulangan tidak ditemukan.", nilaiTotal: null };
  }

  const dataUlangan = ulangan as {
    status: "akan" | "sudah";
    tanggal: string | null;
    tenggat: string | null;
    durasi: number | null;
    nilai_ditampilkan: boolean;
    nilai_selesai: boolean;
    dibuka: boolean | null;
  };

  if (dataUlangan.status !== "akan") {
    return { message: "Ulangan ini bukan bersoal.", nilaiTotal: null };
  }

  // Ulangan ditutup oleh guru → tidak bisa submit.
  if (dataUlangan.dibuka === false) {
    return {
      message: "Ulangan ini sedang ditutup oleh guru.",
      nilaiTotal: null,
    };
  }

  // Jadwal mulai belum tiba → tolak submit (pengaman server-side).
  if (belumWaktunyaMulai(dataUlangan.tanggal)) {
    return {
      message: "Ulangan belum dimulai. Tidak bisa mengumpulkan jawaban.",
      nilaiTotal: null,
    };
  }

  // Tenggat sudah lewat?
  if (
    dataUlangan.tenggat &&
    new Date(dataUlangan.tenggat).getTime() < Date.now()
  ) {
    return {
      message: "Tenggat waktu sudah lewat. Tidak bisa submit lagi.",
      nilaiTotal: null,
    };
  }

  // ------------------- DURASI (server-anchored) -------------------
  // Waktu mulai disimpan di exam_sessions dan TIDAK di-reset saat refresh.
  // Toleransi 120 detik untuk auto-submit tepat saat timer habis.
  let mulaiAtMs = Date.now();
  const { data: sesiData } = await supabase
    .from("exam_sessions")
    .select("mulai_at")
    .eq("exam_id", examId)
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  const sesiRow = sesiData as { mulai_at: string } | null;
  if (sesiRow?.mulai_at) {
    mulaiAtMs = new Date(sesiRow.mulai_at).getTime();
  } else {
    const { data: sesiBaru } = await supabase
      .from("exam_sessions")
      .insert({ exam_id: examId, siswa_id: sesi.siswaId })
      .select("mulai_at")
      .maybeSingle();
    const rowBaru = sesiBaru as { mulai_at: string } | null;
    if (rowBaru?.mulai_at) {
      mulaiAtMs = new Date(rowBaru.mulai_at).getTime();
    } else {
      const { data: sesiUlang } = await supabase
        .from("exam_sessions")
        .select("mulai_at")
        .eq("exam_id", examId)
        .eq("siswa_id", sesi.siswaId)
        .maybeSingle();
      const rowUlang = sesiUlang as { mulai_at: string } | null;
      if (rowUlang?.mulai_at) {
        mulaiAtMs = new Date(rowUlang.mulai_at).getTime();
      }
    }
  }

  if (dataUlangan.durasi && dataUlangan.durasi > 0) {
    // Toleransi 120 detik: auto-submit tepat saat timer habis masih harus
    // menyiapkan Pyodide (kalau siswa belum pernah menekan Run).
    const batasMs = mulaiAtMs + dataUlangan.durasi * 60_000 + 120_000;
    if (Date.now() > batasMs) {
      return {
        message: "Waktu pengerjaan sudah habis. Jawaban tidak bisa dikirim.",
        nilaiTotal: null,
      };
    }
  }

  // Cek apakah sudah submit
  const { data: submitLama } = await supabase
    .from("exam_submissions")
    .select("id")
    .eq("exam_id", examId)
    .eq("siswa_id", sesi.siswaId)
    .maybeSingle();

  if (submitLama) {
    return {
      message: "Kamu sudah submit jawaban untuk ulangan ini.",
      nilaiTotal: null,
    };
  }

  // Ambil soal + kunci + kolom kode.
  const kolomSoalDasar = "id, jenis, kunci, poin, pilihan";
  const kolomSoalLengkap =
    "id, jenis, kunci, poin, pilihan, soal, kode_awal, keluaran_diharapkan, masukan, masukan_uji, keluaran_uji, aturan";

  let soalData: unknown[] | null = null;
  let galatSoal: { message: string } | null = null;

  const hasilSoal = await supabase
    .from("exam_questions")
    .select(kolomSoalLengkap)
    .eq("exam_id", examId)
    .order("urutan", { ascending: true });

  soalData = hasilSoal.data;
  galatSoal = hasilSoal.error;

  // Kalau DDL Tahap 33 belum dijalankan, tetap bisa submit soal lama.
  if (galatSoal) {
    const fallback = await supabase
      .from("exam_questions")
      .select(kolomSoalDasar)
      .eq("exam_id", examId)
      .order("urutan", { ascending: true });
    soalData = fallback.data;
    galatSoal = fallback.error;
  }

  if (galatSoal) {
    return {
      message: `Gagal memuat soal: ${galatSoal.message}`,
      nilaiTotal: null,
    };
  }

  const daftarSoal = (soalData ?? []) as {
    id: string;
    jenis: string;
    kunci: string | null;
    poin: number;
    pilihan: string[] | null;
    soal?: string | null;
    kode_awal?: string | null;
    keluaran_diharapkan?: string | null;
    masukan?: string | null;
    masukan_uji?: string | null;
    keluaran_uji?: string | null;
    aturan?: AturanBebas | null;
  }[];

  if (daftarSoal.length === 0) {
    return { message: "Belum ada soal di ulangan ini.", nilaiTotal: null };
  }

  // ------------------- NILAI PG + KODE -------------------
  let nilaiPG = 0;
  let nilaiKode = 0;
  const daftarJawaban: { soalId: string; jawaban: string }[] = [];
  const daftarJawabanKode: {
    soalId: string;
    kode: string;
    keluaran: string;
    keluaranUji: string | null;
    nilai: number;
    rincian: unknown;
    percobaan: number;
  }[] = [];

  for (const soal of daftarSoal) {
    if (soal.jenis === "kode") {
      const kode = String(formData.get(`kode_${soal.id}`) ?? "");
      const keluaran = String(formData.get(`keluaran_${soal.id}`) ?? "");
      const keluaranUjiRaw = formData.get(`keluaran_uji_${soal.id}`);
      const keluaranUji =
        typeof keluaranUjiRaw === "string" ? keluaranUjiRaw : null;
      const analisis = bacaJson<AnalisisBebas | null>(
        formData.get(`analisis_${soal.id}`),
        null,
      );
      const stdin = bacaJson<string[] | null>(
        formData.get(`stdin_${soal.id}`),
        null,
      );
      const percobaan =
        Math.max(0, Number(formData.get(`percobaan_${soal.id}`) ?? 0)) || 0;

      const aturan = (soal.aturan ?? {}) as AturanBebas;
      const hasil = hitungNilaiKodeUjian({
        keluaran,
        keluaranDiharapkan: soal.keluaran_diharapkan ?? "",
        keluaranUji,
        keluaranUjiDiharapkan: soal.keluaran_uji ?? null,
        masukanDipakai: stdin,
        masukan: pecahInput(soal.masukan),
        analisis,
        aturan,
        poin: soal.poin,
      });

      nilaiKode += hasil.nilai;
      daftarJawaban.push({ soalId: soal.id, jawaban: kode });
      daftarJawabanKode.push({
        soalId: soal.id,
        kode,
        keluaran,
        keluaranUji,
        nilai: hasil.nilai,
        rincian: hasil,
        percobaan,
      });
      continue;
    }

    const jawaban = String(formData.get(`jawaban_${soal.id}`) ?? "").trim();

    if (!jawaban) {
      daftarJawaban.push({ soalId: soal.id, jawaban: "" });
      continue;
    }

    daftarJawaban.push({ soalId: soal.id, jawaban });

    if (soal.jenis === "pg") {
      // Jawaban siswa = huruf (A/B/C/D). Bandingkan dengan kunci.
      const jawabanHiruf = jawaban.toUpperCase().charAt(0);
      if (soal.kunci && jawabanHiruf === soal.kunci.toUpperCase()) {
        nilaiPG += soal.poin;
      }
    }
    // Esai: tidak dinilai otomatis (nilai_esai = 0, guru isi manual)
  }

  // Simpan submission. Kolom nilai_kode baru ada setelah DDL Tahap 33,
  // jadi sediakan fallback supaya soal lama tetap bisa dikumpulkan.
  const nilaiTotal = nilaiPG + nilaiKode;
  const dataDasar = {
    exam_id: examId,
    siswa_id: sesi.siswaId,
    nilai_pg: nilaiPG,
    nilai_esai: 0,
    nilai_total: nilaiTotal,
  };

  let submitBaru: { id: string } | null = null;
  let galatSubmit: { message: string } | null = null;

  const cobaInsert = await supabase
    .from("exam_submissions")
    .insert({ ...dataDasar, nilai_kode: nilaiKode })
    .select("id")
    .single();

  if (cobaInsert.error) {
    const fallback = await supabase
      .from("exam_submissions")
      .insert(dataDasar)
      .select("id")
      .single();
    submitBaru = fallback.data as { id: string } | null;
    galatSubmit = fallback.error;
  } else {
    submitBaru = cobaInsert.data as { id: string } | null;
  }

  if (galatSubmit || !submitBaru) {
    return {
      message: `Gagal menyimpan jawaban: ${galatSubmit?.message ?? "tidak diketahui"}`,
      nilaiTotal: null,
    };
  }

  const idSubmission = submitBaru.id;

  // Simpan jawaban detail
  if (daftarJawaban.length > 0) {
    const { error: galatJawaban } = await supabase
      .from("exam_answers")
      .insert(
        daftarJawaban.map((j) => ({
          submission_id: idSubmission,
          soal_id: j.soalId,
          jawaban: j.jawaban,
        })),
      );

    if (galatJawaban) {
      console.error("Gagal menyimpan detail jawaban:", galatJawaban.message);
    }
  }

  // Simpan kode + hasil penilaian per soal kode (gagal diam-diam kalau
  // DDL Tahap 33 belum dijalankan).
  if (daftarJawabanKode.length > 0) {
    const { error: galatKode } = await supabase
      .from("exam_code_answers")
      .insert(
        daftarJawabanKode.map((k) => ({
          submission_id: idSubmission,
          soal_id: k.soalId,
          kode: k.kode,
          keluaran: k.keluaran,
          keluaran_uji: k.keluaranUji,
          nilai: k.nilai,
          rincian: k.rincian,
          percobaan: k.percobaan,
        })),
      );

    if (galatKode) {
      console.error("Gagal menyimpan jawaban kode:", galatKode.message);
    }
  }

  // Sinkronkan nilai sementara ke exam_scores. Ditulis lewat service
  // role karena sesi siswa memakai kunci anon yang hanya boleh membaca
  // exam_scores. Best-effort: kegagalan tidak membatalkan submit.
  const admin = createAdminClient();
  const { error: galatScores } = await admin
    .from("exam_scores")
    .upsert(
      [{ exam_id: examId, siswa_id: sesi.siswaId, nilai: nilaiTotal }],
      { onConflict: "exam_id,siswa_id" },
    );

  if (galatScores) {
    console.error("Gagal sinkronkan exam_scores:", galatScores.message);
  }

  revalidatePath("/siswa");
  revalidatePath("/siswa/nilai");
  revalidatePath(`/siswa/nilai/${examId}`);

  // Jika nilai ditahan oleh guru, jangan tampilkan angka ke siswa.
  const nilaiBolehTampil =
    dataUlangan.nilai_ditampilkan || dataUlangan.nilai_selesai;

  return {
    message: nilaiBolehTampil
      ? "Jawaban berhasil dikumpulkan!"
      : "Jawaban berhasil dikumpulkan. Nilai akan ditampilkan setelah guru selesai menilai.",
    nilaiTotal: nilaiBolehTampil ? nilaiTotal : null,
  };
}

// ============================================================================
// Verifikasi kode akses ulangan (kode diberikan guru).
// Field: exam_id, kode
// Kalau cocok â†’ redirect ke halaman detail nilai ulangan.
// ============================================================================

export type HasilVerifikasiKode = { message: string | null };

export async function verifikasiKodeUlangan(
  _prevState: HasilVerifikasiKode,
  formData: FormData,
): Promise<HasilVerifikasiKode> {
  const examId = String(formData.get("exam_id") ?? "");
  const kode = String(formData.get("kode") ?? "").trim().toUpperCase();

  if (!examId || !kode) {
    return { message: "Kode akses wajib diisi." };
  }

  const sesi = await ambilSesiSiswa();
  if (!sesi) {
    redirect("/login-siswa");
  }

  const supabase = await createClient();

  const { data: ulangan, error } = await supabase
    .from("exams")
    .select("id, access_code")
    .eq("id", examId)
    .maybeSingle();

  if (error || !ulangan) {
    return { message: "Ulangan tidak ditemukan." };
  }

  const kodeSimpan = ((ulangan as { access_code: string | null }).access_code ?? "")
    .trim()
    .toUpperCase();

  if (!kodeSimpan) {
    return {
      message:
        "Ulangan ini belum punya kode akses. Tanyakan ke guru dulu.",
    };
  }

  if (kode !== kodeSimpan) {
    return { message: "Kode akses salah. Cek lagi dengan guru." };
  }

  redirect(`/siswa/nilai/${examId}?kode=1`);
}

// ============================================================================
// Simpan lokasi siswa (GPS perangkat) untuk PEMANTAUAN guru.
//
// Dipanggil dari browser setelah siswa login (halaman dashboard), bukan saat
// login — browser hanya memberi lokasi setelah izin dikabulkan, dan itu butuh
// interaksi di halaman. Sifatnya best-effort: kegagalan TIDAK pernah
// menghalangi siswa memakai aplikasi.
//
// Setiap status "diizinkan" dicatat sebagai satu baris riwayat (satu baris
// per pemuatan dashboard). Status lain hanya memperbarui lokasi terakhir.
//
// Data dari browser tidak dipercaya: koordinat divalidasi rentangnya, dan
// penulisan dilakukan dengan service-role (siswa tidak bisa mengubah lokasi
// siswa lain).
// ============================================================================

export type HasilSimpanLokasi = { ok: boolean };

export async function simpanLokasiSiswa(
  status: string,
  lat: number | null,
  lng: number | null,
  akurasi: number | null,
): Promise<HasilSimpanLokasi> {
  const sesi = await ambilSesiSiswa();
  if (!sesi) return { ok: false };

  // Hanya status yang dikenal yang boleh disimpan.
  if (!statusLokasiValid(status)) return { ok: false };

  // Status "diizinkan" wajib disertai koordinat yang wajar.
  let latSimpan: number | null = null;
  let lngSimpan: number | null = null;
  let akurasiSimpan: number | null = null;

  if (status === "diizinkan") {
    if (lat === null || lng === null) return { ok: false };
    akurasiSimpan =
      akurasi !== null && Number.isFinite(akurasi) ? Math.round(akurasi) : null;
    if (!koordinatValid(lat, lng, akurasiSimpan)) return { ok: false };
    latSimpan = lat;
    lngSimpan = lng;
  }

  const admin = createAdminClient();
  const waktuSekarang = new Date().toISOString();

  await admin.from("lokasi_terakhir_siswa").upsert(
    {
      siswa_id: sesi.siswaId,
      lat: latSimpan,
      lng: lngSimpan,
      akurasi_m: akurasiSimpan,
      status,
      diperbarui_at: waktuSekarang,
    },
    { onConflict: "siswa_id" },
  );

  // Riwayat hanya untuk lokasi yang benar-benar berhasil dibaca. Kegagalan
  // insert (mis. schema Tahap 40 belum dijalankan) sengaja diabaikan supaya
  // dashboard siswa tetap berjalan.
  if (status === "diizinkan" && latSimpan !== null && lngSimpan !== null) {
    await admin.from("lokasi_riwayat_siswa").insert({
      siswa_id: sesi.siswaId,
      lat: latSimpan,
      lng: lngSimpan,
      akurasi_m: akurasiSimpan,
      dicatat_at: waktuSekarang,
    });
  }

  return { ok: true };
}
