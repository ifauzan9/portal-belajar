"use client";

import { useActionState } from "react";
import {
  gantiPassword,
  type HasilGantiPassword,
} from "@/app/siswa/actions";

export default function GantiPasswordPage() {
  const [state, formAction, pending] = useActionState<
    HasilGantiPassword,
    FormData
  >(gantiPassword, { message: null, sukses: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Ganti Password
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ubah password akun kamu. Password lama wajib benar.
        </p>
      </div>

      <form
        action={formAction}
        className="max-w-sm space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200"
      >
        <div>
          <label
            htmlFor="password_lama"
            className="block text-sm font-medium text-slate-700"
          >
            Password lama
          </label>
          <input
            id="password_lama"
            name="password_lama"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label
            htmlFor="password_baru"
            className="block text-sm font-medium text-slate-700"
          >
            Password baru
          </label>
          <input
            id="password_baru"
            name="password_baru"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Minimal 6 karakter"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label
            htmlFor="password_konfirmasi"
            className="block text-sm font-medium text-slate-700"
          >
            Konfirmasi password baru
          </label>
          <input
            id="password_konfirmasi"
            name="password_konfirmasi"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        {state.sukses ? (
          <p className="text-sm text-emerald-600">{state.message}</p>
        ) : null}
        {state.message && !state.sukses ? (
          <p className="text-sm text-red-600">{state.message}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Ganti Password"}
        </button>
      </form>
    </div>
  );
}
