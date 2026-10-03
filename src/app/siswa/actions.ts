"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hashPassword, verifikasiPassword } from "@/lib/hash-password";
import { hapusSesiSesi, simpanSesiSesi, ambilSesiSiswa } from "@/lib/sesi-siswa";
import {
  ambilIp,
  catatGagal,
  cekBlokir,
  pesanTerlaluBanyak,
  resetGagal,
} from "@/lib/rate-limit";

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
  const { data: account, error } = await supabase
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
  const supabase = await createClient();
  const sesi = await ambilSesiSiswa();

  if (!sesi) {
    redirect("/login-siswa");
  }

  const { data: account } = await supabase
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

  const hashBaru = hashPassword(passwordBaru);
  const { error } = await supabase
    .from("student_accounts")
    .update({ password_hash: hashBaru })
    .eq("id", account.id);

  if (error) {
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
    .select("id, status, tenggat, durasi, nilai_ditampilkan, nilai_selesai, dibuka")
    .eq("id", examId)
    .maybeSingle();

  if (galatUlangan || !ulangan) {
    return { message: "Ulangan tidak ditemukan.", nilaiTotal: null };
  }

  const dataUlangan = ulangan as {
    status: "akan" | "sudah";
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
  // (Kolom baru; null = DDL belum dijalankan → anggap dibuka, agar
  // submit tidak terblokir sebelum schema Tahap 12 dijalankan.)
  if (dataUlangan.dibuka === false) {
    return {
      message: "Ulangan ini sedang ditutup oleh guru.",
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

  // Ambil soal + kunci
  const { data: soalData, error: galatSoal } = await supabase
    .from("exam_questions")
    .select("id, jenis, kunci, poin, pilihan")
    .eq("exam_id", examId)
    .order("urutan", { ascending: true });

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
  }[];

  if (daftarSoal.length === 0) {
    return { message: "Belum ada soal di ulangan ini.", nilaiTotal: null };
  }

  // Hitung nilai PG
  let nilaiPG = 0;
  const daftarJawaban: { soalId: string; jawaban: string }[] = [];

  for (const soal of daftarSoal) {
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

  // Simpan submission
  const nilaiTotal = nilaiPG; // esai belum dinilai
  const { data: submitBaru, error: galatSubmit } = await supabase
    .from("exam_submissions")
    .insert({
      exam_id: examId,
      siswa_id: sesi.siswaId,
      nilai_pg: nilaiPG,
      nilai_esai: 0,
      nilai_total: nilaiTotal,
    })
    .select("id")
    .single();

  if (galatSubmit || !submitBaru) {
    return {
      message: `Gagal menyimpan jawaban: ${galatSubmit?.message ?? "tidak diketahui"}`,
      nilaiTotal: null,
    };
  }

  // Simpan jawaban detail
  if (daftarJawaban.length > 0) {
    const { error: galatJawaban } = await supabase
      .from("exam_answers")
      .insert(
        daftarJawaban.map((j) => ({
          submission_id: submitBaru.id,
          soal_id: j.soalId,
          jawaban: j.jawaban,
        })),
      );

    if (galatJawaban) {
      console.error("Gagal menyimpan detail jawaban:", galatJawaban.message);
    }
  }

  // Sinkronkan nilai sementara ke exam_scores
  const { error: galatScores } = await supabase
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
