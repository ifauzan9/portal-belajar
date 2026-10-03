"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import {
  previewKredensial,
  simpanImportKredensial,
  buatKredensialOtomatis,
  type HasilPreviewKredensial,
  type HasilSimpanKredensial,
  type HasilBuatOtomatis,
  type KredensialOtomatis,
} from "@/app/guru/siswa/kredensial/actions";
import type { BarisImportKredensial } from "@/lib/parse-kredensial-xlsx";

// ============================================================================
// Panel import kredensial massal dari Excel (.xlsx)
// Format: | NIS | Kelas | Username | Password |
// ============================================================================

function ImportKredensial() {
  const [preview, previewAction, previewPending] = useActionState<
    HasilPreviewKredensial,
    FormData
  >(previewKredensial, { rows: [], error: null });

  const [simpan, simpanAction, simpanPending] = useActionState<
    HasilSimpanKredensial,
    FormData
  >(simpanImportKredensial, { jumlah: 0, dilewati: 0, error: null });

  const valid = preview.rows.filter((row) => row.status === "ok");
  const dilewati = preview.rows.length - valid.length;
  const berhasil = simpan.jumlah > 0;

  return (
    <div className="space-y-6">
      <form
        action={previewAction}
        className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5"
      >
        <label
          htmlFor="file-kredensial"
          className="block text-sm font-medium text-slate-700"
        >
          File Excel kredensial (.xlsx)
        </label>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="file-kredensial"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white sm:flex-1"
          />
          <a
            href="/template-kredensial.xlsx"
            download
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Unduh Template (.xlsx)
          </a>
          <button
            type="submit"
            disabled={previewPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewPending ? "Membaca file..." : "Lihat Pratinjau"}
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Baris 1 = judul kolom <b>NIS</b>, <b>Kelas</b>, <b>Username</b>,{" "}
          <b>Password</b>; data mulai baris 2. Kelas boleh kosong (tidak
          divalidasi). Username harus unik, password minimal 6 karakter.
          Maksimal 1000 baris / 2 MB.
        </p>

        {preview.error ? (
          <p className="mt-2 text-sm text-red-600">{preview.error}</p>
        ) : null}
      </form>

      {berhasil ? (
        <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
          ✅ {simpan.jumlah} kredensial berhasil diimport.
          {simpan.dilewati > 0
            ? ` ${simpan.dilewati} baris dilewati (NIS tak dikenal, username konflik, dst).`
            : ""}{" "}
          <Link href="/guru/siswa" className="font-medium underline">
            Lihat Data Siswa
          </Link>
        </p>
      ) : null}

      {!berhasil && preview.rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600 sm:px-5">
            Ditemukan <b>{preview.rows.length}</b> baris: <b>{valid.length}</b>{" "}
            siap diimport
            {dilewati > 0 ? `, ${dilewati} dilewati` : ""}.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-5">Baris</th>
                  <th className="px-4 py-2 font-medium">NIS</th>
                  <th className="px-4 py-2 font-medium">Kelas</th>
                  <th className="px-4 py-2 font-medium">Username</th>
                  <th className="px-4 py-2 font-medium">Password</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row: BarisImportKredensial) => (
                  <tr
                    key={row.nomor}
                    className={row.status === "ok" ? "" : "bg-red-50"}
                  >
                    <td className="px-4 py-2 text-slate-400 tabular-nums sm:px-5">
                      {row.nomor}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.nis || "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.kelas || "-"}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-900">
                      {row.username || "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">••••••</td>
                    <td
                      className={`px-4 py-2 ${
                        row.status === "ok"
                          ? "text-slate-500"
                          : "text-red-600"
                      }`}
                    >
                      {row.alasan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {valid.length > 0 ? (
            <form
              action={simpanAction}
              className="border-t border-slate-100 px-4 py-3 sm:px-5"
            >
              <input
                type="hidden"
                name="rows"
                value={JSON.stringify(
                  valid.map((row) => ({
                    nis: row.nis,
                    username: row.username,
                    password: row.password,
                  })),
                )}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={simpanPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {simpanPending
                    ? "Menyimpan..."
                    : `Import ${valid.length} Kredensial`}
                </button>
                {simpan.error ? (
                  <p className="text-sm text-red-600">{simpan.error}</p>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-600 sm:px-5">
              Tidak ada baris valid. Periksa NIS (harus terdaftar) dan
              kelengkapan username + password.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Panel "Buat kredensial otomatis" — untuk semua siswa tanpa akun.
// Username = slug nama + suffix acak. Password random 8 char.
// Password hanya tampil SATU KALI.
// ============================================================================

function BuatOtomatis({ daftarKelas }: { daftarKelas: { id: string; nama_kelas: string }[] }) {
  const [hasil, formAction, pending] = useActionState<
    HasilBuatOtomatis,
    FormData
  >(buatKredensialOtomatis, { dibuat: [], error: null });

  async function unduhExcel(dibuat: KredensialOtomatis[]) {
    const respons = await fetch("/guru/siswa/kredensial/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: dibuat.map((k) => ({
          nama: k.nama,
          nis: k.nis,
          username: k.username,
          password: k.password,
        })),
      }),
    });

    if (!respons.ok) {
      const pesan = respons.status === 401 ? "Sesi habis, login ulang." : "Gagal mengunduh.";
      alert(pesan);
      return;
    }

    const blob = await respons.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kredensial-siswa.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Buat kredensial otomatis
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Membuat username + password acak untuk siswa yang belum punya akun.
          Username berformat{" "}
          <code className="rounded bg-slate-100 px-1 text-slate-700">
            nama-suffix
          </code>
          . Password ditampilkan sekali setelah dibuat.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          {daftarKelas.length > 0 ? (
            <div className="flex-1">
              <label
                htmlFor="pilih-kelas"
                className="block text-xs font-medium text-slate-500"
              >
                Kelas
              </label>
              <select
                id="pilih-kelas"
                name="kelas"
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Semua kelas</option>
                {daftarKelas.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {kelas.nama_kelas}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="flex-1 text-xs text-slate-500">
              Belum ada kelas. Kredensial akan dibuat untuk semua siswa.
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
          >
            {pending ? "Membuat..." : "Buat Sekarang"}
          </button>
        </div>

        {hasil.error ? (
          <p className="mt-3 text-sm text-red-600">{hasil.error}</p>
        ) : null}

        {!hasil.error && hasil.dibuat.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Tidak ada siswa yang belum punya akun. Semua sudah terdaftar.
          </p>
        ) : null}
      </form>

      {hasil.dibuat.length > 0 ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="text-sm font-medium text-amber-800">
              ⚠️ {hasil.dibuat.length} kredensial berhasil dibuat.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Password di bawah hanya bisa dilihat sekali. Salin, unduh Excel,
              atau tangkap layar sekarang, lalu bagikan ke siswa. Jika hilang,
              password bisa di-reset lewat menu{" "}
              <em>Ubah kredensial</em> di Data Siswa.
            </p>
            <button
              type="button"
              onClick={() => unduhExcel(hasil.dibuat)}
              className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              ⬇ Unduh Excel Kredensial
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium sm:px-5">Nama</th>
                    <th className="px-4 py-2 font-medium">NIS</th>
                    <th className="px-4 py-2 font-medium">Username</th>
                    <th className="px-4 py-2 font-medium">Password</th>
                    <th className="px-4 py-2 font-medium">Salin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasil.dibuat.map((k, i) => (
                    <SalinBarisKredensial key={i} data={k} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SalinBarisKredensial({
  data,
}: {
  data: { nama: string; nis: string; username: string; password: string };
}) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    const teks = `${data.username} / ${data.password}`;
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Fallback: tampilkan untuk disalin manual.
      setTersalin(false);
    }
  }

  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-4 py-2 font-medium text-slate-900 sm:px-5">
        {data.nama}
      </td>
      <td className="px-4 py-2 text-slate-600">{data.nis}</td>
      <td className="px-4 py-2 font-mono text-slate-900">{data.username}</td>
      <td className="px-4 py-2 font-mono text-slate-900">{data.password}</td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={salin}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {tersalin ? "Tersalin ✓" : "Salin"}
        </button>
      </td>
    </tr>
  );
}

// ============================================================================
// Gabungan dua panel di satu halaman.
// ============================================================================

export function PanelKredensialSiswa({ daftarKelas }: { daftarKelas: { id: string; nama_kelas: string }[] }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          Import dari Excel
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Bagi guru yang sudah menyiapkan NIS, username, dan password di Excel.
        </p>
        <div className="mt-4">
          <ImportKredensial />
        </div>
      </section>

      <hr className="border-slate-200" />

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          Buat Otomatis
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Bagi guru yang mau cepat: username + password di-generate acak untuk
          siswa tanpa akun, bisa dibatasi per kelas.
        </p>
        <div className="mt-4">
          <BuatOtomatis daftarKelas={daftarKelas} />
        </div>
      </section>
    </div>
  );
}
