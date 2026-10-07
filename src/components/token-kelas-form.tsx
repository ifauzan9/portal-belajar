"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import {
  buatTokenBaru,
  hapusTokenKelas,
  setTokenKelas,
  type HasilTokenKelas,
} from "@/app/guru/kelas/actions";

// Form kelola token login siswa untuk satu kelas.
// Token dipakai siswa di /login-siswa (tab "Kode Token").
export function TokenKelasForm({
  kelasId,
  namaKelas,
  tokenAwal,
}: {
  kelasId: string;
  namaKelas: string;
  tokenAwal: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    HasilTokenKelas,
    FormData
  >(setTokenKelas, { message: null, sukses: false });

  const [stateAcak, formActionAcak, pendingAcak] = useActionState<
    HasilTokenKelas,
    FormData
  >(buatTokenBaru, { message: null, sukses: false });

  const [, startTransition] = useTransition();

  const [token, setToken] = useState(tokenAwal ?? "");

  const tersimpan = tokenAwal ?? "";
  const pesan = state.message ?? stateAcak.message;
  const sukses = state.sukses || stateAcak.sukses;
  const pesanSukses = stateAcak.sukses
    ? "Token baru dibuat. Muat ulang halaman untuk melihatnya."
    : pesan;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{namaKelas}</p>
          <p className="text-xs text-slate-500">
            {tersimpan
              ? "Token aktif untuk kelas ini"
              : "Belum ada token — siswa belum bisa login lewat token"}
          </p>
        </div>
        {tersimpan ? (
          <span className="font-mono text-lg font-semibold tracking-widest text-emerald-700">
            {tersimpan}
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-600">
            Tanpa token
          </span>
        )}
      </div>

      <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="kelas_id" value={kelasId} />
        <input
          name="token"
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder="contoh: 7AKUAT"
          maxLength={32}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tracking-wider text-slate-900 uppercase outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:max-w-48"
        />
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
            disabled={pending || pendingAcak || !tersimpan}
            onClick={() => {
              const data = new FormData();
              data.set("kelas_id", kelasId);
              startTransition(() => formActionAcak(data));
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAcak ? "Membuat..." : "Tukar Token"}
          </button>
        </div>
      </form>

      {sukses ? (
        <p className="mt-2 text-xs text-emerald-600">{pesanSukses}</p>
      ) : pesan ? (
        <p className="mt-2 text-xs text-red-600">{pesan}</p>
      ) : null}

      {tersimpan ? (
        <form
          action={hapusTokenKelas}
          className="mt-2"
          onSubmit={(e) => {
            if (
              !confirm(
                `Hapus token ${namaKelas}? Siswa tidak bisa login lewat token sampai guru membuat token baru.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="kelas_id" value={kelasId} />
          <button
            type="submit"
            className="text-xs font-medium text-red-600 transition hover:underline"
          >
            Hapus token
          </button>
        </form>
      ) : null}
    </div>
  );
}