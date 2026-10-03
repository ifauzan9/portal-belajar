"use client";

import { useState, useActionState } from "react";
import {
  importNilaiExcel,
  type HasilImportNilaiExcel,
  type BarisPratinjauNilai,
} from "@/app/guru/ulangan/actions";

type Props = {
  examId: string;
  // Dipanggil setelah pratinjau disimpan: nilai OK masuk ke form induk
  onSimpanPratinjau: (nilai: Map<string, number>) => void;
};

type StatusForm = "siap" | "pratinjau" | "tersimpan";

export function ImportNilaiPanel({
  examId,
  onSimpanPratinjau,
}: Props) {
  const [state, formAction, pending] = useActionState<
    HasilImportNilaiExcel,
    FormData
  >(importNilaiExcel, { message: null, daftar: [], nilaiOk: null });

  // Status tombol "Simpan pratinjau" — di-set setelah pratinjau di-apply ke form
  const [status, setStatus] = useState<StatusForm>("siap");
  // Pratinjau bisa ditutup secara eksplisit (Batal / setelah simpan ke DB)
  const [pratinjauTutup, setPratinjauTutup] = useState(false);

  // Pratinjau = state useActionState, selama belum ditutup
  const pratinjauAktif =
    !pratinjauTutup && state.daftar.length > 0 ? state : null;

  const jumlahOk = pratinjauAktif
    ? pratinjauAktif.daftar.filter(
        (b: BarisPratinjauNilai) => b.status === "ok",
      ).length
    : 0;

  // Simpan pratinjau → isi form induk dengan nilai OK, pratinjau ditutup
  const simpanPratinjau = () => {
    if (!pratinjauAktif || !pratinjauAktif.nilaiOk) return;
    onSimpanPratinjau(pratinjauAktif.nilaiOk);
    setStatus("tersimpan");
    setPratinjauTutup(true);
  };

  // Batal → pratinjau ditutup
  const batalPratinjau = () => {
    setPratinjauTutup(true);
    setStatus("siap");
    const el = document.getElementById("file-nilai") as
      | HTMLInputElement
      | null;
    if (el) el.value = "";
  };

  // File baru di-pilih → pratinjau lama dianggap tidak relevan lagi
  const onFilePilih = () => {
    setPratinjauTutup(false);
    setStatus("siap");
  };

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Import Nilai dari Excel
        </h2>
        <a
          href="/template-nilai.xlsx"
          download
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          Unduh template
        </a>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Format: NIS · Nama · Nilai (0–100). Baris pertama di file dianggap
        judul kolom.
      </p>

      <form action={formAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="hidden" name="exam_id" value={examId} />

        <input
          id="file-nilai"
          type="file"
          name="file"
          accept=".xlsx"
          required
          onChange={onFilePilih}
          className="w-full rounded-lg border border-slate-300 text-sm text-slate-700 sm:max-w-xs"
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Membaca..." : "Pilih & Baca File"}
        </button>
      </form>

      {/* Pesan galat umum (file rusak, kelas belum dipilih, dll) —
          hanya kalau tidak ada baris pratinjau sama sekali.
          Pesan ringkas "N valid, M bermasalah" ikut pratinjau dan
          otomatis hilang saat pratinjau ditutup. */}
      {state.message && state.daftar.length === 0 ? (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      ) : null}

      {/* Pratinjau */}
      {pratinjauAktif && pratinjauAktif.daftar.length > 0 ? (
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Pratinjau
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {jumlahOk} ok
              </span>
              {pratinjauAktif.daftar.length - jumlahOk > 0 ? (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {pratinjauAktif.daftar.length - jumlahOk} bermasalah
                </span>
              ) : null}
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={batalPratinjau}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={simpanPratinjau}
                disabled={status === "tersimpan" || jumlahOk === 0}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "tersimpan"
                  ? "✓ Terisi di form"
                  : `Simpan ${jumlahOk} nilai ke form`}
              </button>
            </div>
          </div>

          {pratinjauAktif.message ? (
            <p className="mt-2 text-sm text-slate-500">{pratinjauAktif.message}</p>
          ) : null}

          <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left font-medium text-slate-500 sm:px-4"
                    >
                      NIS
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left font-medium text-slate-500 sm:px-4"
                    >
                      Nama (dari file)
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left font-medium text-slate-500 sm:px-4"
                    >
                      Nilai
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left font-medium text-slate-500 sm:px-4"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pratinjauAktif.daftar.map((baris, index) => (
                    <tr
                      key={index}
                      className={
                        baris.status === "ok"
                          ? "bg-emerald-50/50"
                          : "bg-red-50/50"
                      }
                    >
                      <td className="px-3 py-2 text-slate-700 tabular-nums sm:px-4">
                        {baris.nis || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 sm:px-4">
                        {baris.namaFile || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums sm:px-4">
                        {baris.status === "ok"
                          ? String(baris.nilai)
                          : baris.nilai > 0
                            ? String(baris.nilai)
                            : "—"}
                      </td>
                      <td className="px-3 py-2 sm:px-4">
                        {baris.status === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            {baris.alasan ?? "Bermasalah"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {status === "tersimpan" ? (
            <p className="mt-3 text-sm text-emerald-600">
              ✓ {jumlahOk} nilai sudah terisi di form di bawah. Klik
              &ldquo;Simpan Nilai&rdquo; untuk commit ke database.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
