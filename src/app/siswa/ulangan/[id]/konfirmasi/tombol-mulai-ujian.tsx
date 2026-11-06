"use client";

import { useState } from "react";
import { useActionState } from "react";
import { mulaiUjianSiswa, type HasilMulaiUjian } from "@/app/siswa/actions";

// Tombol mulai di halaman konfirmasi. Timer baru dibuat di server setelah
// siswa mencentang pernyataan dan menekan tombol ini.
export function TombolMulaiUjian({
  examId,
  butuhKode,
}: {
  examId: string;
  butuhKode: boolean;
}) {
  const [setuju, setSetuju] = useState(false);
  const [kode, setKode] = useState("");
  const [state, formAction, pending] = useActionState<
    HasilMulaiUjian,
    FormData
  >(mulaiUjianSiswa, { message: null });

  const idKode = `kode-akses-${examId}`;
  const kodeSiap = !butuhKode || kode.trim().length > 0;

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="exam_id" value={examId} />

      {butuhKode ? (
        <div>
          <label
            htmlFor={idKode}
            className="block text-sm font-medium text-slate-700"
          >
            Kode akses
          </label>
          <input
            id={idKode}
            name="kode"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={kode}
            onChange={(event) => setKode(event.target.value)}
            placeholder="Masukkan kode dari guru"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:max-w-xs"
          />
          <p className="mt-1 text-xs text-slate-500">
            Kode diberikan guru. Huruf besar/kecil tidak dibedakan.
          </p>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
        <input
          type="checkbox"
          checked={setuju}
          onChange={(event) => setSetuju(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          Saya sudah membaca informasi di atas dan siap mengerjakan. Timer akan
          langsung berjalan setelah saya menekan <strong>Mulai Sekarang</strong>.
        </span>
      </label>

      <button
        type="submit"
        disabled={!setuju || !kodeSiap || pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Memulai..." : "Mulai Sekarang"}
      </button>

      {state.message ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}