"use client";

import { useActionState } from "react";
import { simpanJawabanAsliSoal } from "@/app/guru/ulangan/actions";

// Form untuk menyimpan kode jawaban asli/referensi pada soal kode.
// Hanya ditampilkan di halaman guru.
export function FormJawabanAsli({
  examId,
  soalId,
  defaultValue,
}: {
  examId: string;
  soalId: string;
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(simpanJawabanAsliSoal, { message: null });

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="soal_id" value={soalId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[11px] font-semibold text-emerald-700">
          Kunci — kode jawaban asli
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan Jawaban Asli"}
        </button>
      </div>

      <textarea
        name="jawaban_asli"
        rows={6}
        defaultValue={defaultValue}
        placeholder={'nama = input()\nprint(f"Halo, {nama}!")'}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />

      {state.message ? (
        <p className="mt-1 text-xs text-slate-600">{state.message}</p>
      ) : null}
    </form>
  );
}