import Link from "next/link";
import { ProgresBar } from "@/components/ui/progres";

// Menu navigasi level di halaman pengerjaan:
// - hijau  = sudah dikerjakan DAN benar (pernah_benar)
// - kuning = sudah dicoba tapi belum benar
// - abu    = belum dikerjakan
// Level yang sedang dibuka diberi ring emerald gelap.
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
  const persen =
    levels.length > 0
      ? Math.round((selesai.length / levels.length) * 100)
      : 0;

  return (
    <div className="rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-200 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-xs text-white"
          >
            ✓
          </span>
          Progres tantangan
        </h2>
        <p className="text-sm text-emerald-800">
          <span className="font-bold text-emerald-700">{selesai.length}</span>{" "}
          dari {levels.length} benar
        </p>
      </div>

      <ProgresBar
        nilai={persen}
        label={`Progres tantangan ${selesai.length} dari ${levels.length}`}
        ukuran="sm"
        className="mt-3"
      />

      <div className="mt-4 flex flex-wrap gap-2">
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
                className="flex min-h-11 min-w-11 cursor-not-allowed flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 text-[11px] font-medium leading-tight text-slate-400"
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
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl text-sm font-bold shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                sudah
                  ? "bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-700"
                  : dicoba
                    ? "bg-amber-300 text-amber-950 shadow-amber-400/30 hover:bg-amber-400"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-emerald-300"
              } ${
                sedang ? "ring-2 ring-emerald-900 ring-offset-2 ring-offset-emerald-50" : ""
              }`}
            >
              {sudah ? "✓" : item.level}
            </Link>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-emerald-900">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 items-center justify-center rounded bg-emerald-600 text-[9px] text-white"
          >
            ✓
          </span>
          Sudah benar
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded bg-amber-300 ring-1 ring-amber-400"
          />
          Sudah dicoba
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded bg-white ring-1 ring-slate-300"
          />
          Belum dikerjakan
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true">🔒</span> Terkunci
        </li>
      </ul>
    </div>
  );
}
