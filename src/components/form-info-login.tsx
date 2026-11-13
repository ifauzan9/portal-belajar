"use client";

import { useActionState, useState } from "react";
import {
  simpanInfoLoginSiswa,
  type HasilPengaturanSoal,
} from "@/app/guru/pengaturan/actions";
import { Notifikasi } from "@/components/ui/notifikasi";
import { JAM_TUTUP_TOKEN_LOGIN, MAKS_INFO_LOGIN } from "@/lib/pengaturan-soal";

// ============================================================================
// Form "Informasi di halaman login siswa" (Tahap 44).
//
// Teks bebas dari guru yang tampil di /login-siswa. Bisa disembunyikan tanpa
// menghapus teksnya lewat centang "Tampilkan". Pratinjau di bawah dibuat
// semirip mungkin dengan tampilan aslinya.
// ============================================================================

export function FormInfoLogin({
  info,
  aktif,
  siap,
}: {
  info: string;
  aktif: boolean;
  /** false = kolom Tahap 44 belum ada di database. */
  siap: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    HasilPengaturanSoal,
    FormData
  >(simpanInfoLoginSiswa, { message: null, sukses: false });

  const [teks, setTeks] = useState(info);
  const [tampil, setTampil] = useState(aktif);

  const sisa = MAKS_INFO_LOGIN - teks.length;
  const adaTeks = teks.trim().length > 0;

  return (
    <form action={formAction} className="space-y-4">
      {!siap ? (
        <Notifikasi varian="peringatan" judul="Kolom informasi login belum ada">
          Jalankan <code className="font-mono">schema.sql</code> Tahap 44 di
          Supabase SQL Editor. Sebelum itu informasi di halaman login siswa
          belum bisa diatur.
        </Notifikasi>
      ) : null}

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl p-4 ring-1 transition ${
          tampil
            ? "bg-blue-50 ring-blue-200"
            : "bg-white ring-slate-200 hover:bg-slate-50"
        } ${siap ? "" : "cursor-not-allowed opacity-60"}`}
      >
        <input
          type="checkbox"
          name="info_login_siswa_aktif"
          checked={tampil}
          onChange={(e) => setTampil(e.target.checked)}
          disabled={!siap}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-blue-600"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">
            Tampilkan di halaman login siswa
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
            Matikan centang ini untuk menyembunyikan informasi sementara tanpa
            menghapus teksnya.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="info_login_siswa"
          className="block text-sm font-medium text-slate-700"
        >
          Informasi untuk siswa
        </label>
        <textarea
          id="info_login_siswa"
          name="info_login_siswa"
          rows={4}
          maxLength={MAKS_INFO_LOGIN}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          disabled={!siap}
          placeholder={`Contoh: Login token hanya dibuka sampai pukul ${JAM_TUTUP_TOKEN_LOGIN}.00 WIB. Kalau lupa password, hubungi guru kelas.`}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
        <div className="mt-1 flex items-center justify-between gap-3 text-xs">
          <p className="text-slate-500">
            Tampil di <span className="font-mono">/login-siswa</span>. Baris
            baru ikut ditampilkan apa adanya.
          </p>
          <p
            className={sisa < 40 ? "font-medium text-amber-600" : "text-slate-400"}
          >
            {sisa} karakter tersisa
          </p>
        </div>
      </div>

      {/* Pratinjau mengikuti tampilan di halaman login siswa. */}
      <div>
        <p className="text-xs font-medium text-slate-600">Pratinjau</p>
        <div className="mt-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          {tampil && adaTeks ? (
            <Notifikasi varian="info" judul="Informasi">
              <p className="whitespace-pre-line break-words">{teks}</p>
            </Notifikasi>
          ) : (
            <p className="text-xs text-slate-400">
              {tampil
                ? "Belum ada teks, jadi tidak ada yang tampil di halaman login."
                : "Informasi sedang disembunyikan dari halaman login siswa."}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !siap}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan informasi"}
        </button>

        {state.message ? (
          <span className="text-sm text-red-600">{state.message}</span>
        ) : null}
        {state.sukses && !state.message ? (
          <span className="text-sm text-emerald-600">
            Informasi tersimpan dan langsung tampil di halaman login.
          </span>
        ) : null}
      </div>
    </form>
  );
}
