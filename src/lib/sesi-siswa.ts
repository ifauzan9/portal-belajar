import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Sesi login siswa (kustom, tanpa Supabase Auth).
//
// Mekanisme:
//  - Cookie "siswa_session" berisi token: "<payload-base64url>.<hmac>"
//    payload = "<uuid>|<siswa_id>|<username>"
//    hmac   = HMAC-SHA256(payload, secret)
//  - requireSiswa() baca cookie → cek HMAC → ambil siswa dari DB berdasarkan
//    username (pastikan akun masih ada & belum dihapus).
//
// Token stateless (tanpa tabel session).
// ============================================================================

export const NAMA_COOKIE = "siswa_session";
const UMUR_SESI_MS = 1000 * 60 * 60 * 12; // 12 jam

function ambilSecret(): string {
  return process.env.SISWA_SESSION_SECRET ?? "projek9-siswa-sesi-rahasia";
}

function tandaHmac(payload: string): string {
  return createHmac("sha256", ambilSecret()).update(payload).digest("hex");
}

export type SesiSiswa = {
  siswaId: string;
  username: string;
};

// Buat token sesi untuk cookie.
export function buatTokenSesi(sesi: SesiSiswa): string {
  const uuid = randomUUID();
  const payload = `${uuid}|${sesi.siswaId}|${sesi.username}`;
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const hmac = tandaHmac(payload);
  return `${b64}.${hmac}`;
}

// Verifikasi token; kembalikan sesi jika valid, null jika tidak.
export function bacaTokenSesi(token: string | undefined): SesiSiswa | null {
  if (!token || !token.includes(".")) return null;
  const titik = token.lastIndexOf(".");
  const b64 = token.slice(0, titik);
  const hmacSimpan = token.slice(titik + 1);

  if (!b64 || !hmacSimpan) return null;

  const payload = Buffer.from(b64, "base64url").toString("utf8");
  if (!payload) return null;

  // Perbandingan constant-time supaya tidak bocor lewat timing.
  const hmacSeharusnya = tandaHmac(payload);
  if (hmacSeharusnya.length !== hmacSimpan.length) return null;
  if (!timingSafeEqual(Buffer.from(hmacSimpan), Buffer.from(hmacSeharusnya))) {
    return null;
  }

  const bagian = payload.split("|");
  if (bagian.length !== 3) return null;
  const [, siswaId, username] = bagian;
  if (!siswaId || !username) return null;

  return { siswaId, username };
}

// Simpan cookie sesi setelah siswa login.
export async function simpanSesiSesi(sesi: SesiSiswa) {
  const token = buatTokenSesi(sesi);
  const store = await cookies();
  store.set(NAMA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(UMUR_SESI_MS / 1000),
    secure: process.env.NODE_ENV === "production",
  });
}

// Hapus cookie sesi (logout).
export async function hapusSesiSesi() {
  const store = await cookies();
  store.delete(NAMA_COOKIE);
}

// Ambil sesi siswa saat ini dari cookie.
export async function ambilSesiSiswa(): Promise<SesiSiswa | null> {
  const store = await cookies();
  return bacaTokenSesi(store.get(NAMA_COOKIE)?.value);
}

export type HasilRequireSiswa = {
  sesi: SesiSiswa;
  siswa: {
    id: string;
    nis: string | null;
    nama_siswa: string;
    kelas_id: string | null;
  };
  kelas: { id: string; nama_kelas: string } | null;
};

// Guard untuk semua halaman siswa:
//  1. Baca cookie sesi
//  2. Verifikasi siswa masih ada di DB
//  3. Kalau gagal, arahkan ke /logout-siswa (Route Handler yang menghapus
//     cookie) lalu ke /login-siswa.
//     Catatan: cookie TIDAK boleh diubah saat render Server Component.
export async function requireSiswa(): Promise<HasilRequireSiswa> {
  const sesi = await ambilSesiSiswa();
  if (!sesi) redirect("/login-siswa");

  const supabase = await createClient();

  const { data: account } = await supabase
    .from("student_accounts")
    .select("username, is_active, students(*)")
    .ilike("username", sesi.username)
    .maybeSingle();

  const students = (account as { students?: unknown; is_active: boolean } | null)
    ?.students;
  const isActive = (account as { is_active: boolean } | null)?.is_active;

  // Akun nonaktif → keluarkan sesi lewat route handler.
  if (!account || !students || isActive === false) {
    redirect("/logout-siswa");
  }

  const siswaRaw = (Array.isArray(students) ? students[0] : students) as
    | { id: string; nis: string | null; nama_siswa: string; kelas_id: string | null }
    | null;

  if (!siswaRaw) {
    redirect("/logout-siswa");
  }

  let kelas: { id: string; nama_kelas: string } | null = null;
  if (siswaRaw.kelas_id) {
    const { data: kelasData } = await supabase
      .from("classes")
      .select("id, nama_kelas")
      .eq("id", siswaRaw.kelas_id)
      .maybeSingle();
    kelas = (kelasData as { id: string; nama_kelas: string } | null) ?? null;
  }

  return { sesi, siswa: siswaRaw, kelas };
}
