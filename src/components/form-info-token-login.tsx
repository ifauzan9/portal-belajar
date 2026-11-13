"use client";

import { useActionState, useState } from "react";
import {
  simpanInfoTokenLogin,
  type HasilTokenLogin,
} from "@/app/guru/kelas/actions";
import { Notifikasi } from "@/components/ui/notifikasi";
import { MAKS_INFO_TOKEN_LOGIN } from "@/lib/pengaturan-soal";

// ============================================================================
// Form "Informasi Login Token" (Tahap 47) di /guru/kelas.
//
// Kalimat bebas dari guru yang tampil di /login-siswa. Saat dipublish dan
// teksnya tidak kosong, kalimat ini MENGGANTIKAN keterangan otomatis
// "Login token dibuka sampai pukul ...". Saat tidak dipublish, banner
// keterangan login token disembunyikan sepenuhnya tanpa menghapus teksnya.
// Bila teks belum pernah diisi, keterangan otomatis tetap dipakai.
// ============================================================================

export function FormInfoTokenLogin({
  info,
  aktif,
  siap,
}: {
  info: string;
  aktif: boolean;
  /** false = kolom Tahap 47 belum ada di database. */
  siap: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    HasilTokenLogin,
    FormData
  >(simpanInfoTokenLogin, { message: null });

  const [teks, setTeks] = useState(info);
  const [publish, setPublish] = useState(aktif);

  const sisa = MAKS_INFO_TOKEN_LOGIN - teks.length;
  const adaTeks = teks.trim().length > 0;
  const tampil = publish && adaTeks;
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">
          Informasi di halaman login
        </h4>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">
          Kalimat ini menggantikan keterangan otomatis buka/tutup token di
          halaman login siswa. Kalau tidak dipublish, tidak ada keterangan login
          token yang ditampilkan.
        </p>
      </div>

      {!siap ? (
        <Notifikasi varian="peringatan" judul="Kolom informasi login token belum ada">
          Jalankan <code className="font-mono">schema.sql</code> Tahap 47 di
          Supabase SQL Editor. Sebelum itu kalimat ini belum bisa diatur.
        </Notifikasi>
      ) : null}

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition ${
          publish
            ? "bg-emerald-50 ring-emerald-200"
            : "bg-white ring-slate-200 hover:bg-slate-50"
        } ${siap ? "" : "cursor-not-allowed opacity-60"}`}
      >
        <input
          type="checkbox"
          name="info_token_login_aktif"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          disabled={!siap}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-emerald-600"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900">
            Publish ke halaman login siswa
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
            Hilangkan centang untuk menyembunyikan seluruh keterangan login
            token dari halaman login siswa tanpa menghapus teksnya.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="info_token_login"
          className="block text-sm font-medium text-slate-700"
        >
          Kalimat informasi
        </label>
        <textarea
          id="info_token_login"
          name="info_token_login"
          rows={3}
          maxLength={MAKS_INFO_TOKEN_LOGIN}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          disabled={!siap}
          placeholder="Contoh: Login token dibuka sampai pukul 18.00 WIB. Kalau lupa password, hubungi guru kelas."
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
        <div className="mt-1 flex items-center justify-between gap-3 text-xs">
          <p className="text-slate-500">
            Baris baru ikut ditampilkan apa adanya.
          </p>
          <p
            className={
              sisa < 40 ? "font-medium text-amber-600" : "text-slate-400"
            }
          >
            {sisa} karakter tersisa
          </p>
        </div>
      </div>

      {/* Pratinjau mengikuti tampilan banner di halaman login siswa. */}
      <div>
        <p className="text-xs font-medium text-slate-600">Pratinjau</p>
        <div className="mt-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          {tampil ? (
            <p className="whitespace-pre-line break-words rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-200">
              {teks}
            </p>
          ) : (
            <p className="text-xs leading-5 text-slate-400">
              {!adaTeks
                ? "Belum ada kalimat, jadi keterangan otomatis tetap dipakai."
                : "Kalimat ini tidak dipublish, jadi tidak ada keterangan login token di halaman login siswa."}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !siap}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan informasi"}
        </button>

        {state.message ? (
          <span
            className={`text-xs ${
              state.sukses ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
