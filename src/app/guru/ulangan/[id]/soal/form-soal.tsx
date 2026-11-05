"use client";

import { useState } from "react";
import { useActionState } from "react";
import { addQuestion } from "@/app/guru/ulangan/actions";

type Jenis = "pg" | "esai" | "kode";

const LABEL_JENIS: Record<Jenis, string> = {
  pg: "Pilihan Ganda",
  esai: "Esai",
  kode: "Kode",
};

export function FormSoal({
  examId,
  jumlahSoal,
}: {
  examId: string;
  jumlahSoal: number;
}) {
  const [jenis, setJenis] = useState<Jenis>("pg");
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(addQuestion, { message: null });

  const urutanBaru = jumlahSoal + 1;

  return (
    <form
      action={formAction}
      className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
    >
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="urutan" value={urutanBaru} />

      {/* Pilih jenis soal */}
      <div className="flex gap-2">
        {(["pg", "esai", "kode"] as const).map((nilaiJenis) => (
          <button
            key={nilaiJenis}
            type="button"
            onClick={() => setJenis(nilaiJenis)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              jenis === nilaiJenis
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {LABEL_JENIS[nilaiJenis]}
          </button>
        ))}
      </div>

      {/* Input teks soal */}
      <label className="mt-3 block text-xs font-medium text-slate-700">
        Soal
      </label>
      <textarea
        name="soal"
        required
        rows={2}
        placeholder={
          jenis === "pg"
            ? "Contoh: 1 + 1 = ..."
            : jenis === "esai"
              ? "Contoh: Jelaskan pengertian fotosintesis..."
              : "Contoh: Buat program yang meminta nama dengan input(), menyimpannya di variabel nama, lalu menampilkan Halo, <nama>!"
        }
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />

      {jenis === "pg" ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              name={`pilihan_${i}`}
              type="text"
              placeholder={`${String.fromCharCode(65 + i)}. ${
                i === 0 ? "(wajib)" : "(opsional)"
              }`}
              required={i < 2}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          ))}

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-700">Kunci</label>
            <select
              name="kunci"
              required
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Pilih</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
        </div>
      ) : null}

      {jenis === "kode" ? (
        <div className="mt-3 space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs font-semibold text-slate-600">
            Pengaturan penilaian otomatis
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Kode awal (template di editor)
            </label>
            <textarea
              name="kode_awal"
              rows={3}
              placeholder="# Tulis programmu di sini."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Target output utama
            </label>
            <textarea
              name="keluaran_diharapkan"
              rows={3}
              required
              placeholder={"Halo, Budi!"}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Input wajib (satu baris per input)
              </label>
              <textarea
                name="masukan"
                rows={3}
                placeholder={"Budi"}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Input uji (tidak ditampilkan)
              </label>
              <textarea
                name="masukan_uji"
                rows={3}
                placeholder={"Siti"}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Target output uji (opsional)
            </label>
            <textarea
              name="keluaran_uji"
              rows={2}
              placeholder={"Halo, Siti!"}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Variabel wajib (pisah koma)
              </label>
              <input
                name="variabel_wajib"
                type="text"
                placeholder="nama"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Min. input()
              </label>
              <input
                name="min_input"
                type="number"
                min={0}
                defaultValue={1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Min. print()
              </label>
              <input
                name="min_print"
                type="number"
                min={0}
                defaultValue={1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Skor parsial: output utama 50, output uji 20, variabel 20, jumlah
            input/print 10. Ketentuan kosong tidak dihitung.
          </p>
        </div>
      ) : null}

      {/* Poin */}
      <div className="mt-3 flex items-center gap-3">
        <label className="text-xs font-medium text-slate-700">
          Poin (0–100)
        </label>
        <input
          name="poin"
          type="number"
          min={0}
          max={100}
          defaultValue={jenis === "esai" ? 0 : 100}
          className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* Hidden jenis (diatur dari state client) */}
      <input type="hidden" name="jenis" value={jenis} />

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : "+ Tambah Soal"}
      </button>

      {state.message ? (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}
