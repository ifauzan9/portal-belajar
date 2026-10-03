"use client";

import { useActionState, useState } from "react";
import {
  deletePengumuman,
  updatePengumuman,
} from "@/app/guru/pengumuman/actions";
import { PilihKelasMulti } from "@/components/pilih-kelas-multi";
import { Badge } from "@/components/ui/badge";
import {
  formatJadwal,
  isoKeInputLokal,
  sudahTampil,
} from "@/lib/jadwal-pengumuman";

type Kelas = { id: string; nama_kelas: string };

export function BarisPengumuman({
  nomor,
  id,
  judul,
  isi,
  daftarKelasNama,
  tanggal,
  mulaiPada,
  kelasList,
}: {
  nomor: number;
  id: string;
  judul: string;
  isi: string;
  daftarKelasNama: string[];
  tanggal: string;
  mulaiPada: string | null;
  kelasList: Kelas[];
}) {
  const [editing, setEditing] = useState(false);
  const terjadwal = !sudahTampil(mulaiPada);

  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(async (prev, formData) => {
    const result = await updatePengumuman({ message: null }, formData);
    // Aksi sukses selalu mengembalikan pesan null, jadi tutup formnya.
    if (result.message === null) {
      setEditing(false);
    }
    return result;
  }, { message: null });

  // Nama kelas yang tampil → id-nya (untuk defaultValue form ubah).
  // Kalau kelasnya sudah dihapus, id-nya tidak ada di kelasList;
  // pilihannya tetap tersedia lewat nama, tidak hilang.
  const daftarKelasIdAwal = daftarKelasNama.flatMap((nama) => {
    const ketemu = kelasList.find((k) => k.nama_kelas === nama);
    return ketemu ? [ketemu.id] : [];
  });

  const teksKelas =
    daftarKelasNama.length === 0
      ? "Semua kelas"
      : daftarKelasNama.length <= 3
        ? daftarKelasNama.join(", ")
        : `${daftarKelasNama.slice(0, 3).join(", ")}, +${
            daftarKelasNama.length - 3
          }`;

  if (!editing) {
    return (
      <tr className="transition hover:bg-slate-50">
        <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
          {nomor}
        </td>
        <td className="px-4 py-3 sm:px-5">
          <p className="font-medium text-slate-900">{judul}</p>
          <p className="mt-0.5 text-sm text-slate-500">{isi}</p>
        </td>
        <td
          className="px-4 py-3 text-slate-600 sm:px-5"
          title={daftarKelasNama.join(", ")}
        >
          {teksKelas}
        </td>
        <td className="px-4 py-3 text-slate-500 sm:px-5">
          <span className="block">{tanggal}</span>
          {mulaiPada ? (
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              {terjadwal ? (
                <Badge varian="peringatan">Terjadwal</Badge>
              ) : null}
              <span className="text-slate-400">
                Tampil: {formatJadwal(mulaiPada)}
              </span>
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Ubah
            </button>
            <form action={deletePengumuman}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                onClick={(event) => {
                  if (!confirm(`Yakin menghapus pengumuman "${judul}"?`)) {
                    event.preventDefault();
                  }
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Hapus
              </button>
            </form>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-slate-50">
      <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
        {nomor}
      </td>
      <td colSpan={4} className="px-4 py-3 sm:px-5">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              name="judul"
              type="text"
              defaultValue={judul}
              required
              autoFocus
              placeholder="Judul pengumuman"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <PilihKelasMulti
              daftarKelas={kelasList}
              awalTerpilih={daftarKelasIdAwal}
              compact
            />
          </div>

          <textarea
            name="isi"
            rows={2}
            defaultValue={isi}
            required
            placeholder="Isi pengumuman"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <div className="sm:max-w-xs">
            <label
              htmlFor={`mulai-pada-${id}`}
              className="block text-sm font-medium text-slate-700"
            >
              Mulai tampil (opsional)
            </label>
            <input
              id={`mulai-pada-${id}`}
              name="mulai_pada"
              type="datetime-local"
              defaultValue={isoKeInputLokal(mulaiPada)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Kosongkan agar langsung tampil.
            </p>
          </div>

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

          {state.message ? (
            <p className="text-sm text-red-600">{state.message}</p>
          ) : null}
        </form>
      </td>
    </tr>
  );
}


