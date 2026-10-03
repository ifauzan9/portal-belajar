import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============================================================================
// Proxy — gerbang mode maintenance.
//
// Di Next.js 16 file "middleware" sudah diganti nama menjadi "proxy"
// (export fungsi bernama `proxy`). Kode ini jalan di sisi server sebelum
// halaman dirender.
//
// Kalau env var `MAINTENANCE_MODE` bernilai "1"/"true"/"on", semua permintaan
// halaman akan di-rewrite ke /maintenance TANPA mengubah URL di address bar.
// Aset statis & halaman /maintenance sendiri tetap lolos supaya tampilannya
// utuh.
//
// Cara pakai: set MAINTENANCE_MODE di Vercel (Settings → Environment
// Variables), lalu Redeploy. Untuk mematikan, ubah jadi "0" lalu Redeploy.
// ============================================================================

function maintenanceAktif() {
  const nilai = (process.env.MAINTENANCE_MODE ?? "").trim().toLowerCase();
  return nilai === "1" || nilai === "true" || nilai === "on";
}

export function proxy(request: NextRequest) {
  if (!maintenanceAktif()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Halaman maintenance sendiri harus tetap bisa dirender.
  if (pathname === "/maintenance") {
    return NextResponse.next();
  }

  // Rewrite: URL di browser tetap, isinya diganti halaman maintenance.
  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
  // Lewati aset statis (/_next, favicon, gambar, pyodide, template .xlsx, dll)
  // agar halaman maintenance tidak ikut memblokir file pendukungnya.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|wasm|zip|xlsx|json|txt|woff2?|ttf)$).*)",
  ],
};
