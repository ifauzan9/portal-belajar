"use client";

import Link from "next/link";
import { useActionState } from "react";
import { previewImport, simpanImport } from "@/app/guru/siswa/import/actions";
import type { BarisImport } from "@/lib/parse-siswa-xlsx";

type PreviewState = { rows: BarisImport[]; error: string | null };
type SimpanState = { jumlah: number; dilewati: number; error: string | null };

export function ImportSiswa() {
  const [preview, previewAction, previewPending] = useActionState<
    PreviewState,
    FormData
  >(previewImport, { rows: [], error: null });

  const [simpan, simpanAction, simpanPending] = useActionState<
    SimpanState,
    FormData
  >(simpanImport, { jumlah: 0, dilewati: 0, error: null });

  const valid = preview.rows.filter((row) => row.status === "ok");
  const dilewati = preview.rows.length - valid.length;
  const berhasil = simpan.jumlah > 0;

  return (
    <div className="space-y-6">
      <form
        action={previewAction}
        className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5"
      >
        <label
          htmlFor="file"
          className="block text-sm font-medium text-slate-700"
        >
          File Excel (.xlsx)
        </label>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="file"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white sm:flex-1"
          />
          <a
            href="/template-siswa.xlsx"
            download
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Unduh Template (.xlsx)
          </a>
          <button
            type="submit"
            disabled={previewPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewPending ? "Membaca file..." : "Lihat Pratinjau"}
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Belum punya file? Klik <b>Unduh Template</b>, hapus baris contoh, lalu
          isi datanya. Baris 1 = judul kolom <b>NIS</b>, <b>Nama</b>, dan{" "}
          <b>Kelas</b>, data mulai baris 2. Nama kelas harus sama dengan data
          kelas yang ada. Maksimal 1000 baris / 2 MB.
        </p>

        {preview.error ? (
          <p className="mt-2 text-sm text-red-600">{preview.error}</p>
        ) : null}
      </form>

      {berhasil ? (
        <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
          ✅ {simpan.jumlah} siswa berhasil diimport.
          {simpan.dilewati > 0
            ? ` ${simpan.dilewati} baris dilewati (NIS kosong/ganda).`
            : ""}{" "}
          <Link href="/guru/siswa" className="font-medium underline">
            Lihat Data Siswa
          </Link>
        </p>
      ) : null}

      {!berhasil && preview.rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600 sm:px-5">
            Ditemukan <b>{preview.rows.length}</b> baris: <b>{valid.length}</b>{" "}
            siap diimport
            {dilewati > 0 ? `, ${dilewati} dilewati` : ""}.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-5">Baris</th>
                  <th className="px-4 py-2 font-medium">NIS</th>
                  <th className="px-4 py-2 font-medium">Nama</th>
                  <th className="px-4 py-2 font-medium">Kelas</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row) => (
                  <tr
                    key={row.nomor}
                    className={row.status === "ok" ? "" : "bg-red-50"}
                  >
                    <td className="px-4 py-2 text-slate-400 tabular-nums sm:px-5">
                      {row.nomor}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.nis || "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-900">
                      {row.nama || "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.kelas || "Belum ada kelas"}
                    </td>
                    <td
                      className={`px-4 py-2 ${
                        row.status === "ok" ? "text-slate-500" : "text-red-600"
                      }`}
                    >
                      {row.alasan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {valid.length > 0 ? (
            <form
              action={simpanAction}
              className="border-t border-slate-100 px-4 py-3 sm:px-5"
            >
              <input
                type="hidden"
                name="rows"
                value={JSON.stringify(
                  valid.map((row) => ({
                    nis: row.nis,
                    nama: row.nama,
                    kelasId: row.kelasId,
                  })),
                )}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={simpanPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {simpanPending
                    ? "Menyimpan..."
                    : `Import ${valid.length} Siswa`}
                </button>
                {simpan.error ? (
                  <p className="text-sm text-red-600">{simpan.error}</p>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-600 sm:px-5">
              Tidak ada baris valid. Periksa NIS (harus terisi & belum
              terdaftar) dan kolom Kelas pada file Anda.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
