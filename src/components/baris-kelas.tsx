"use client";

import { useActionState, useState } from "react";
import { HapusKelasButton } from "@/components/hapus-kelas-button";
import { updateKelas } from "@/app/guru/kelas/actions";

export function BarisKelas({
  nomor,
  id,
  nama,
  tanggal,
}: {
  nomor: number;
  id: string;
  nama: string;
  tanggal: string;
}) {
  const [editing, setEditing] = useState(false);

  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(async (_prevState, formData) => {
    const result = await updateKelas({ message: null }, formData);
    // Aksi sukses selalu mengembalikan pesan null, jadi tutup formnya.
    if (result.message === null) {
      setEditing(false);
    }
    return result;
  }, { message: null });

  if (!editing) {
    return (
      <tr className="transition hover:bg-slate-50">
        <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
          {nomor}
        </td>
        <td className="px-4 py-3 font-medium text-slate-900">{nama}</td>
        <td className="px-4 py-3 text-slate-500">{tanggal}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Ubah
            </button>
            <HapusKelasButton id={id} nama={nama} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-slate-50">
      <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">{nomor}</td>
      <td colSpan={2} className="px-4 py-3">
        <form action={formAction}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="id" value={id} />
            <input
              id={`nama-${id}`}
              name="nama_kelas"
              type="text"
              defaultValue={nama}
              required
              autoFocus
              placeholder="Nama kelas"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:max-w-56"
            />

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Batal
              </button>
            </div>
          </div>

          {state.message ? (
            <p className="mt-2 text-sm text-red-600">{state.message}</p>
          ) : null}
        </form>
      </td>
      <td className="px-4 py-3" />
    </tr>
  );
}
