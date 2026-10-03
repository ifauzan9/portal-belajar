"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginSiswa, type HasilLogin } from "@/app/siswa/actions";

export default function LoginSiswaPage() {
  const [state, formAction, pending] = useActionState<HasilLogin, FormData>(
    loginSiswa,
    { message: null },
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">
          Portal Siswa
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Masuk dengan username dan password yang diberikan guru.
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-700"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {state.message ? (
            <p className="text-sm text-red-600">{state.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Guru?{" "}
          <Link
            href="/login"
            className="font-medium text-slate-600 transition hover:text-slate-900"
          >
            Masuk Portal Guru
          </Link>
        </p>
      </div>
    </div>
  );
}