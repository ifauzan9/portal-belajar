import { NextResponse } from "next/server";
import { NAMA_COOKIE } from "@/lib/sesi-siswa";

// Keluar paksa portal siswa: hapus cookie sesi lalu arahkan ke halaman login.
// Dipakai oleh requireSiswa saat akun siswa nonaktif / sudah dihapus.
// Cookie hanya boleh diubah di Route Handler atau Server Action — bukan
// saat render Server Component (kalau tidak, Next.js melempar error).
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login-siswa", request.url));
  response.cookies.set(NAMA_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
