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
  basePath = "/siswa/lab",
}: {
  lessonId: string;
  levels: { level: number; judul: string }[];
  selesai: number[];
  dikerjakan: number[];
  aktif: number;
  basePath?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Navigasi Level
        </p>
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-emerald-600">
            {selesai.length}
          </span>{" "}
          / {levels.length} selesai
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {levels.map((item) => {
          const sudah = selesai.includes(item.level);
          const dicoba = dikerjakan.includes(item.level);
          const sedang = item.level === aktif;

          return (
            <Link
              key={item.level}
              href={`${basePath}/${lessonId}/${item.level}`}
              title={`Level ${item.level} — ${item.judul}`}
              aria-current={sedang ? "page" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
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

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Sudah benar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> Sudah dicoba
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Belum
        </span>
      </div>
    </div>
  );
}
