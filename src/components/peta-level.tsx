import Link from "next/link";

// Menu navigasi level di halaman pengerjaan:
// - hijau  = sudah dikerjakan DAN benar (pernah_benar)
// - kuning = sudah dicoba tapi belum benar
// - abu    = belum dikerjakan
// Level yang sedang dibuka diberi ring gelap.
export function PetaLevel({
  lessonId,
  levels,
  selesai,
  dikerjakan,
  aktif,
  terkunci = [],
  basePath = "/siswa/lab",
}: {
  lessonId: string;
  levels: { level: number; judul: string }[];
  selesai: number[];
  dikerjakan: number[];
  aktif: number;
  terkunci?: number[];
  basePath?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Progres tantangan</h2>
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-emerald-700">{selesai.length}</span>{" "}
          dari {levels.length} benar
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {levels.map((item) => {
          const sudah = selesai.includes(item.level);
          const dicoba = dikerjakan.includes(item.level);
          const sedang = item.level === aktif;
          const kunci = terkunci.includes(item.level);

          if (kunci) {
            return (
              <span
                key={item.level}
                role="img"
                aria-label={`Level ${item.level}, terkunci. Selesaikan level sebelumnya dulu.`}
                className="flex min-h-11 min-w-11 cursor-not-allowed flex-col items-center justify-center rounded-xl bg-slate-100 text-[11px] font-medium leading-tight text-slate-500 ring-1 ring-slate-200"
              >
                <span aria-hidden="true">{item.level}</span>
                <span aria-hidden="true">🔒</span>
              </span>
            );
          }

          return (
            <Link
              key={item.level}
              href={`${basePath}/${lessonId}/${item.level}`}
              aria-label={`Level ${item.level}: ${item.judul}${sudah ? ", sudah benar" : dicoba ? ", sudah dicoba" : ", belum dikerjakan"}${sedang ? ", sedang dibuka" : ""}`}
              aria-current={sedang ? "page" : undefined}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                sudah
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : dicoba
                    ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300 hover:bg-amber-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              } ${
                sedang ? "ring-2 ring-slate-900 ring-offset-1" : ""
              }`}
            >
              {sudah ? "✓" : item.level}
            </Link>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="font-bold text-emerald-700">✓</span> Sudah benar
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="font-bold text-amber-700">•</span> Sudah dicoba
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="font-bold text-slate-500">○</span> Belum dikerjakan
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true">🔒</span> Terkunci
        </li>
      </ul>
    </div>
  );
}
