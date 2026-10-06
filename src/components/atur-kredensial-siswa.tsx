"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  aturKredensialSiswa,
  toggleAkunSiswa,
  type HasilAturKredensial,
  type HasilToggleAkun,
} from "@/app/guru/siswa/atur-kredensial-actions";

// Form atur kredensial (username + password) siswa oleh guru.
// Dipakai di baris siswa: satu form untuk tiap siswa.
// Kalau siswa belum punya akun, tombol "Buat Akun" membuka form ini.
export function AturKredensialSiswa({
  siswaId,
  usernameAwal,
  namaSiswa,
}: {
  siswaId: string;
  usernameAwal: string | null;
  namaSiswa: string;
}) {
  const [state, formAction, pending] = useActionState<
    HasilAturKredensial,
    FormData
  >(aturKredensialSiswa, { message: null, sukses: false });

  const [bukaForm, setBukaForm] = useState(!usernameAwal);
  const [tampilkanPassword, setTampilkanPassword] = useState(false);

  // Kalau baru saja berhasil, tutup form otomatis setelah beberapa detik.
  useEffect(() => {
    if (!state.sukses) return;
    const timer = setTimeout(() => setBukaForm(false), 2500);
    return () => clearTimeout(timer);
  }, [state.sukses]);

  const label = usernameAwal ? "Ubah kredensial" : "Buat akun login";

  if (!bukaForm) {
    return (
      <button
        type="button"
        onClick={() => setBukaForm(true)}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
      >
        {label}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setTampilkanPassword(true)}
      className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
    >
      <input type="hidden" name="siswa_id" value={siswaId} />
      <p className="text-xs font-medium text-slate-700">
        {label} — {namaSiswa}
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor={`username-${siswaId}`}
            className="block text-xs font-medium text-slate-500"
          >
            Username
          </label>
          <input
            id={`username-${siswaId}`}
            name="username"
            type="text"
            required
            minLength={3}
            defaultValue={usernameAwal ?? ""}
            placeholder="contoh: budi123"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor={`password-${siswaId}`}
            className="block text-xs font-medium text-slate-500"
          >
            Password
          </label>
          <input
            id={`password-${siswaId}`}
            name="password"
            type={tampilkanPassword ? "text" : "password"}
            required
            minLength={6}
            placeholder="Minimal 6 karakter"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

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
            onClick={() => {
              setBukaForm(false);
              setTampilkanPassword(false);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>
      </div>

      {state.message ? (
        <p
          className={`mt-2 text-xs ${
            state.sukses ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

// ============================================================================
// Tombol nonaktifkan / aktifkan akun siswa.
// Nonaktifkan = siswa tidak bisa login (data tetap tersimpan).
// Aktifkan   = siswa bisa login lagi.
// ============================================================================
export function ToggleAkunSiswa({
  siswaId,
  akunAktif,
  namaSiswa,
}: {
  siswaId: string;
  akunAktif: boolean;
  namaSiswa: string;
}) {
  const [state, formAction, pending] = useActionState<
    HasilToggleAkun,
    FormData
  >(toggleAkunSiswa, { message: null });

  const labelTombol = akunAktif ? "Nonaktifkan Akun" : "Aktifkan Akun";
  const warnaTombol = akunAktif
    ? "border-red-300 text-red-700 hover:bg-red-50"
    : "border-green-300 text-green-700 hover:bg-green-50";

  return (
    <form action={formAction}>
      <input type="hidden" name="siswa_id" value={siswaId} />
      <input type="hidden" name="aktifkan" value={String(!akunAktif)} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${warnaTombol}`}
      >
        {pending ? "Memproses..." : labelTombol}
      </button>
      {state.message ? (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}
