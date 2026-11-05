"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import {
  simpanNilaiEsai,
  simpanNilaiKodeManual,
} from "@/app/guru/ulangan/actions";
import { TombolReset } from "@/components/tombol-reset";
import { formatWaktuWib } from "@/lib/waktu";

type KodeJawaban = {
  soalId: string;
  kode: string;
  keluaran: string;
  keluaranUji: string | null;
  nilai: number;
  rincian: { terpenuhi?: string[]; belum?: string[] } | null;
  percobaan: number;
};

type SubmitRow = {
  id: string;
  siswa_id: string;
  nilai_pg: number;
  nilai_esai: number;
  nilai_kode: number;
  nilai_kode_manual: number | null;
  nilai_total: number;
  disubmit_at: string;
  namaSiswa: string;
  nis: string | null;
  // Detail jawaban per soal (soalId → jawaban siswa)
  daftarJawaban: { soalId: string; jawaban: string }[];
  // Nilai esai yang sudah tersimpan per soal (soalId → nilai). null = belum.
  nilaiEsaiPerSoal: Record<string, number> | null;
  // Jawaban kode (kosong kalau tidak ada soal kode).
  daftarKode: KodeJawaban[];
};

type SoalEsai = { id: string; urutan: number; potongan: string };

// Soal lengkap untuk menampilkan teks soal + kunci di samping jawaban siswa.
export type SoalReview = {
  id: string;
  jenis: string;
  soal: string;
  urutan: number;
  pilihan?: string[] | null;
  kunci?: string | null;
  poin?: number;
  keluaran_diharapkan?: string | null;
  kode_awal?: string | null;
  masukan?: string | null;
  masukan_uji?: string | null;
  keluaran_uji?: string | null;
  jawaban_asli?: string | null;
  aturan?: {
    variabel_wajib?: string[];
    dari_input?: boolean;
    min_input?: number;
    min_print?: number;
    izinkan_prompt?: boolean;
  } | null;
};

const LABEL_JENIS_SOAL: Record<string, string> = {
  pg: "Pilihan Ganda",
  esai: "Esai",
  kode: "Kode",
};

function formatAturan(aturan: NonNullable<SoalReview["aturan"]>): string {
  const bagian: string[] = [];
  if (aturan.variabel_wajib?.length) {
    bagian.push(`variabel ${aturan.variabel_wajib.join(", ")}`);
  }
  if (aturan.dari_input) bagian.push("memakai input()");
  if (aturan.min_input) bagian.push(`min. ${aturan.min_input} input()`);
  if (aturan.min_print) bagian.push(`min. ${aturan.min_print} print()`);
  return bagian.length > 0 ? bagian.join(" · ") : "—";
}

type SesiRow = {
  siswa_id: string;
  namaSiswa: string;
  nis: string | null;
  mulai_at: string;
};

