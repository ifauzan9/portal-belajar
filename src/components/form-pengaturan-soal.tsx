"use client";

import { useActionState, useState, type FormEvent } from "react";
import {
  simpanPengaturanSoal,
  type HasilPengaturanSoal,
} from "@/app/guru/pengaturan/actions";
import { MAKS_PESAN_TUTUP, PESAN_TUTUP_DEFAULT } from "@/lib/pengaturan-soal";
import { Notifikasi } from "@/components/ui/notifikasi";

// ============================================================================
// Form pengaturan akses soal di akun guru (Tahap 41).
//
// Dua saklar + pesan opsional untuk siswa. Perubahan langsung berlaku untuk
// semua siswa setelah disimpan (tanpa perlu logout).
// ============================================================================

function Saklar({
  nama,
  judul,
  keterangan,
  aktif,
  siap,
  onUbah,
}: {
  nama: string;
  judul: string;
  keterangan: string;
  aktif: boolean;
  siap: boolean;
  onUbah: (aktif: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl p-4 ring-1 transition ${
        aktif
          ? "bg-red-50 ring-red-200"
          : "bg-white ring-slate-200 hover:bg-slate-50"
      } ${siap ? "" : "cursor-not-allowed opacity-60"}`}
    >
      <input
        type="checkbox"
        name={nama}
        defaultChecked={aktif}
        disabled={!siap}
        onChange={(e) => onUbah(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-red-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">
          {judul}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
          {keterangan}
        </span>
      </span>
    </label>
  );
}

export function FormPengaturanSoal({
  tutupUlangan,
  tutupLab,
  pesan,
  siap,
}: {
  tutupUlangan: boolean;
  tutupLab: boolean;
  pesan: string;
  siap: boolean;
}) {
  const [state, formAction, pending] = useActionState<HasilPengaturanSoal, FormData>(
    simpanPengaturanSoal,
    { message: null, sukses: false },
  );

  const [ulanganAktif, setUlanganAktif] = useState(tutupUlangan);
  const [labAktif, setLabAktif] = useState(tutupLab);

  // Konfirmasi hanya saat MENYALAKAN saklar baru, bukan setiap kali simpan.
  function konfirmasi(e: FormEvent<HTMLFormElement>) {
    const menyalakanBaru =
      (ulanganAktif && !tutupUlangan) || (labAktif && !tutupLab);
    if (!menyalakanBaru) return;

    const yakin = window.confirm(
      "Siswa yang belum mulai tidak akan bisa membuka soal. Siswa yang sudah memulai tetap bisa menyelesaikan. Lanjutkan?",
    );
    if (!yakin) e.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={konfirmasi} className="space-y-5">
      {!siap ? (
        <Notifikasi varian="peringatan" judul="Tabel pengaturan belum ada">
          Jalankan <code className="font-mono">schema.sql</code> Tahap 41 di
          Supabase SQL Editor. Sebelum itu, saklar di bawah belum bisa dipakai
          dan akses soal tetap terbuka seperti sebelumnya.
        </Notifikasi>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Saklar
          nama="tutup_ulangan"
          judul="Tutup soal ulangan"
          keterangan="Siswa tidak bisa membuka atau memulai soal ulangan. Nilai yang sudah ada tetap bisa dilihat."
          aktif={ulanganAktif}
          siap={siap}
          onUbah={setUlanganAktif}
        />
        <Saklar
          nama="tutup_lab"
          judul="Tutup soal Lab Coding"
          keterangan="Siswa tidak bisa membuka modul dan level Lab Coding. Progres yang tersimpan tidak hilang."
          aktif={labAktif}
          siap={siap}
          onUbah={setLabAktif}
        />
      </div>

      <div>
        <label
          htmlFor="pesan_tutup"
          className="block text-sm font-medium text-slate-700"
        >
          Pesan untuk siswa
        </label>
        <textarea
          id="pesan_tutup"
          name="pesan_tutup"
          rows={3}
          maxLength={MAKS_PESAN_TUTUP}
          defaultValue={pesan}
          placeholder={PESAN_TUTUP_DEFAULT}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <p className="mt-1 text-xs text-slate-500">
          Ditampilkan di banner portal siswa saat akses soal ditutup. Kosongkan
          untuk memakai pesan bawaan.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !siap}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan pengaturan"}
        </button>

        {state.message ? (
          <span className="text-sm text-red-600">{state.message}</span>
        ) : null}
        {state.sukses && !state.message ? (
          <span className="text-sm text-emerald-600">
            Pengaturan tersimpan dan langsung berlaku.
          </span>
        ) : null}
      </div>
    </form>
  );
}
