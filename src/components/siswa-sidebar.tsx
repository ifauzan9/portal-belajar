"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutSiswa } from "@/app/siswa/actions";
import {
  IkonAbsensi,
  IkonDashboard,
  IkonKeluar,
  IkonKomputer,
  IkonLab,
  IkonNilai,
  IkonPengumuman,
  IkonTugas,
} from "@/components/ui/ikon-siswa";

const MENU = [
  { href: "/siswa", label: "Dashboard", Ikon: IkonDashboard },
  { href: "/siswa/tugas", label: "Tugas", Ikon: IkonTugas },
  { href: "/siswa/lab", label: "Lab Coding", Ikon: IkonLab },
  { href: "/siswa/komputer", label: "Lab Komputer", Ikon: IkonKomputer },
  { href: "/siswa/nilai", label: "Nilai", Ikon: IkonNilai },
  { href: "/siswa/absensi", label: "Absensi", Ikon: IkonAbsensi },
  { href: "/siswa/pengumuman", label: "Pengumuman", Ikon: IkonPengumuman },
];

// Inisial untuk avatar, mis. "GHAISAN APRILLIO" -> "GA".
function buatInisial(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? "")
    .join("");
}

export function SiswaSidebar({
  namaSiswa,
  namaKelas,
}: {
  namaSiswa: string;
  namaKelas: string | null;
}) {
  const pathname = usePathname();

  // Kunci navigasi saat siswa sedang mengerjakan ulangan bersoal.
  // Link ke luar /siswa/ulangan/[id] diarahkan kembali ke halaman ulangan
  // (tidak pindah) sampai submit. Tombol logout tetap aktif.
  const sedangUlangan = /^\/siswa\/ulangan\/.+/u.test(pathname);

  // Menu aktif. /siswa/ulangan/* dianggap bagian dari "Nilai".
  const aktif = (href: string) => {
    if (href === "/siswa") {
      return pathname === "/siswa";
    }
    if (href === "/siswa/nilai") {
      return (
        pathname.startsWith("/siswa/nilai") ||
        pathname.startsWith("/siswa/ulangan")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const inisial = buatInisial(namaSiswa);

  return (
    <div className="border-b border-emerald-100 bg-white sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-64 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
      {/* Header: identitas siswa */}
      <div className="relative overflow-hidden bg-gradient-to-b from-emerald-50/80 to-white px-4 py-3 sm:px-5 sm:py-5">
        {/* Ornamen lingkaran dekoratif */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-8 h-24 w-24 rounded-full bg-emerald-200/30"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 -right-2 h-12 w-12 rounded-full bg-teal-200/30"
        />

        <div className="relative flex items-center justify-between gap-3">
          <Link
            href={sedangUlangan ? pathname : "/siswa"}
            className="group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold tracking-tight text-white shadow-sm shadow-emerald-600/30 ring-2 ring-white transition duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-emerald-600/40">
              {inisial || <IkonDashboard className="h-5 w-5" />}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[10px] font-semibold tracking-wider text-emerald-600 uppercase">
                Siswa
              </span>
              <span className="block truncate text-sm font-semibold text-slate-900">
                {namaSiswa}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                />
                {namaKelas ?? "Belum ada kelas"}
              </span>
            </span>
          </Link>

          {/* Tombol Keluar untuk layar kecil */}
          <form action={logoutSiswa} className="shrink-0 sm:hidden">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            >
              <IkonKeluar className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </div>

      <nav
        aria-label="Menu siswa"
        className="nav-tanpa-scrollbar nav-mask-kanan flex gap-1 overflow-x-auto px-3 pb-3 sm:flex-col sm:px-3 sm:pb-0"
      >
        {MENU.map((item, indeks) => {
          const nyala = aktif(item.href) && !sedangUlangan;
          return (
            <Link
              key={item.href}
              // Saat mengunci, semua menu menunjuk ke halaman ulangan
              // saat ini supaya siswa tidak bisa pergi ke mana pun.
              href={sedangUlangan ? pathname : item.href}
              aria-current={nyala ? "page" : undefined}
              aria-disabled={sedangUlangan ? true : undefined}
              style={{ animationDelay: `${indeks * 55}ms` }}
              className={`nav-masuk group relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                nyala
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/25"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              } ${sedangUlangan ? "opacity-60" : ""}`}
            >
              {/* Batang penanda menu aktif */}
              {nyala ? (
                <span
                  aria-hidden="true"
                  className="nav-tanda absolute inset-y-2 left-0 w-1 rounded-full bg-emerald-200"
                />
              ) : null}

              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
                  nyala
                    ? "bg-white/15 text-white"
                    : "bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600"
                }`}
              >
                <item.Ikon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              </span>

              <span className="relative">{item.label}</span>
            </Link>
          );
        })}

        {/* Indikator kunci saat sedang ulangan */}
        {sedangUlangan ? (
          <p className="nav-denyut mt-2 flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold text-amber-600 sm:mt-3">
            <span aria-hidden="true">🔒</span>
            Navigasi terkunci selama mengerjakan
          </p>
        ) : null}
      </nav>

      {/* Tombol Keluar untuk layar besar */}
      <div className="hidden border-t border-slate-100 p-3 sm:mt-auto sm:block">
        <form action={logoutSiswa}>
          <button
            type="submit"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            <IkonKeluar className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Keluar
          </button>
        </form>
      </div>
    </div>
  );
}
