"use client";

import { useActionState, useState } from "react";
import {
  hapusAbsensiTanggal,
  simpanAbsensi,
} from "@/app/guru/absensi/actions";
import {
  DAFTAR_STATUS,
  LABEL_STATUS,
  type StatusAbsensi,
} from "@/lib/absensi";

type Siswa = { id: string; nis: string | null; nama_siswa: string };

const WARNA_TOMBOL: Record<StatusAbsensi, string> = {
  hadir: "bg-emerald-600 text-white",
  sakit: "bg-blue-600 text-white",
  izin: "bg-amber-500 text-white",
  alpa: "bg-red-600 text-white",
};

export function FormAbsensi({
  kelasId,
  tanggal,
  siswa,
  awal,
}: {
  kelasId: string;
  tanggal: string;
  siswa: Siswa[];
  awal: Record<string, StatusAbsensi>;
}) {
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(simpanAbsensi, { message: null });

  // Default "hadir"; guru cukup mengubah siswa yang tidak hadir.
  const [status, setStatus] = useState<Record<string, StatusAbsensi>>(() => {
    const hasil: Record<string, StatusAbsensi> = {};
    for (const s of siswa) {
      hasil[s.id] = awal[s.id] ?? "hadir";
    }
    return hasil;
  });

  if (siswa.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Kelas ini belum punya siswa. Tambahkan siswa dulu di menu Siswa.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="kelas_id" value={kelasId} />
      <input type="hidden" name="tanggal" value={tanggal} />

      <ul className="divide-y divide-slate-100">
        {siswa.map((s, index) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-6 shrink-0 text-sm tabular-nums text-slate-400">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {s.nama_siswa}
                </span>
                {s.nis ? (
                  <span className="block text-xs text-slate-400">
                    NIS {s.nis}
                  </span>
                ) : null}
              </span>
            </span>

            <input
              type="hidden"
              name={`status_${s.id}`}
              value={status[s.id]}
            />
            <div className="flex flex-wrap gap-1">
              {DAFTAR_STATUS.map((st) => {
                const nyala = status[s.id] === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      setStatus((prev) => ({ ...prev, [s.id]: st }))
                    }
                    aria-pressed={nyala}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      nyala
                        ? WARNA_TOMBOL[st]
                        : "border border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {LABEL_STATUS[st]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan Absensi"}
        </button>

        <button
          type="submit"
          formAction={hapusAbsensiTanggal}
          onClick={(event) => {
            if (!confirm("Kosongkan absensi kelas ini untuk tanggal ini?")) {
              event.preventDefault();
            }
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Kosongkan hari ini
        </button>

        {state.message ? (
          <p className="text-sm text-red-600">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
