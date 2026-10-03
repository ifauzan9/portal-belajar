"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/guru/actions";

type IkonProps = { className?: string };

function IkonDashboard({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IkonKelas({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M8 21h8M12 17v4" />
      <path d="M7 9h6M7 12h3" />
    </svg>
  );
}

function IkonSiswa({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 2 8l10 5 10-5-10-5Z" />
      <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
      <path d="M22 8v5" />
    </svg>
  );
}

function IkonRekap({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6h2M4 12h2M4 18h2" />
      <path d="M10 6h10M10 12h10M10 18h7" />
    </svg>
  );
}

function IkonAbsensi({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

function IkonPengumuman({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M14 8a5 5 0 0 1 0 8" />
      <path d="M17 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function IkonUlangan({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function IkonStatistik({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function IkonTugas({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M15 4v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IkonLab({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
      <path d="M13 5 11 19" />
    </svg>
  );
}

function IkonLog({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function IkonKomputer({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function IkonKeluar({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

const MENU = [
  { href: "/guru", label: "Dashboard", Ikon: IkonDashboard },
  { href: "/guru/kelas", label: "Kelas", Ikon: IkonKelas },
  { href: "/guru/siswa", label: "Siswa", Ikon: IkonSiswa },
  { href: "/guru/rekap", label: "Rekap Siswa", Ikon: IkonRekap },
  { href: "/guru/absensi", label: "Absensi", Ikon: IkonAbsensi },
  { href: "/guru/pengumuman", label: "Pengumuman", Ikon: IkonPengumuman },
  { href: "/guru/ulangan", label: "Ulangan", Ikon: IkonUlangan },
  { href: "/guru/tugas", label: "Tugas", Ikon: IkonTugas },
  { href: "/guru/lab", label: "Lab Coding", Ikon: IkonLab },
  { href: "/guru/komputer", label: "Lab Komputer", Ikon: IkonKomputer },
  { href: "/guru/statistik", label: "Statistik", Ikon: IkonStatistik },
  { href: "/guru/log-login", label: "Log Login", Ikon: IkonLog },
];

export function GuruSidebar() {
  const pathname = usePathname();

  // Halaman anak (mis. /guru/siswa/import) tetap menyalakan menu induknya.
  const aktif = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="border-b border-slate-200 bg-white sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-60 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:px-5 sm:py-5">
        <Link
          href="/guru"
          className="flex items-center gap-2.5 text-sm font-semibold text-slate-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
            <IkonSiswa className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            Portal
            <br className="hidden sm:block" /> Pembelajaran
          </span>
        </Link>

        {/* Tombol Keluar untuk layar kecil */}
        <form action={logout} className="sm:hidden">
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
          const nyala = aktif(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                nyala
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <item.Ikon
                className={`h-5 w-5 shrink-0 ${
                  nyala ? "text-white" : "text-slate-400 group-hover:text-emerald-600"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Tombol Keluar untuk layar besar */}
      <div className="hidden sm:mt-auto sm:block sm:p-3">
        <form action={logout}>
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