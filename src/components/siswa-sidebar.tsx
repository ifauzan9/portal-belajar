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

  return (
    <div className="border-b border-slate-200 bg-white sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-64 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
      {/* Header: identitas siswa */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:px-5 sm:py-5">
        <Link
          href={sedangUlangan ? pathname : "/siswa"}
          className="flex items-center gap-2.5 text-sm font-semibold text-slate-900"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <IkonDashboard className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-slate-900">{namaSiswa}</span>
            <span className="block truncate text-xs font-normal text-slate-400">
              {namaKelas ?? "Belum ada kelas"}
            </span>
          </span>
        </Link>

        {/* Tombol Keluar untuk layar kecil */}
        <form action={logoutSiswa} className="sm:hidden">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <IkonKeluar className="h-4 w-4" />
            Keluar
          </button>
        </form>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 sm:flex-col sm:px-3 sm:pb-0">
        {MENU.map((item) => {
          const nyala = aktif(item.href) && !sedangUlangan;
          return (
            <Link
              key={item.href}
              // Saat mengunci, semua menu menunjuk ke halaman ulangan
              // saat ini supaya siswa tidak bisa pergi ke mana pun.
              href={sedangUlangan ? pathname : item.href}
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                nyala
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <item.Ikon
                className={`h-5 w-5 shrink-0 ${
                  nyala ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
              {item.label}
            </Link>
          );
        })}

        {/* Indikator kunci saat sedang ulangan */}
        {sedangUlangan ? (
          <p className="mt-2 px-2 pb-1 text-[11px] font-medium text-amber-600 sm:mt-3">
            🔒 Navigasi terkunci selama mengerjakan
          </p>
        ) : null}
      </nav>

      {/* Tombol Keluar untuk layar besar */}
      <div className="hidden sm:mt-auto sm:block sm:p-3">
        <form action={logoutSiswa}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <IkonKeluar className="h-4 w-4" />
            Keluar
          </button>
        </form>
      </div>
    </div>
  );
}