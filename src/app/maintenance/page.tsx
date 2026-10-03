import type { Metadata } from "next";

// Halaman yang ditampilkan ke pengguna saat mode maintenance aktif.
// Diaktifkan lewat env var MAINTENANCE_MODE (lihat src/proxy.ts).

export const metadata: Metadata = {
  title: "Sedang Maintenance — Portal Pembelajaran",
  description: "Portal sedang dalam perbaikan. Silakan coba lagi nanti.",
};

export default function HalamanMaintenance() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-7 w-7 text-white"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-slate-900">
          Sedang Maintenance
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Portal sedang dalam perbaikan. Silakan coba beberapa saat lagi ya.
        </p>

        <a
          href="/"
          className="mt-8 inline-block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Muat ulang
        </a>

        <p className="mt-4 text-xs text-slate-400">
          Terima kasih atas kesabarannya.
        </p>
      </div>
    </main>
  );
}
