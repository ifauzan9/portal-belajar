// ============================================================================
// ProgresBar — bilah progres dengan aksesibilitas bawaan.
// Menggantikan markup progress bar yang sebelumnya ditulis ulang di
// beberapa halaman (dashboard, daftar modul lab, peta level).
// ============================================================================

type Warna = "emerald" | "amber" | "slate" | "putih";

const WARNA_ISI: Record<Warna, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  slate: "bg-slate-700",
  putih: "bg-white",
};

const WARNA_LATAR: Record<Warna, string> = {
  emerald: "bg-slate-100",
  amber: "bg-amber-100",
  slate: "bg-slate-200",
  putih: "bg-white/25",
};

export function ProgresBar({
  nilai,
  label,
  warna = "emerald",
  ukuran = "md",
  className = "",
}: {
  // 0–100. Nilai di luar rentang dipotong.
  nilai: number;
  // Nama progres untuk pembaca layar (wajib agar bermakna).
  label: string;
  warna?: Warna;
  ukuran?: "sm" | "md";
  className?: string;
}) {
  const persen = Math.max(0, Math.min(100, Math.round(nilai)));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={persen}
      className={`w-full overflow-hidden rounded-full ${
        ukuran === "sm" ? "h-1.5" : "h-2.5"
      } ${WARNA_LATAR[warna]} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${WARNA_ISI[warna]}`}
        style={{ width: `${persen}%` }}
      />
    </div>
  );
}
