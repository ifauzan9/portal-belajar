"use client";

import { useActionState } from "react";
import { verifikasiKodeUlangan, type HasilVerifikasiKode } from "@/app/siswa/actions";

// Form input kode akses untuk membuka detail nilai ulangan.
// exam_id disembunyikan di input tersembunyi; kode dikirim ke server action
// verifikasiKodeUlangan. Kalau cocok, action redirect ke ?kode=1.
export function FormKode({ examId }: { examId: string }) {
  const [state, formAction, pending] = useActionState<
    HasilVerifikasiKode,
    FormData
  >(verifikasiKodeUlangan, { message: null });

  return (
    <form action={formAction} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Kode akses</h2>
      <p className="mt-1 text-xs text-slate-500">
        Ulangan ini dilindungi kode dari guru. Masukkan kode untuk membuka
        detail nilainya.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="exam_id" value={examId} />
        <input
          name="kode"
          type="text"
          required
          placeholder="Contoh: A1B2"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 sm:max-w-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Memeriksa..." : "Buka Nilai"}
        </button>
      </div>
      {state.message ? (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}
