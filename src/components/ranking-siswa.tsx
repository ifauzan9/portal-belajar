import { Kartu, KartuJudul } from "@/components/ui/kartu";
import type { BarisPeringkat, PosisiSaya } from "@/lib/ranking-ulangan";

// ============================================================================
// Ranking ulangan di sisi siswa.
//
// NILAI per siswa sengaja TIDAK ditampilkan — hanya peringkat, nama, dan
// kelas. Peringkat tetap memberi gambaran posisi tanpa membocorkan skor
// teman sekelas.
// ============================================================================

// Warna lencana peringkat: emas / perak / perunggu, sisanya netral.
function warnaPeringkat(peringkat: number): string {
  if (peringkat === 1) return "bg-amber-100 text-amber-800 ring-amber-200";
  if (peringkat === 2) return "bg-slate-200 text-slate-700 ring-slate-300";
  if (peringkat === 3) return "bg-orange-100 text-orange-800 ring-orange-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

// Warna angka besar pada kartu posisi.
function warnaAngkaPosisi(peringkat: number): string {
  if (peringkat === 1) return "text-amber-600";
  if (peringkat === 2) return "text-slate-600";
  if (peringkat === 3) return "text-orange-600";
  return "text-slate-900";
}

// Card posisi ranking siswa sendiri.
export function KartuPosisiRanking({
  posisi,
  totalDinilai,
}: {
  posisi: PosisiSaya;
  totalDinilai: number;
}) {
  return (
    <Kartu>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        Posisi kamu
      </p>

      {posisi ? (
        <>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <span
              className={`text-4xl font-bold tabular-nums ${warnaAngkaPosisi(
                posisi.ranking,
              )}`}
            >
              #{posisi.ranking}
            </span>
            <span className="pb-1 text-sm text-slate-500">
              dari {totalDinilai} siswa yang sudah dinilai
            </span>
          </div>
          {posisi.tiedWith > 1 ? (
            <p className="mt-1 text-xs text-slate-400">
              Seri — {posisi.tiedWith} siswa di posisi ini.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold text-slate-400">–</p>
          <p className="mt-1 text-xs text-slate-500">
            Posisimu belum tersedia — nilaimu belum dinilai.
          </p>
        </>
      )}
    </Kartu>
  );
}

// Papan peringkat seluruh siswa. Tanpa kolom nilai.
export function PapanPeringkatSiswa({
  daftar,
  siswaId,
  totalSiswa,
}: {
  daftar: BarisPeringkat[];
  siswaId: string;
  totalSiswa: number;
}) {
  const belumDinilai = Math.max(0, totalSiswa - daftar.length);

  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="p-5 pb-0">
        <KartuJudul
          judul="Ranking Seluruh Siswa"
          subjudul="Nilai tidak ditampilkan. Hanya siswa yang sudah dinilai yang masuk ranking."
        />
      </div>

      {daftar.length > 0 ? (
        <div className="mt-4 max-h-[26rem] overflow-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="sticky top-0 border-y border-slate-200 bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="w-24 px-4 py-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                >
                  Peringkat
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                >
                  Nama
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                >
                  Kelas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daftar.map((s) => {
                const saya = s.id === siswaId;
                return (
                  <tr
                    key={s.id}
                    className={
                      saya ? "bg-blue-50/70" : "transition hover:bg-slate-50"
                    }
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ring-1 ${warnaPeringkat(
                          s.ranking,
                        )}`}
                      >
                        {s.ranking}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate">{s.nama}</span>
                        {saya ? (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
                            Kamu
                          </span>
                        ) : null}
                        {s.tiedWith > 1 ? (
                          <span className="text-[10px] text-slate-400">
                            (seri)
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.namaKelas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 px-5 pb-5 text-sm text-slate-500">
          Belum ada siswa yang dinilai untuk ulangan ini.
        </p>
      )}

      {belumDinilai > 0 ? (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          {belumDinilai} siswa belum dinilai dan belum masuk ranking.
        </p>
      ) : null}
    </section>
  );
}

// Card terkunci saat guru masih menahan nilai.
export function RankingTertahan() {
  return (
    <div className="rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-200">
      <p className="text-sm font-medium text-violet-800">
        🔒 Ranking ditahan oleh guru
      </p>
      <p className="mt-1 text-xs text-violet-600">
        Papan peringkat akan muncul setelah gurumu membuka nilai.
      </p>
    </div>
  );
}
