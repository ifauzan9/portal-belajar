"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteTugas, toggleTugas } from "@/app/guru/tugas/actions";
import { FormTugas, type NilaiAwalTugas } from "@/components/form-tugas";
import { Badge } from "@/components/ui/badge";
import type { MetodePengumpulan } from "@/lib/tugas";

type Kelas = { id: string; nama_kelas: string };

export function BarisTugas({
  nomor,
  id,
  judul,
  deskripsi,
  daftarKelasNama,
  daftarKelasId,
  metode,
  fileDiizinkan,
  metodeLabel,
  tenggat,
  tenggatIso,
  terkumpul,
  totalSiswa,
  rataRata,
  kelasList,
  dibuka,
}: {
  nomor: number;
  id: string;
  judul: string;
  deskripsi: string;
  daftarKelasNama: string[];
  daftarKelasId: string[];
  metode: MetodePengumpulan;
  fileDiizinkan: string[];
  metodeLabel: string;
  tenggat: string;
  tenggatIso: string | null;
  terkumpul: number;
  totalSiswa: number;
  rataRata: string;
  kelasList: Kelas[];
  // Tugas dibuka/ditutup guru (false = siswa tidak bisa mengumpulkan)
  dibuka: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const teksKelas =
    daftarKelasNama.length === 0
      ? "Semua kelas"
      : daftarKelasNama.length <= 3
        ? daftarKelasNama.join(", ")
        : `${daftarKelasNama.slice(0, 3).join(", ")}, +${
            daftarKelasNama.length - 3
          }`;

  const lengkap = totalSiswa > 0 && terkumpul >= totalSiswa;

  if (editing) {
    const awal: NilaiAwalTugas = {
      id,
      judul,
      deskripsi,
      metode,
      fileDiizinkan,
      tenggat: tenggatIso,
      kelasId: daftarKelasId,
    };
    return (
      <tr className="bg-slate-50">
        <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
          {nomor}
        </td>
        <td colSpan={7} className="px-4 py-3 sm:px-5">
          <FormTugas
            kelasList={kelasList}
            awal={awal}
            onSelesai={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">{nomor}</td>
      <td className="px-4 py-3 sm:px-5">
        <Link
          href={`/guru/tugas/${id}`}
          className="font-medium text-slate-900 transition hover:text-emerald-700"
        >
          {judul}
        </Link>
        {!dibuka ? (
          <Badge varian="bahaya" className="ml-2">
            Ditutup
          </Badge>
        ) : null}
        {deskripsi ? (
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
            {deskripsi}
          </p>
        ) : null}
      </td>
      <td
        className="px-4 py-3 text-slate-600 sm:px-5"
        title={daftarKelasNama.join(", ")}
      >
        {teksKelas}
      </td>
      <td className="px-4 py-3 sm:px-5">
        <Badge varian="netral">{metodeLabel}</Badge>
      </td>
      <td className="px-4 py-3 text-slate-500 sm:px-5">{tenggat}</td>
      <td className="px-4 py-3 sm:px-5">
        <Badge varian={lengkap ? "sukses" : terkumpul > 0 ? "info" : "netral"}>
          {terkumpul}/{totalSiswa}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-700 sm:px-5">
        {rataRata}
      </td>
      <td className="px-4 py-3 sm:px-5">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/guru/tugas/${id}`}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Detail
          </Link>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Ubah
          </button>
          <form action={toggleTugas}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              onClick={(event) => {
                const pesan = dibuka
                  ? `Tutup tugas "${judul}"? Siswa tidak bisa lagi mengumpulkan.`
                  : `Buka kembali tugas "${judul}" untuk siswa?`;
                if (!confirm(pesan)) {
                  event.preventDefault();
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                dibuka
                  ? "text-amber-700 hover:bg-amber-50"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {dibuka ? "Tutup" : "Buka"}
            </button>
          </form>
          <form action={deleteTugas}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              onClick={(event) => {
                if (
                  !confirm(
                    `Yakin menghapus tugas "${judul}" beserta pengumpulannya?`,
                  )
                ) {
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
