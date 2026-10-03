import type { ReactNode } from "react";

// ============================================================================
// Notifikasi — kotak pesan (sukses/gagal/info/peringatan) seragam.
// Menggantikan teks warna polos yang tidak konsisten antar halaman.
// ============================================================================

type Varian = "sukses" | "gagal" | "info" | "peringatan";

const VARIAN: Record<Varian, string> = {
  sukses: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  gagal: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-blue-50 text-blue-800 ring-blue-200",
  peringatan: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function Notifikasi({
  varian = "info",
  judul,
  children,
  className = "",
}: {
  varian?: Varian;
  judul?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 text-sm ring-1 ${VARIAN[varian]} ${className}`}
    >
      {judul ? <p className="font-semibold">{judul}</p> : null}
      <div className={judul ? "mt-1" : ""}>{children}</div>
    </div>
  );
}