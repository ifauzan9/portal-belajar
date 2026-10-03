"use client";

import { useActionState } from "react";
import { addKelas } from "@/app/guru/kelas/actions";

function IkonTambah({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TambahKelasForm() {
  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(addKelas, { message: null });

  return (
    <form
      action={formAction}
      className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5"
    >
      <label
        htmlFor="nama_kelas"
        className="block text-sm font-medium text-slate-700"
      >
        Nama kelas
      </label>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="nama_kelas"
          name="nama_kelas"
          type="text"
          required
          placeholder="Contoh: 7A"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:max-w-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IkonTambah className="h-4 w-4" />
          {pending ? "Menyimpan..." : "Tambah Kelas"}
        </button>
      </div>

      {state.message ? (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}