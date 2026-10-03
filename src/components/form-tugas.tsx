"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { addTugas, updateTugas, type HasilTugas } from "@/app/guru/tugas/actions";
import { PilihKelasMulti } from "@/components/pilih-kelas-multi";
import { PilihFileDiizinkan } from "@/components/pilih-file-diizinkan";
import { isoKeInputLokal } from "@/lib/jadwal-pengumuman";
import {
  LABEL_METODE,
  METODE_VALID,
  type MetodePengumpulan,
} from "@/lib/tugas";

type Kelas = { id: string; nama_kelas: string };

export type NilaiAwalTugas = {
  id: string;
  judul: string;
  deskripsi: string;
  metode: MetodePengumpulan;
  fileDiizinkan: string[];
  tenggat: string | null;
  kelasId: string[];
};

const inputBase =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const labelBase = "block text-sm font-medium text-slate-700";
const hintBase = "mt-1 text-xs text-slate-400";

// Form tambah/ubah tugas. Mode ditentukan dari ada/tidaknya `awal.id`.
export function FormTugas({
  kelasList,
  awal,
  onSelesai,
}: {
  kelasList: Kelas[];
  awal?: NilaiAwalTugas;
  onSelesai?: () => void;
}) {
  const aksi = awal?.id ? updateTugas : addTugas;
  const [state, formAction, pending] = useActionState<HasilTugas, FormData>(
    aksi,
    { message: null, berhasil: false },
  );

  const [metode, setMetode] = useState<MetodePengumpulan>(
    awal?.metode ?? "link",
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.berhasil) return;
    if (!awal?.id) formRef.current?.reset();
    onSelesai?.();
  }, [state, awal?.id, onSelesai]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      {awal?.id ? <input type="hidden" name="id" value={awal.id} /> : null}

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label htmlFor="judul-tugas" className={labelBase}>
            Judul tugas
          </label>
          <input
            id="judul-tugas"
            name="judul"
            type="text"
            required
            defaultValue={awal?.judul ?? ""}
            placeholder="Contoh: Tugas Merangkum Bab 3"
            className={inputBase}
          />
        </div>

        <div className="md:col-span-1 xl:col-span-2">
          <label className={labelBase}>
            Kelas
            <span className="ml-1 text-xs font-normal text-slate-400">
              (bisa beberapa, kosong = semua kelas)
            </span>
          </label>
          <div className="mt-1">
            <PilihKelasMulti
              daftarKelas={kelasList}
              awalTerpilih={awal?.kelasId ?? []}
              compact
            />
          </div>
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <label htmlFor="deskripsi-tugas" className={labelBase}>
            Instruksi / deskripsi
          </label>
          <textarea
            id="deskripsi-tugas"
            name="deskripsi"
            rows={3}
            defaultValue={awal?.deskripsi ?? ""}
            placeholder="Jelaskan apa yang harus dikerjakan siswa..."
            className={inputBase}
          />
        </div>

        <div className="md:col-span-1">
          <span className={labelBase}>Metode pengumpulan</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {METODE_VALID.map((nilai) => (
              <button
                key={nilai}
                type="button"
                onClick={() => setMetode(nilai)}
                aria-pressed={metode === nilai}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  metode === nilai
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {LABEL_METODE[nilai]}
              </button>
            ))}
          </div>
          <input type="hidden" name="metode" value={metode} />
        </div>

        <div className="md:col-span-1">
          <label htmlFor="tenggat-tugas" className={labelBase}>
            Tenggat waktu
          </label>
          <input
            id="tenggat-tugas"
            name="tenggat"
            type="datetime-local"
            defaultValue={isoKeInputLokal(awal?.tenggat ?? null)}
            className={inputBase}
          />
          <p className={hintBase}>Kosongkan = tanpa batas waktu.</p>
        </div>

        {metode !== "link" ? (
          <div className="md:col-span-2 xl:col-span-3">
            <span className={labelBase}>Jenis file yang diizinkan</span>
            <div className="mt-1">
              <PilihFileDiizinkan awal={awal?.fileDiizinkan ?? []} />
            </div>
          </div>
        ) : null}

        <div className="md:col-span-2 xl:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Menyimpan..."
              : awal?.id
                ? "Simpan Perubahan"
                : "+ Tambah Tugas"}
          </button>
        </div>
      </div>

      {state.message ? (
        <p className="mt-3 text-sm text-red-600">{state.message}</p>
      ) : null}
      {state.berhasil ? (
        <p className="mt-3 text-sm text-emerald-600">Tugas tersimpan.</p>
      ) : null}
    </form>
  );
}
