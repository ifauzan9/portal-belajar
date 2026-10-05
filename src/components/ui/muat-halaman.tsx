// Indikator loading antar halaman (dipakai oleh loading.tsx tiap segmen).
export function MuatHalaman({ label = "Memuat halaman..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
      />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
