"use client";

import { useActionState } from "react";
import { nilaiTugas, type HasilTugas } from "@/app/guru/tugas/actions";
import { Badge } from "@/components/ui/badge";
import { formatUkuran, urlPublikBerkas } from "@/lib/tugas";

export type BerkasPengumpulan = {
  id: string;
  tipe: "foto" | "dokumen";
  nama_file: string;
  path: string;
  ukuran: number;
};

export function BarisPengumpulan({
  tugasId,
  submissionId,
  namaSiswa,
  nis,
  tautan,
  catatan,
  nilai,
  umpanBalik,
  updatedAt,
  berkas,
}: {
  tugasId: string;
  submissionId: string;
  namaSiswa: string;
  nis: string | null;
  tautan: string | null;
  catatan: string | null;
  nilai: number | null;
  umpanBalik: string | null;
  updatedAt: string | null;
  berkas: BerkasPengumpulan[];
}) {
  const [state, formAction, pending] = useActionState<HasilTugas, FormData>(
    nilaiTugas,
    { message: null, berhasil: false },
  );

  const foto = berkas.filter((b) => b.tipe === "foto");
  const dokumen = berkas.filter((b) => b.tipe === "dokumen");

  const waktu = updatedAt
    ? new Date(updatedAt).toLocaleString("id-ID")
    : "-";

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{namaSiswa}</p>
          <p className="text-xs text-slate-400">
            {nis ? `NIS: ${nis} · ` : ""}
            Dikumpulkan: {waktu}
          </p>
        </div>
        {nilai === null ? (
          <Badge varian="peringatan">Belum dinilai</Badge>
        ) : (
          <Badge varian="sukses" titik>
            Nilai: {nilai}
          </Badge>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {tautan ? (
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Tautan
            </p>
            <a
              href={tautan}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-sm font-medium text-blue-600 underline hover:no-underline"
            >
              {tautan}
            </a>
          </div>
        ) : null}

        {catatan ? (
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Catatan siswa
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
              {catatan}
            </p>
          </div>
        ) : null}

        {foto.length > 0 ? (
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Foto ({foto.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {foto.map((berkasFoto) => {
                const url = urlPublikBerkas(berkasFoto.path);
                return (
                  <a
                    key={berkasFoto.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                    title={berkasFoto.nama_file}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={berkasFoto.nama_file}
                      className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200 transition group-hover:ring-emerald-400"
                    />
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        {dokumen.length > 0 ? (
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Dokumen ({dokumen.length})
            </p>
            <ul className="mt-1 space-y-1">
              {dokumen.map((berkasDok) => (
                <li key={berkasDok.id}>
                  <a
                    href={urlPublikBerkas(berkasDok.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 underline hover:no-underline"
                  >
                    📄 {berkasDok.nama_file}
                    <span className="text-xs font-normal text-slate-400 no-underline">
                      ({formatUkuran(berkasDok.ukuran)})
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <form
        action={formAction}
        className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="submission_id" value={submissionId} />
        <input type="hidden" name="tugas_id" value={tugasId} />

        <div className="sm:w-28">
          <label
            htmlFor={`nilai-${submissionId}`}
            className="block text-xs font-medium text-slate-600"
          >
            Nilai (0–100)
          </label>
          <input
            id={`nilai-${submissionId}`}
            name="nilai"
            type="number"
            min={0}
            max={100}
            defaultValue={nilai ?? ""}
            placeholder="–"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor={`umpan-${submissionId}`}
            className="block text-xs font-medium text-slate-600"
          >
            Umpan balik
          </label>
          <input
            id={`umpan-${submissionId}`}
            name="umpan_balik"
            type="text"
            defaultValue={umpanBalik ?? ""}
            placeholder="Catatan untuk siswa"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan Nilai"}
        </button>
      </form>

      {state.message ? (
        <p
          className={`mt-2 text-sm ${
            state.berhasil ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
