"use client";

import { useActionState } from "react";
import { addPengumuman } from "@/app/guru/pengumuman/actions";
import { PilihKelasMulti } from "@/components/pilih-kelas-multi";

type Kelas = { id: string; nama_kelas: string };

export function TambahPengumumanForm({ kelasList }: { kelasList: Kelas[] }) {
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(addPengumuman, { message: null });

  return (
    <form
      action={formAction}
      className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5"
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="judul"
              className="block text-sm font-medium text-slate-700"
            >
              Judul pengumuman
            </label>
            <input
              id="judul"
              name="judul"
              type="text"
              required
              placeholder="Contoh: Jadwal ulangan harian"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700">
              Berlaku untuk
            </span>
            <div className="mt-1">
              <PilihKelasMulti daftarKelas={kelasList} />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="isi"
            className="block text-sm font-medium text-slate-700"
          >
            Isi pengumuman
          </label>
          <textarea
            id="isi"
            name="isi"
            required
            rows={3}
            placeholder="Tulis isi pengumuman di sini..."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="sm:max-w-xs">
          <label
            htmlFor="mulai_pada"
            className="block text-sm font-medium text-slate-700"
          >
            Mulai tampil (opsional)
          </label>
          <input
            id="mulai_pada"
            name="mulai_pada"
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <p className="mt-1 text-xs text-slate-500">
            Kosongkan agar langsung tampil untuk siswa.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Menyimpan..." : "+ Tambah Pengumuman"}
          </button>
        </div>
      </div>

      {state.message ? (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}
