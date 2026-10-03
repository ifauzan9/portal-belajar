"use client";

import { useActionState } from "react";
import {
  kumpulkanTugas,
  type HasilKumpulTugas,
} from "@/app/siswa/tugas/actions";
import {
  MAKS_FILE,
  MAKS_FILE_MB,
  daftarEkstensiDiizinkan,
  metodeMengizinkanFile,
  metodeMengizinkanLink,
  type MetodePengumpulan,
} from "@/lib/tugas";

const inputBase =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const labelBase = "block text-sm font-medium text-slate-700";
const hintBase = "mt-1 text-xs text-slate-400";

export function FormKumpulTugas({
  tugasId,
  metode,
  fileDiizinkan,
  tautanAwal,
  catatanAwal,
  adaBerkasLama,
}: {
  tugasId: string;
  metode: MetodePengumpulan;
  fileDiizinkan: string[];
  tautanAwal: string | null;
  catatanAwal: string | null;
  adaBerkasLama: boolean;
}) {
  const [state, formAction, pending] = useActionState<HasilKumpulTugas, FormData>(
    kumpulkanTugas,
    { message: null, berhasil: false },
  );

  const bolehLink = metodeMengizinkanLink(metode);
  const bolehFile = metodeMengizinkanFile(metode);
  const accept = daftarEkstensiDiizinkan(fileDiizinkan).join(",");

  return (
    <form
      action={formAction}
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <input type="hidden" name="tugas_id" value={tugasId} />

      <div className="space-y-4">
        {bolehLink ? (
          <div>
            <label htmlFor="tautan-tugas" className={labelBase}>
              Tautan {metode === "link" ? "(wajib)" : "(opsional)"}
            </label>
            <input
              id="tautan-tugas"
              name="tautan"
              type="text"
              defaultValue={tautanAwal ?? ""}
              placeholder="https://contoh.com/hasil-kerja"
              className={inputBase}
            />
            <p className={hintBase}>
              Tempel alamat tautan hasil kerjamu (Google Drive, video, dll).
            </p>
          </div>
        ) : null}

        {bolehFile ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="foto-tugas" className={labelBase}>
                Foto
              </label>
              <input
                id="foto-tugas"
                name="foto"
                type="file"
                multiple
                accept={accept}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
              />
              <p className={hintBase}>Bisa pilih beberapa foto.</p>
            </div>

            <div>
              <label htmlFor="dokumen-tugas" className={labelBase}>
                Dokumen
              </label>
              <input
                id="dokumen-tugas"
                name="dokumen"
                type="file"
                multiple
                accept={accept}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
              />
              <p className={hintBase}>PDF, Word, Excel, PPT, ZIP, dll.</p>
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="catatan-tugas" className={labelBase}>
            Catatan (opsional)
          </label>
          <textarea
            id="catatan-tugas"
            name="catatan"
            rows={3}
            defaultValue={catatanAwal ?? ""}
            placeholder="Keterangan tambahan untuk guru..."
            className={inputBase}
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Mengirim..." : "Kumpulkan Tugas"}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Maksimal {MAKS_FILE} berkas, {MAKS_FILE_MB} MB per berkas.
        {bolehFile && adaBerkasLama
          ? " Mengunggah berkas baru akan mengganti berkas lama."
          : ""}
      </p>

      {state.message ? (
        <p
          className={`mt-3 text-sm ${
            state.berhasil ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
