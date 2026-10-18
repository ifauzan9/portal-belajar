import type { ReactNode } from "react";

// ============================================================================
// KartuStat — kartu statistik ringkas (label + angka) dengan varian warna.
// Menggantikan markup kartu statistik ad-hoc di /siswa dan /siswa/nilai.
// ============================================================================

type Warna = "netral" | "emerald" | "amber" | "biru" | "merah";
type Aksen = Warna | "ungu";

const WARNA_ANGKA: Record<Warna, string> = {
  netral: "text-slate-900",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  biru: "text-blue-600",
  merah: "text-red-600",
};

// Aksen opsional: memberi tinta pada tile ikon + garis warna di atas kartu.
// Tanpa `aksen`, tampilan tetap seperti sebelumnya (netral).
const AKSEN_TILE: Record<Aksen, string> = {
  netral: "bg-slate-100 text-slate-500",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  biru: "bg-blue-100 text-blue-700",
  merah: "bg-red-100 text-red-700",
  ungu: "bg-violet-100 text-violet-700",
};

const AKSEN_GARIS: Record<Aksen, string> = {
  netral: "bg-slate-200",
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  biru: "bg-blue-500",
  merah: "bg-red-500",
  ungu: "bg-violet-500",
};

export function KartuStat({
  label,
  nilai,
  warna = "netral",
  catatan,
  ikon,
  aksen,
}: {
  label: string;
  nilai: ReactNode;
  warna?: Warna;
  catatan?: string;
  ikon?: ReactNode;
  // Beri warna pada kartu. Tanpa prop ini, kartu tetap netral.
  aksen?: Aksen;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      {aksen ? (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-1 ${AKSEN_GARIS[aksen]}`}
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        {ikon ? (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              aksen ? AKSEN_TILE[aksen] : "bg-slate-100 text-slate-500"
            }`}
          >
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
