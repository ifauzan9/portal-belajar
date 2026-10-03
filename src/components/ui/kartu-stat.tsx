import type { ReactNode } from "react";

// ============================================================================
// KartuStat — kartu statistik ringkas (label + angka) dengan varian warna.
// Menggantikan markup kartu statistik ad-hoc di /siswa dan /siswa/nilai.
// ============================================================================

type Warna = "netral" | "emerald" | "amber" | "biru" | "merah";

const WARNA_ANGKA: Record<Warna, string> = {
  netral: "text-slate-900",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  biru: "text-blue-600",
  merah: "text-red-600",
};

export function KartuStat({
  label,
  nilai,
  warna = "netral",
  catatan,
  ikon,
}: {
  label: string;
  nilai: ReactNode;
  warna?: Warna;
  catatan?: string;
  ikon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        {ikon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {ikon}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${WARNA_ANGKA[warna]}`}
      >
        {nilai}
      </p>
      {catatan ? (
        <p className="mt-1 text-xs text-slate-400">{catatan}</p>
      ) : null}
    </div>
  );
}