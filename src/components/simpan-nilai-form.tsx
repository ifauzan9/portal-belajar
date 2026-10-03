"use client";

import { useActionState, useRef, useEffect } from "react";
import { simpanNilaiBatch } from "@/app/guru/ulangan/actions";
import type { InfoRanking } from "@/app/guru/ulangan/[id]/nilai/page";

type SiswaBaris = {
  id: string;
  nis: string | null;
  nama_siswa: string;
  nilai: number | null;
};

// Warna badge ranking 3 teratas (lainnya polos).
const BADA_RANCING = [
  "bg-amber-100 text-amber-800 ring-amber-200",
  "bg-slate-100 text-slate-700 ring-slate-300",
  "bg-orange-100 text-orange-800 ring-orange-200",
];

// Nilai import dari Excel: siswaId → nilai.
// Form di-render dengan nilaiTampil = nilaiImport ?? nilai DB.
// onTersimpan dipanggil setelah simpanNilaiBatch sukses (message === null).
export function SimpanNilaiForm({
  examId,
  daftarSiswa,
  nilaiImport,
  onTersimpan,
  ranking,
  mapSiswaIdKeNamaKelas,
}: {
  examId: string;
  daftarSiswa: SiswaBaris[];
  nilaiImport: Map<string, number> | null;
  onTersimpan?: () => void;
  ranking: Map<string, InfoRanking>;
  // Nama kelas per siswaId (untuk kolom "Kelas" di tabel input nilai)
  mapSiswaIdKeNamaKelas: Map<string, string>;
}) {
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(simpanNilaiBatch, { message: null });

  // Nilai yang ditampilkan di input:
  //   1) nilaiImport (dari Excel, prioritas)
  //   2) nilai lama dari DB
  const nilaiTampil = (siswa: SiswaBaris): string => {
    if (nilaiImport && nilaiImport.has(siswa.id)) {
      return String(nilaiImport.get(siswa.id));
    }
    return siswa.nilai !== null ? String(siswa.nilai) : "";
  };

  const sudahTerisi = daftarSiswa.filter((s) => nilaiTampil(s) !== "").length;

  // Deteksi sukses simpan (pending: true → false, tanpa pesan galat)
  // dan kabarkan ke parent supaya pratinjau bisa ditutup.
  const pendingRef = useRef(pending);
  const stateRef = useRef(state);
  useEffect(() => {
    const wasPending = pendingRef.current;
    const hadGalat = stateRef.current.message !== null;
    pendingRef.current = pending;
    stateRef.current = state;

    if (wasPending && !pending && !hadGalat) {
      onTersimpan?.();
    }
  }, [pending, state, onTersimpan]);

  return (
    <form action={formAction}>
      <input type="hidden" name="exam_id" value={examId} />

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="w-12 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                >
                  No
                </th>
                <th
                  scope="col"
                  className="w-16 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                >
                  Ranking
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                >
                  NIS
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                >
                  Nama
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                >
                  Kelas
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                >
                  Nilai (0–100)
                </th>
              </tr>
            </thead>
            <tbody
              key={nilaiImport ? nilaiImport.size : "db"}
              className="divide-y divide-slate-100"
            >
              {daftarSiswa.map((siswa, index) => (
                <tr key={siswa.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    {(() => {
                      const info = ranking.get(siswa.id);
                      if (!info || info.ranking === null) {
                        return <span className="text-slate-300">-</span>;
                      }
                      const idx = info.ranking - 1;
                      return (
                        <span
                          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ring-1 ${
                            BADA_RANCING[idx] ??
                            "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {info.ranking}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums sm:px-5">
                    {siswa.nis ?? "-"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 sm:px-5">
                    {siswa.nama_siswa}
                  </td>
                  <td className="px-4 py-3 text-slate-500 sm:px-5">
                    {mapSiswaIdKeNamaKelas.get(siswa.id) ?? "-"}
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <input
                      type="number"
                      name={`nilai_${siswa.id}`}
                      min={0}
                      max={100}
                      step={1}
                      defaultValue={nilaiTampil(siswa)}
                      placeholder="Kosongkan kalau belum dinilai"
                      className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-slate-500">
            {sudahTerisi} dari {daftarSiswa.length} siswa sudah dinilai
            {nilaiImport && nilaiImport.size > 0
              ? ` (${nilaiImport.size} dari Excel)`
              : ""}
          </p>

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Menyimpan..." : "Simpan Nilai"}
          </button>
        </div>

        {state.message ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-red-600 sm:px-5">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
