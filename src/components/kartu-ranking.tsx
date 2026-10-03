type BarisRanking = {
  nama: string;
  nis: string | null;
  nilai: number;
  ranking: number;
};

// Warna lencana berdasarkan posisi (peringkat).
const WARNAPEDUMAN = [
  "bg-amber-100 text-amber-800 ring-amber-200", // emas
  "bg-slate-100 text-slate-700 ring-slate-200", // perak
  "bg-orange-100 text-orange-800 ring-orange-200", // perunggu
];

export function KartuRanking({
  judul,
  daftar,
}: {
  judul: string;
  daftar: BarisRanking[];
}) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">{judul}</h2>
      <p className="mt-1 text-xs text-slate-500">
        Berdasarkan nilai yang sudah tersimpan.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {daftar.map((s, i) => (
          <div
            key={s.nama + s.nilai}
            className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${
                WARNAPEDUMAN[i] ?? "bg-slate-100 text-slate-600 ring-slate-200"
              }`}
            >
              {s.ranking}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {s.nama}
              </p>
              <p className="text-xs tabular-nums text-slate-500">
                {s.nilai}
                {s.nis ? ` · ${s.nis}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