export function DaftarJawaban({
  examId,
  daftarSubmit,
  daftarSesi = [],
  soalCount,
  probeCounts,
  daftarSoalEsai,
  daftarSoal,
}: {
  examId: string;
  daftarSubmit: SubmitRow[];
  // Siswa yang sudah mulai tetapi belum submit (timer masih berjalan).
  daftarSesi?: SesiRow[];
  soalCount: number;
  // Jumlah probe (kiri halaman / pindah tab / minimize) per siswa_id.
  // null = fitur belum aktif (DDL Tahap 11 belum dijalankan).
  probeCounts: Record<string, number> | null;
  // Daftar soal esai (urut) untuk input nilai per soal.
  daftarSoalEsai: SoalEsai[];
  // Soal lengkap untuk menampilkan teks + kunci di samping jawaban siswa.
  daftarSoal: SoalReview[];
}) {
  const [bukaId, setBukaId] = useState<string | null>(null);

  const petaSoal = new Map(daftarSoal.map((s) => [s.id, s]));

  // Siswa yang punya sesi timer tetapi belum submit. Tombol reset tetap
  // ditampilkan supaya guru bisa mengulang timer yang sudah habis.
  const sesiBelumSubmit = daftarSesi.filter(
    (s) => !daftarSubmit.some((r) => r.siswa_id === s.siswa_id),
  );

  const [stateEsai, formActionEsai, pendingEsai] = useActionState<
    { message: string | null },
    FormData
  >(simpanNilaiEsai, { message: null });

  const [stateKode, formActionKode, pendingKode] = useActionState<
    { message: string | null },
    FormData
  >(simpanNilaiKodeManual, { message: null });

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
          {sesiBelumSubmit.length > 0
            ? ` · ${sesiBelumSubmit.length} belum submit`
            : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Klik nama siswa untuk melihat teks soal, kunci, kode jawaban asli,
        jawaban, nilai sistem, dan tombol reset pengerjaan.
      </p>

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
                    {formatWaktuWib(row.disubmit_at)}
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
                  {row.daftarKode.length > 0 ? (
                    <span className="text-emerald-600">
                      Kode: {row.nilai_kode_manual ?? row.nilai_kode}
                      {row.nilai_kode_manual !== null ? " (manual)" : ""}
                    </span>
                  ) : null}
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
                      {[...row.daftarJawaban]
                        .sort((a, b) => {
                          const urutanA =
                            petaSoal.get(a.soalId)?.urutan ??
                            Number.MAX_SAFE_INTEGER;
                          const urutanB =
                            petaSoal.get(b.soalId)?.urutan ??
                            Number.MAX_SAFE_INTEGER;
                          return urutanA - urutanB;
                        })
                        .map((j, i) => {
                          const soal = petaSoal.get(j.soalId);
                          const kunci = soal?.kunci ?? null;
                          const pilihanBenar =
                            soal?.pilihan?.find((p) =>
                              kunci ? p.startsWith(`${kunci}.`) : false,
                            ) ?? null;
                          const pilihanSiswa =
                            soal?.pilihan?.find((p) =>
                              j.jawaban
                                ? p.startsWith(
                                    `${j.jawaban.trim().toUpperCase().charAt(0)}.`,
                                  )
                                : false,
                            ) ?? null;

                          return (
                            <div
                              key={j.soalId}
                              className="rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200"
                            >
                              <p className="font-medium text-slate-500">
                                {soal
                                  ? `Soal #${soal.urutan} · ${
                                      LABEL_JENIS_SOAL[soal.jenis] ??
                                      soal.jenis
                                    }`
                                  : `Soal #${i + 1}`}
                              </p>

                              {soal ? (
                                <p className="mt-1 whitespace-pre-wrap text-slate-900">
                                  {soal.soal}
                                </p>
                              ) : (
                                <p className="mt-1 text-slate-400">
                                  Teks soal tidak ditemukan.
                                </p>
                              )}

                              {soal?.jenis === "pg" ? (
                                <div className="mt-2 space-y-0.5">
                                  {(soal.pilihan ?? []).map((p, idx) => (
                                    <p
                                      key={`${j.soalId}-opsi-${idx}`}
                                      className={
                                        kunci && p.startsWith(`${kunci}.`)
                                          ? "font-medium text-emerald-700"
                                          : "text-slate-500"
                                      }
                                    >
                                      {p}
                                    </p>
                                  ))}
                                  <div className="mt-1 rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-800 ring-1 ring-emerald-100">
                                    <span className="font-semibold">
                                      Kunci:
                                    </span>{" "}
                                    {kunci ?? "—"}
                                    {pilihanBenar ? ` — ${pilihanBenar}` : ""}
                                  </div>
                                </div>
                              ) : null}

                              {soal?.jenis === "esai" ? (
                                <p className="mt-2 rounded-md bg-slate-100 px-2 py-1.5 text-slate-500">
                                  Kunci: tidak ada — esai dinilai manual.
                                </p>
                              ) : null}

                              <div className="mt-2 border-t border-slate-200 pt-2">
                                <p className="font-medium text-slate-500">
                                  Jawaban siswa
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-slate-900">
                                  {j.jawaban || (
                                    <span className="text-slate-400">
                                      (belum dijawab)
                                    </span>
                                  )}
                                </p>
                                {soal?.jenis === "pg" && pilihanSiswa ? (
                                  <p className="mt-1 text-slate-500">
                                    {pilihanSiswa}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Belum ada detail jawaban.
                    </p>
                  )}

                  {/* Jawaban kode + nilai otomatis + override guru */}
                  {row.daftarKode.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <h3 className="text-xs font-semibold text-slate-700">
                        Jawaban Kode
                      </h3>

                      {row.daftarKode.map((k, idx) => {
                        const soal = petaSoal.get(k.soalId);
                        return (
                        <div
                          key={k.soalId}
                          className="rounded-xl bg-emerald-50/40 p-3 ring-1 ring-emerald-100"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-emerald-800">
                              {soal
                                ? `Soal #${soal.urutan} · Kode`
                                : `Soal Kode #${idx + 1}`}
                            </p>
                            <p className="text-xs text-slate-500">
                              Nilai otomatis:{" "}
                              <span className="font-semibold text-emerald-700">
                                {k.nilai}
                              </span>{" "}
                              · {k.percobaan}× run
                            </p>
                          </div>

                          {soal ? (
                            <div className="mt-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                              <p className="text-[11px] font-semibold text-slate-500">
                                Soal
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-900">
                                {soal.soal}
                              </p>

                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <div>
                                  <p className="text-[11px] font-semibold text-emerald-700">
                                    Kunci — target output
                                  </p>
                                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-emerald-50 p-2 font-mono text-xs text-emerald-800 ring-1 ring-emerald-100">
                                    {soal.keluaran_diharapkan ||
                                      "(tidak diatur)"}
                                  </pre>
                                  {soal.masukan ? (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      Input:{" "}
                                      <span className="font-mono text-slate-700">
                                        {soal.masukan}
                                      </span>
                                    </p>
                                  ) : null}
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-500">
                                    Kunci — target output uji
                                  </p>
                                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200">
                                    {soal.keluaran_uji || "(tidak diatur)"}
                                  </pre>
                                  {soal.masukan_uji ? (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      Input uji:{" "}
                                      <span className="font-mono text-slate-700">
                                        {soal.masukan_uji}
                                      </span>
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              {soal.aturan ? (
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Ketentuan: {formatAturan(soal.aturan)}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="mt-3 grid gap-2 lg:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-semibold text-emerald-700">
                                Kunci — kode jawaban asli
                              </p>
                              <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 font-mono text-xs leading-5 text-emerald-900 ring-1 ring-emerald-100">
                                {soal?.jawaban_asli ||
                                  "(belum diisi guru)"}
                              </pre>
                              {soal?.jawaban_asli ? null : (
                                <Link
                                  href={`/guru/ulangan/${examId}/soal#kunci-jawaban-kode`}
                                  className="mt-1 inline-block text-[11px] font-medium text-emerald-700 underline"
                                >
                                  Isi di halaman Kelola Soal →
                                </Link>
                              )}
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-slate-500">
                                Jawaban siswa
                              </p>
                              <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100">
                                {k.kode || "(kode kosong)"}
                              </pre>
                            </div>
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                              <p className="text-[11px] font-semibold text-slate-500">
                                Output siswa
                              </p>
                              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs text-slate-800">
                                {k.keluaran || "(kosong)"}
                              </pre>
                            </div>
                            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                              <p className="text-[11px] font-semibold text-slate-500">
                                Output uji siswa
                              </p>
                              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs text-slate-800">
                                {k.keluaranUji ?? "(tidak diuji)"}
                              </pre>
                            </div>
                          </div>

                          {k.rincian ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(k.rincian.terpenuhi ?? []).map((teks) => (
                                <span
                                  key={teks}
                                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                                >
                                  ✓ {teks}
                                </span>
                              ))}
                              {(k.rincian.belum ?? []).map((teks) => (
                                <span
                                  key={teks}
                                  className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200"
                                >
                                  ✕ {teks}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        );
                      })}

                      <form
                        action={formActionKode}
                        className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200"
                      >
                        <input type="hidden" name="exam_id" value={examId} />
                        <input
                          type="hidden"
                          name="siswa_id"
                          value={row.siswa_id}
                        />
                        <p className="text-xs font-semibold text-emerald-800">
                          Nilai Kode Manual (hibrida)
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            name="nilai_kode_manual"
                            min={0}
                            max={1000}
                            defaultValue={row.nilai_kode_manual ?? ""}
                            placeholder={`Otomatis: ${row.nilai_kode}`}
                            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                          <button
                            type="submit"
                            disabled={pendingKode}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {pendingKode ? "Menyimpan..." : "Simpan Nilai Kode"}
                          </button>
                          <p className="text-xs text-slate-500">
                            Kosongkan untuk kembali ke nilai otomatis.
                          </p>
                        </div>
                        {stateKode.message ? (
                          <p className="mt-2 text-xs text-red-600">
                            {stateKode.message}
                          </p>
                        ) : null}
                      </form>
                    </div>
                  ) : null}

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

                  {/* Reset pengerjaan: hapus jawaban, nilai, dan sesi timer
                      supaya siswa bisa mengerjakan ulang dari awal. */}
                  <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                    <TombolReset
                      jenis="ulangan"
                      siswaId={row.siswa_id}
                      refId={examId}
                      label={`${row.namaSiswa} — ulangan ini`}
                      konfirmasi={`Reset pengerjaan ${row.namaSiswa}? Jawaban, nilai, dan timer akan dihapus sehingga siswa bisa mengerjakan ulang dari awal.`}
                      teks="Reset pengerjaan"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Siswa yang sudah mulai tetapi belum submit. Timer mereka masih
          berjalan (atau sudah habis); reset membuat mereka bisa mulai lagi. */}
      {sesiBelumSubmit.length > 0 ? (
        <div className="mt-5 rounded-xl bg-amber-50/60 p-4 ring-1 ring-amber-200">
          <h3 className="text-xs font-semibold text-amber-800">
            Sudah mulai, belum submit
          </h3>
          <p className="mt-1 text-xs text-amber-700">
            Timer sedang berjalan. Reset untuk mengulang dari awal.
          </p>
          <ul className="mt-3 space-y-2">
            {sesiBelumSubmit.map((s) => (
              <li
                key={s.siswa_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-amber-100"
              >
                <div>
                  <span className="text-sm font-medium text-slate-900">
                    {s.namaSiswa}
                    {s.nis ? (
                      <span className="ml-1 text-xs text-slate-400">
                        NIS {s.nis}
                      </span>
                    ) : null}
                  </span>
                  <p className="text-xs text-slate-500">
                    Mulai {formatWaktuWib(s.mulai_at)}
                  </p>
                </div>
                <TombolReset
                  jenis="ulangan"
                  siswaId={s.siswa_id}
                  refId={examId}
                  label={`${s.namaSiswa} — ulangan ini`}
                  konfirmasi={`Reset timer ${s.namaSiswa}? Siswa akan mulai dari awal.`}
                  teks="Reset timer"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
