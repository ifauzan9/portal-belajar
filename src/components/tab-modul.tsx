import Link from "next/link";

// ============================================================================
// TabModul — pemilih modul berbentuk pil untuk halaman rekap siswa.
// Modul aktif disimpan di query string (?modul=<id>) supaya:
//   - halaman tetap di modul yang sama setelah reset (revalidate),
//   - tautannya bisa dibagikan/di-bookmark,
//   - tidak perlu JavaScript klien.
// ============================================================================

export type ModulTab = {
  id: string;
  judul: string;
  selesai: number;
  total: number;
};

export function TabModul({
  daftar,
  aktifId,
  basePath,
}: {
  daftar: ModulTab[];
  aktifId: string;
  // Path halaman tanpa query, mis. "/guru/rekap/<siswaId>".
  basePath: string;
}) {
  if (daftar.length <= 1) return null;

  return (
    <nav
      aria-label="Pilih modul Lab Coding"
      className="nav-tanpa-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {daftar.map((modul) => {
        const aktif = modul.id === aktifId;
        const tuntas = modul.total > 0 && modul.selesai === modul.total;

        return (
          <Link
            key={modul.id}
            href={`${basePath}?modul=${modul.id}`}
            aria-current={aktif ? "page" : undefined}
            title={modul.judul}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              aktif
                ? "border-emerald-600 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/25"
                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            <span className="max-w-52 truncate">{modul.judul}</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                aktif
                  ? "bg-white/20 text-white"
                  : tuntas
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {tuntas ? `✓ ${modul.selesai}/${modul.total}` : `${modul.selesai}/${modul.total}`}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
