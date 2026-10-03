"use client";

import { useState, useActionState } from "react";
import { simpanNilaiEsai } from "@/app/guru/ulangan/actions";

type SubmitRow = {
  id: string;
  siswa_id: string;
  nilai_pg: number;
  nilai_esai: number;
  nilai_total: number;
  disubmit_at: string;
  namaSiswa: string;
  nis: string | null;
  // Detail jawaban per soal (soalId → jawaban siswa)
  daftarJawaban: { soalId: string; jawaban: string }[];
  // Nilai esai yang sudah tersimpan per soal (soalId → nilai). null = belum.
  nilaiEsaiPerSoal: Record<string, number> | null;
};

type SoalEsai = { id: string; urutan: number; potongan: string };

export function DaftarJawaban({
  examId,
  daftarSubmit,
  soalCount,
  probeCounts,
  daftarSoalEsai,
}: {
  examId: string;
  daftarSubmit: SubmitRow[];
  soalCount: number;
  // Jumlah probe (kiri halaman / pindah tab / minimize) per siswa_id.
  // null = fitur belum aktif (DDL Tahap 11 belum dijalankan).
  probeCounts: Record<string, number> | null;
  // Daftar soal esai (urut) untuk input nilai per soal.
  daftarSoalEsai: SoalEsai[];
}) {
  const [bukaId, setBukaId] = useState<string | null>(null);

  const [stateEsai, formActionEsai, pendingEsai] = useActionState<
    { message: string | null },
    FormData
  >(simpanNilaiEsai, { message: null });

  // Hitung total nilai esai per siswa dari input per soal (untuk display
  // live sebelum simpan). Mengambil nilai tersimpan atau input lokal.
  const hitungTotalEsai = (row: SubmitRow): number => {
    const nilaiPerSoal = row.nilaiEsaiPerSoal ?? {};
    let total = 0;
    for (const s of daftarSoalEsai) {
      total += nilaiPerSoal[s.id] ?? 0;
    }
    return total;
  };

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Jawaban Siswa
        </h2>
        <span className="text-xs text-slate-400">
          {soalCount} soal · {daftarSubmit.length} submit
        </span>
      </div>

      {daftarSubmit.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Belum ada siswa yang submit jawaban.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {daftarSubmit.map((row) => (
            <div
              key={row.id}
              className="rounded-xl ring-1 ring-slate-100 transition hover:ring-slate-200"
            >
              {/* Baris ringkas */}
              <button
                type="button"
                onClick={() => setBukaId(bukaId === row.id ? null : row.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900">
                    {row.namaSiswa}
                    {row.nis ? (
                      <span className="ml-1 text-xs text-slate-400">
                        NIS {row.nis}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(row.disubmit_at).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  {probeCounts && probeCounts[row.siswa_id] !== undefined ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-medium ring-1 ${
                        probeCounts[row.siswa_id] > 0
                          ? "bg-rose-50 text-rose-700 ring-rose-200"
                          : "bg-slate-50 text-slate-500 ring-slate-200"
                      }`}
                      title="Jumlah kali meninggalkan halaman / pindah tab / minimize"
                    >
                      ⚠ {probeCounts[row.siswa_id]}×
                    </span>
                  ) : null}
                  <span className="text-blue-600">PG: {row.nilai_pg}</span>
                  <span className="text-amber-600">
                    Esai: {row.nilai_esai}
                  </span>
                  <span className="font-semibold text-slate-900">
                    Total: {row.nilai_total}
                  </span>
                  <span className="text-slate-400">
                    {bukaId === row.id ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Detail jawaban */}
              {bukaId === row.id ? (
                <div className="border-t border-slate-100 px-4 py-4">
                  {/* Ringkasan probe */}
                  {probeCounts && probeCounts[row.siswa_id] !== undefined ? (
                    <div
                      className={`mb-3 rounded-lg p-2.5 text-xs ring-1 ${
                        probeCounts[row.siswa_id] > 0
                          ? "bg-rose-50 text-rose-700 ring-rose-200"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      }`}
                    >
                      {probeCounts[row.siswa_id] > 0
                        ? `⚠ Siswa ini meninggalkan halaman / pindah tab / minimize sebanyak ${probeCounts[row.siswa_id]} kali selama pengerjaan.`
                        : "✓ Siswa tidak pernah meninggalkan halaman soal selama pengerjaan."}
                    </div>
                  ) : null}

                  {row.daftarJawaban.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {row.daftarJawaban.map((j, i) => {
                        // Tampilkan label urutan soal esai kalau ini soal esai
                        const soalEsaiInfo = daftarSoalEsai.find(
                          (s) => s.id === j.soalId,
                        );
                        return (
                          <div
                            key={j.soalId}
                            className="rounded-lg bg-slate-50 p-3 text-xs"
                          >
                            <p className="font-medium text-slate-500">
                              {soalEsaiInfo
                                ? `Soal Esai #${soalEsaiInfo.urutan}`
                                : `Soal #${i + 1}`}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-slate-900">
                              {j.jawaban || (
                                <span className="text-slate-400">
                                  (belum dijawab)
                                </span>
                              )}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Belum ada detail jawaban.
                    </p>
                  )}

                  {/* Form nilai esai per soal */}
                  {daftarSoalEsai.length > 0 ? (
                    <form
                      action={formActionEsai}
                      className="mt-4 rounded-xl bg-amber-50/50 p-4 ring-1 ring-amber-100"
                    >
                      <input
                        type="hidden"
                        name="exam_id"
                        value={examId}
                      />
                      <input
                        type="hidden"
                        name="siswa_id"
                        value={row.siswa_id}
                      />
                      <p className="mb-2 text-xs font-semibold text-amber-800">
                        Nilai Esai per Soal (0–100)
                      </p>
                      <div className="space-y-2">
                        {daftarSoalEsai.map((s) => (
                          <div
                            key={s.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <label className="min-w-0 flex-1 text-xs text-slate-600">
                              <span className="font-medium text-slate-700">
                                Soal Esai #{s.urutan}
                              </span>
                              <span className="ml-1 text-slate-400">
                                — {s.potongan}
                              </span>
                            </label>
                            <input
                              type="number"
                              name={`nilai_esai_${s.id}`}
                              min={0}
                              max={100}
                              defaultValue={
                                row.nilaiEsaiPerSoal?.[s.id] ?? 0
                              }
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={pendingEsai}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {pendingEsai
                            ? "Menyimpan..."
                            : "Simpan Nilai Esai"}
                        </button>
                        <p className="text-xs text-slate-400">
                          Total esai:{" "}
                          <span className="font-medium text-slate-600">
                            {hitungTotalEsai(row)}
                          </span>{" "}
                          dari {daftarSoalEsai.length} soal esai
                        </p>
                      </div>
                      {stateEsai.message ? (
                        <p className="mt-2 text-xs text-red-600">
                          {stateEsai.message}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <p className="mt-4 text-xs text-slate-400">
                      Ulangan ini tidak punya soal esai.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
