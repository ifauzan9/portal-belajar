"use client";

import { useActionState } from "react";
import { PilihKelasMulti } from "@/components/pilih-kelas-multi";
import {
  simpanKelasKomputer,
  type HasilKelasKomputer,
} from "@/app/guru/komputer/actions";

type Kelas = { id: string; nama_kelas: string };

export function FormKelasKomputer({
  lessonId,
  kelasList,
  awalTerpilih,
}: {
  lessonId: string;
  kelasList: Kelas[];
  awalTerpilih: string[];
}) {
  const [state, formAction, pending] = useActionState<
    HasilKelasKomputer,
    FormData
  >(simpanKelasKomputer, { message: null, sukses: false });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="lesson_id" value={lessonId} />
      <div>
        <span className="block text-xs font-medium text-slate-500">
          Target kelas
        </span>
        <div className="mt-1">
          <PilihKelasMulti
            daftarKelas={kelasList}
            awalTerpilih={awalTerpilih}
            compact
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : "Simpan kelas"}
      </button>

      {state.message ? (
        <span className="text-xs text-red-600">{state.message}</span>
      ) : null}
      {state.sukses ? (
        <span className="text-xs text-emerald-600">Tersimpan.</span>
      ) : null}
    </form>
  );
}
