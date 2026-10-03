import type { ReactNode } from "react";

// ============================================================================
// EmptyState — tampilan saat daftar/data kosong, seragam di semua halaman.
// Menggantikan paragraf teks abu-abu polos yang berbeda-beda.
// ============================================================================

export function EmptyState({
  ikon,
  judul,
  keterangan,
  aksi,
  padat = false,
}: {
  // Ikon opsional di atas judul (mis. <IkonSiswa className="h-6 w-6" />).
  ikon?: ReactNode;
  judul: string;
  keterangan?: string;
  aksi?: ReactNode;
  // Versi lebih ringkas (padding kecil) untuk di dalam daftar/kartu.
  padat?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        padat ? "px-4 py-6" : "px-4 py-10"
      }`}
    >
      {ikon ? (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {ikon}
        </span>
      ) : null}
      <p className="text-sm font-medium text-slate-700">{judul}</p>
      {keterangan ? (
        <p className="mt-1 max-w-sm text-xs text-slate-500">{keterangan}</p>
      ) : null}
      {aksi ? <div className="mt-3">{aksi}</div> : null}
    </div>
  );
}