import type { ReactNode } from "react";

// ============================================================================
// Kartu — panel putih dengan ring tipis, dipakai untuk semua section.
// Menyeragamkan "rounded-2xl bg-white p-5 ring-1 ring-slate-200" yang
// sebelumnya ditulis berulang di banyak halaman siswa.
// ============================================================================

type KartuProps = {
  children: ReactNode;
  // Padding lebih kecil untuk kartu yang rapat (mis. item daftar).
  padat?: boolean;
  className?: string;
};

export function Kartu({ children, padat = false, className = "" }: KartuProps) {
  return (
    <section
      className={`rounded-2xl bg-white ring-1 ring-slate-200 ${
        padat ? "p-4" : "p-5"
      } ${className}`}
    >
      {children}
    </section>
  );
}

// Judul section dengan subjudul opsional + slot aksi di kanan.
export function KartuJudul({
  judul,
  subjudul,
  aksi,
}: {
  judul: string;
  subjudul?: string;
  aksi?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{judul}</h2>
        {subjudul ? (
          <p className="mt-1 text-xs text-slate-500">{subjudul}</p>
        ) : null}
      </div>
      {aksi ? <div className="shrink-0">{aksi}</div> : null}
    </div>
  );
}