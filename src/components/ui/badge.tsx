import type { ReactNode } from "react";

// ============================================================================
// Badge — label status kecil dengan varian warna seragam.
// Menggantikan badge inline yang kelasnya berbeda-beda antar halaman siswa.
// ============================================================================

type Varian =
  | "netral"
  | "info"
  | "sukses"
  | "peringatan"
  | "bahaya"
  | "ungu";

const VARIAN: Record<Varian, string> = {
  netral: "bg-slate-100 text-slate-600 ring-slate-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  sukses: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  peringatan: "bg-amber-50 text-amber-700 ring-amber-200",
  bahaya: "bg-red-50 text-red-700 ring-red-200",
  ungu: "bg-violet-50 text-violet-700 ring-violet-200",
};

// Titik indikator warna (opsional) — memakai warna solid sesuai varian.
const TITIK: Record<Varian, string> = {
  netral: "bg-slate-400",
  info: "bg-blue-500",
  sukses: "bg-emerald-500",
  peringatan: "bg-amber-500",
  bahaya: "bg-red-500",
  ungu: "bg-violet-500",
};

export function Badge({
  children,
  varian = "netral",
  titik = false,
  className = "",
}: {
  children: ReactNode;
  varian?: Varian;
  titik?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${VARIAN[varian]} ${className}`}
    >
      {titik ? (
        <span className={`h-1.5 w-1.5 rounded-full ${TITIK[varian]}`} />
      ) : null}
      {children}
    </span>
  );
}