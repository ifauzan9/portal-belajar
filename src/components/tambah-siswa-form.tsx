"use client";

import { useActionState } from "react";
import { addSiswa } from "@/app/guru/siswa/actions";

type Kelas = { id: string; nama_kelas: string };

export function TambahSiswaForm({ kelasList }: { kelasList: Kelas[] }) {
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(addSiswa, { message: null });

  return (
    <form
      action={formAction}
      className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="lg:w-36">
          <label
            htmlFor="nis"
            className="block text-sm font-medium text-slate-700"
          >
            NIS
          </label>
          <input
            id="nis"
            name="nis"
            type="text"
            required
            placeholder="12345"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="nama_siswa"
            className="block text-sm font-medium text-slate-700"
          >
            Nama siswa
          </label>
          <input
            id="nama_siswa"
            name="nama_siswa"
            type="text"
            required
            placeholder="Contoh: Budi Santoso"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="kelas_id"
            className="block text-sm font-medium text-slate-700"
          >
            Kelas
          </label>
          <select
            id="kelas_id"
            name="kelas_id"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 lg:w-40"
          >
            <option value="">Belum ada kelas</option>
            {kelasList.map((kelas) => (
              <option key={kelas.id} value={kelas.id}>
                {kelas.nama_kelas}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "+ Tambah Siswa"}
        </button>
      </div>

      {state.message ? (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}
