import Link from "next/link";
import type { ReactNode } from "react";

// ============================================================================
// HeroSiswa — banner gradien emerald untuk identitas halaman siswa.
// Dipakai di dashboard dan halaman Lab Coding agar terasa satu keluarga.
// ============================================================================

export function HeroSiswa({
  atas,
  label,
  judul,
  subjudul,
  ikon,
  aksi,
  children,
}: {
  // Slot di atas judul, biasanya breadcrumb "← Kembali".
  atas?: ReactNode;
  // Teks kecil berhuruf kapital di atas judul.
  label?: string;
  judul: string;
  subjudul?: ReactNode;
  // Ikon/avatar di kiri judul.
  ikon?: ReactNode;
  // Tombol/tautan di kanan.
  aksi?: ReactNode;
  // Konten tambahan di bawah (mis. progress bar).
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-900/10 sm:p-7">
      {/* Ornamen lingkaran dekoratif */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -bottom-24 h-56 w-56 rounded-full bg-emerald-400/20"
      />

      <div className="relative">
        {atas ? <div className="mb-3">{atas}</div> : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            {ikon ? (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25">
                {ikon}
              </span>
            ) : null}
            <div className="min-w-0">
              {label ? (
                <p className="text-[11px] font-semibold tracking-wider text-emerald-100 uppercase">
                  {label}
                </p>
              ) : null}
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-balance sm:text-2xl">
                {judul}
              </h1>
              {subjudul ? (
                <p className="mt-1 text-sm text-emerald-50/90">{subjudul}</p>
              ) : null}
            </div>
          </div>

          {aksi ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {aksi}
            </div>
          ) : null}
        </div>

        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}

// Tombol putih di dalam hero (kontras tinggi, aman untuk teks emerald).
export function TombolHero({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </Link>
  );
}
