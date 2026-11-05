"use client";

import { useState } from "react";
import { useActionState } from "react";
import { mulaiUjianSiswa, type HasilMulaiUjian } from "@/app/siswa/actions";

// Tombol mulai di halaman konfirmasi. Timer baru dibuat di server setelah
// siswa mencentang pernyataan dan menekan tombol ini.
export function TombolMulaiUjian({ examId }: { examId: string }) {
  const [setuju, setSetuju] = useState(false);
  const [state, formAction, pending] = useActionState<
    HasilMulaiUjian,
    FormData
  >(mulaiUjianSiswa, { message: null });

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="exam_id" value={examId} />

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
        <input
          type="checkbox"
          checked={setuju}
          onChange={(event) => setSetuju(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          Saya sudah membaca informasi di atas dan siap mengerjakan. Timer akan
          langsung berjalan setelah saya menekan <strong>Mulai Sekarang</strong>.
        </span>
      </label>

      <button
        type="submit"
        disabled={!setuju || pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Memulai..." : "Mulai Sekarang"}
      </button>

      {state.message ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}