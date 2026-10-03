"use client";

import { useActionState, useState } from "react";
import { HapusSiswaButton } from "@/components/hapus-siswa-button";
import { AturKredensialSiswa, ToggleAkunSiswa } from "@/components/atur-kredensial-siswa";
import { KotakPilihSiswa } from "@/components/pilihan-siswa";
import { updateSiswa } from "@/app/guru/siswa/actions";

type Kelas = { id: string; nama_kelas: string };

export function BarisSiswa({
  nomor,
  id,
  nis,
  nama,
  kelasId,
  namaKelas,
  kelasList,
  // Kredensial login siswa (username yang sudah di-set guru)
  usernameAkun,
  // Status akun (aktif/nonaktif). Hanya relevan kalau usernameAkun ada.
  akunAktif,
  // "baris" = tabel (desktop), "kartu" = daftar untuk mobile.
  tampilan = "baris",
}: {
  nomor: number;
  id: string;
  nis: string | null;
  nama: string;
  kelasId: string | null;
  namaKelas: string;
  kelasList: Kelas[];
  usernameAkun: string | null;
  akunAktif: boolean;
  tampilan?: "baris" | "kartu";
}) {
  const [editing, setEditing] = useState(false);

  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(async (_prevState, formData) => {
    const result = await updateSiswa({ message: null }, formData);
    if (result.message === null) {
      setEditing(false);
    }
    return result;
  }, { message: null });

  const badgeAkun = akunAktif ? (
    <span className="inline-flex w-fit items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-200">
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500"></span>
      Aktif
    </span>
  ) : (
    <span className="inline-flex w-fit items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-200">
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-500"></span>
      Nonaktif
    </span>
  );

  const infoAkun = usernameAkun ? (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-sm text-slate-700">{usernameAkun}</span>
      {badgeAkun}
    </div>
  ) : (
    <span className="text-sm text-amber-600">Belum ada akun</span>
  );

  const aksi = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Ubah
        </button>
        <HapusSiswaButton id={id} nama={nama} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        <AturKredensialSiswa
          siswaId={id}
          usernameAwal={usernameAkun}
          namaSiswa={nama}
        />
        {usernameAkun ? (
          <ToggleAkunSiswa
            siswaId={id}
            akunAktif={akunAktif}
            namaSiswa={nama}
          />
        ) : null}
      </div>
    </div>
  );

  const formUbah = (
    <form action={formAction}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="id" value={id} />
        <input
          id={`nis-${id}`}
          name="nis"
          type="text"
          defaultValue={nis ?? ""}
          required
          placeholder="NIS"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-32"
        />
        <input
          id={`nama-${id}`}
          name="nama_siswa"
          type="text"
          defaultValue={nama}
          required
          placeholder="Nama siswa"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:max-w-56"
        />
        <select
          id={`kelas-${id}`}
          name="kelas_id"
          defaultValue={kelasId ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-40"
        >
          <option value="">Belum ada kelas</option>
          {kelasList.map((kelas) => (
            <option key={kelas.id} value={kelas.id}>
              {kelas.nama_kelas}
            </option>
          ))}
        </select>

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
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Batal
          </button>
        </div>
      </div>

      {state.message ? (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );

  // ---------------- Tampilan kartu (mobile) ----------------
  if (tampilan === "kartu") {
    return (
      <li className={`rounded-xl border border-slate-200 p-4 ${editing ? "bg-slate-50" : "bg-white"}`}>
        <div className="flex items-start gap-3">
          <KotakPilihSiswa id={id} label={`Pilih ${nama}`} />
          <div className="min-w-0 flex-1">
            {editing ? (
              formUbah
            ) : (
              <>
                <p className="font-medium text-slate-900">{nama}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {nis ? `NIS: ${nis}` : "Tanpa NIS"} · {namaKelas}
                </p>
                <div className="mt-2">{infoAkun}</div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {aksi}
                </div>
              </>
            )}
          </div>
        </div>
      </li>
    );
  }

  // ---------------- Tampilan baris (tabel desktop) ----------------
  if (!editing) {
    return (
      <tr className="align-top transition hover:bg-slate-50">
        <td className="px-4 py-3 sm:px-5">
          <KotakPilihSiswa id={id} label={`Pilih ${nama}`} />
        </td>
        <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
          {nomor}
        </td>
        <td className="px-4 py-3 text-slate-600">
          {nis || <span className="text-slate-400">Tanpa NIS</span>}
        </td>
        <td className="px-4 py-3 font-medium text-slate-900">{nama}</td>
        <td className="px-4 py-3 text-slate-500">{namaKelas}</td>
        <td className="px-4 py-3">{infoAkun}</td>
        <td className="px-4 py-3">{aksi}</td>
      </tr>
    );
  }

  return (
    <tr className="bg-slate-50">
      <td className="px-4 py-3 sm:px-5">
        <KotakPilihSiswa id={id} label={`Pilih ${nama}`} />
      </td>
      <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">{nomor}</td>
      <td colSpan={4} className="px-4 py-3">
        {formUbah}
      </td>
      <td></td>
    </tr>
  );
}
