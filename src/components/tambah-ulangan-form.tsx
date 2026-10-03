"use client";

import { useState } from "react";
import { useActionState } from "react";
import { addUlangan } from "@/app/guru/ulangan/actions";
import { PilihKelasMulti } from "@/components/pilih-kelas-multi";

type Kelas = { id: string; nama_kelas: string };

export function TambahUlanganForm({ kelasList }: { kelasList: Kelas[] }) {
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(addUlangan, { message: null });

  const [status, setStatus] = useState<"akan" | "sudah">("sudah");

  const inputBase =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const labelBase = "block text-sm font-medium text-slate-700";
  const hintBase = "mt-1 text-xs text-slate-400";

  return (
    <form
      action={formAction}
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        {/* Baris 1: Judul + Kelas + Tanggal */}
        <div className="md:col-span-1 xl:col-span-1">
          <label htmlFor="judul-ulangan" className={labelBase}>
            Judul ulangan
          </label>
          <input
            id="judul-ulangan"
            name="judul"
            type="text"
            required
            placeholder="Contoh: Ulangan Harian Matematika 1"
            className={inputBase}
          />
        </div>

        <div className="md:col-span-1 xl:col-span-1">
          <label className={labelBase}>
            Kelas
            <span className="ml-1 text-xs font-normal text-slate-400">
              (bisa beberapa, kosong = semua kelas)
            </span>
          </label>
          <div className="mt-1">
            <PilihKelasMulti daftarKelas={kelasList} compact />
          </div>
        </div>

        <div className="md:col-span-1 xl:col-span-1">
          <label htmlFor="tanggal-ulangan" className={labelBase}>
            Tanggal
          </label>
          <input
            id="tanggal-ulangan"
            name="tanggal"
            type="date"
            className={inputBase}
          />
        </div>

        {/* Baris 2: Status + Tenggat + Durasi + Tampilkan nilai + Kode akses */}
        <div className="md:col-span-1 xl:col-span-1">
          <span className={labelBase}>Status</span>
          <div className="mt-1 flex gap-2">
            {(["sudah", "akan"] as const).map((nilaiStatus) => (
              <button
                key={nilaiStatus}
                type="button"
                onClick={() => setStatus(nilaiStatus)}
                aria-pressed={status === nilaiStatus}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  status === nilaiStatus
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {nilaiStatus === "sudah" ? "Sudah dilaksanakan" : "Akan dilaksanakan"}
              </button>
            ))}
          </div>
          <input type="hidden" name="status" value={status} />
        </div>

        <div className="md:col-span-1 xl:col-span-1">
          <label htmlFor="tenggat-ulangan" className={labelBase}>
            Tenggat waktu
          </label>
          <input
            id="tenggat-ulangan"
            name="tenggat"
            type="datetime-local"
            required={status === "akan"}
            disabled={status !== "akan"}
            placeholder={status === "akan" ? undefined : "Wajib saat status 'Akan dilaksanakan'"}
            className={`${inputBase} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
          />
          <p className={hintBase}>Batas akhir siswa submit</p>
        </div>

        <div className="md:col-span-1 xl:col-span-1">
          <label htmlFor="durasi-ulangan" className={labelBase}>
            Durasi pengerjaan
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="durasi-ulangan"
              name="durasi"
              type="number"
              min={1}
              max={9999}
              placeholder="Opsional"
              disabled={status !== "akan"}
              className={`${inputBase} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
            />
            <span className="shrink-0 text-sm text-slate-500">menit</span>
          </div>
          <p className={hintBase}>
            {status === "akan"
              ? "Kosongkan = pakai tenggat waktu saja"
              : "Pilih status 'Akan dilaksanakan' dulu"}
          </p>
        </div>

        <div className="md:col-span-2 xl:col-span-1">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="tampilkan_nilai"
              defaultChecked
              disabled={status !== "akan"}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            />
            Tampilkan nilai langsung setelah submit
          </label>
          <p className={hintBase}>
            {status === "akan"
              ? "Centang = nilai PG & esai kelihatan setelah siswa kumpulkan. Hapus centang = nilai ditahan sampai guru tekan tombol &ldquo;Selesai dinilai&rdquo;."
              : "Hanya berlaku untuk ulangan bersoal."}
          </p>
        </div>

        <div className="md:col-span-1 xl:col-span-1">
          <label htmlFor="kode-ulangan" className={labelBase}>
            Kode akses
          </label>
          <input
            id="kode-ulangan"
            name="access_code"
            type="text"
            placeholder="Opsional"
            className={inputBase}
          />
          <p className={hintBase}>Untuk siswa membuka nilai</p>
        </div>

        {/* Baris 3: tombol submit, rata kiri */}
        <div className="md:col-span-2 xl:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Menyimpan..." : "+ Tambah Ulangan"}
          </button>
        </div>
      </div>

      {state.message ? (
        <p className="mt-3 text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}
