"use client";

import { useActionState, useSyncExternalStore } from "react";
import {
  hapusSemuaTokenKelas,
  setTokenLoginDibuka,
  setTokenLoginMode,
  type HasilTokenLogin,
} from "@/app/guru/kelas/actions";
import { Notifikasi } from "@/components/ui/notifikasi";
import {
  JAM_TUTUP_TOKEN_LOGIN,
  type TokenLoginMode,
} from "@/lib/pengaturan-soal";
import { jamWib } from "@/lib/waktu";

// ============================================================================
// Kontrol login token siswa (Tahap 43 + 45) di /guru/kelas.
//
//   1. Pilih mode: Otomatis (tutup pukul 18.00 WIB) atau Manual (atur sendiri).
//   2. Saklar induk buka/tutup — di mode otomatis berfungsi sebagai tombol
//      matikan total kapan pun.
//   3. Tombol hapus SEMUA token sekaligus.
//
// Token per kelas tetap dikelola lewat TokenKelasForm di bawahnya.
// ============================================================================

// Segarkan status jam tiap 30 detik agar badge berubah sendiri saat pukul
// 18.00 WIB lewat (server snapshot dipakai saat hydration pertama).
function subscribeWaktu(callback: () => void) {
  const id = setInterval(callback, 30_000);
  return () => clearInterval(id);
}

export function KontrolTokenLogin({
  tokenDibuka,
  mode,
  lewatBatasJam,
  jumlahToken,
  siap,
  modeSiap,
}: {
  /** Saklar induk Tahap 43: false = ditutup total kapan pun. */
  tokenDibuka: boolean;
  /** Mode pengelolaan Tahap 45. */
  mode: TokenLoginMode;
  /** Status jam WIB saat halaman dirender (untuk mode otomatis). */
  lewatBatasJam: boolean;
  jumlahToken: number;
  /** false = kolom Tahap 43 belum ada, saklar belum bisa dipakai. */
  siap: boolean;
  /** false = kolom Tahap 45 belum ada, mode belum bisa diganti. */
  modeSiap: boolean;
}) {
  const [stateSaklar, actionSaklar, pendingSaklar] = useActionState<
    HasilTokenLogin,
    FormData
  >(setTokenLoginDibuka, { message: null });

  const [stateMode, actionMode, pendingMode] = useActionState<
    HasilTokenLogin,
    FormData
  >(setTokenLoginMode, { message: null });

  const [stateHapus, actionHapus, pendingHapus] = useActionState<
    HasilTokenLogin,
    FormData
  >(hapusSemuaTokenKelas, { message: null });

  // Hitung ulang status jam di browser (server hanya mengirim nilai awal).
  const lewatJam = useSyncExternalStore(
    subscribeWaktu,
    () => jamWib() >= JAM_TUTUP_TOKEN_LOGIN,
    () => lewatBatasJam,
  );

  const manual = mode === "manual";

  // Status akhir (sama dengan rumus di server).
  const status = !siap
    ? { label: "Belum aktif", kelas: "bg-slate-50 text-slate-500 ring-slate-200" }
    : !tokenDibuka
      ? { label: "Ditutup guru", kelas: "bg-red-50 text-red-700 ring-red-200" }
      : manual
        ? {
            label: "Dibuka manual",
            kelas: "bg-emerald-50 text-emerald-700 ring-emerald-200",
          }
        : lewatJam
          ? {
              label: "Tutup otomatis",
              kelas: "bg-slate-100 text-slate-600 ring-slate-200",
            }
          : {
              label: "Dibuka otomatis",
              kelas: "bg-emerald-50 text-emerald-700 ring-emerald-200",
            };

  const labelSaklar = !tokenDibuka
    ? manual
      ? "Buka login token"
      : "Aktifkan login token"
    : manual
      ? "Tutup login token"
      : "Matikan login token";

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Login Token Siswa
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${status.kelas}`}
            >
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {!siap ? (
              <>
                {jumlahToken} token aktif. Jalankan schema.sql Tahap 43 supaya
                saklar login token bisa dipakai.
              </>
            ) : manual ? (
              <>
                {jumlahToken} token aktif. Mode manual: token terbuka selama
                saklar ON, tanpa batas jam. Login username & password tidak
                terpengaruh.
              </>
            ) : (
              <>
                {jumlahToken} token aktif. Mode otomatis: token dibuka sampai
                pukul {JAM_TUTUP_TOKEN_LOGIN}.00 WIB, lalu tertutup sendiri.
                Login username & password tidak terpengaruh.
              </>
            )}
          </p>
        </div>

        <form action={actionSaklar} className="shrink-0">
          <input
            type="hidden"
            name="dibuka"
            value={tokenDibuka ? "false" : "true"}
          />
          <button
            type="submit"
            disabled={pendingSaklar || !siap}
            onClick={(event) => {
              if (tokenDibuka) {
                const yakin = window.confirm(
                  "Matikan login token untuk semua kelas? Siswa masih bisa masuk lewat username & password.",
                );
                if (!yakin) event.preventDefault();
              }
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              tokenDibuka
                ? "bg-red-600 text-white hover:bg-red-500"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {pendingSaklar ? "Menyimpan..." : labelSaklar}
          </button>
        </form>
      </div>

      {/* Pilih mode: otomatis (jam 18.00) atau manual (guru yang atur). */}
      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <form action={actionMode} className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            Mode pengelolaan
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="submit"
              name="mode"
              value="otomatis"
              disabled={pendingMode || !modeSiap}
              onClick={(event) => {
                // Beralih ke otomatis setelah 18.00 langsung menutup token.
                if (manual && tokenDibuka && lewatJam) {
                  const yakin = window.confirm(
                    `Sekarang sudah lewat pukul ${JAM_TUTUP_TOKEN_LOGIN}.00 WIB. Beralih ke mode otomatis akan langsung menutup login token. Lanjutkan?`,
                  );
                  if (!yakin) event.preventDefault();
                }
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                !manual
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Otomatis
            </button>
            <button
              type="submit"
              name="mode"
              value="manual"
              disabled={pendingMode || !modeSiap}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                manual
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Manual
            </button>
          </div>
          {pendingMode ? (
            <span className="text-xs text-slate-400">Menyimpan...</span>
          ) : null}
        </form>

        <p className="text-[11px] leading-4 text-slate-500">
          {manual
            ? "Batas jam 18.00 tidak berlaku di mode manual."
            : `Buka sampai ${JAM_TUTUP_TOKEN_LOGIN}.00 WIB; tombol di atas tetap bisa mematikan kapan pun.`}
        </p>
      </div>

      {stateMode.message ? (
        <p
          className={`mt-2 text-xs ${
            stateMode.sukses ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {stateMode.message}
        </p>
      ) : null}

      {!siap ? (
        <div className="mt-3">
          <Notifikasi varian="peringatan">
            Jalankan <code className="font-mono">schema.sql</code> Tahap 43 di
            Supabase SQL Editor supaya saklar ini aktif. Sebelum itu login token
            tetap berjalan seperti biasa (dibatasi jam{" "}
            {JAM_TUTUP_TOKEN_LOGIN}.00 WIB).
          </Notifikasi>
        </div>
      ) : null}

      {!modeSiap ? (
        <div className="mt-3">
          <Notifikasi varian="peringatan">
            Jalankan <code className="font-mono">schema.sql</code> Tahap 45 di
            Supabase SQL Editor supaya mode Otomatis/Manual bisa diganti.
            Sebelum itu mode otomatis dipakai.
          </Notifikasi>
        </div>
      ) : null}

      {stateSaklar.message ? (
        <p
          className={`mt-3 text-xs ${
            stateSaklar.sukses ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {stateSaklar.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <form action={actionHapus} className="min-w-0">
          <input type="hidden" name="konfirmasi" value="hapus-semua" />
          <button
            type="submit"
            disabled={pendingHapus || jumlahToken === 0}
            onClick={(event) => {
              const yakin = window.confirm(
                `Hapus SEMUA token (${jumlahToken} kelas)? Siswa tidak bisa login lewat token sampai guru membuat token baru.`,
              );
              if (!yakin) event.preventDefault();
            }}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingHapus
              ? "Menghapus..."
              : `Hapus semua token (${jumlahToken})`}
          </button>
        </form>
        <p className="text-xs text-slate-500">
          Menghapus token tidak menghapus akun siswa.
        </p>
      </div>

      {stateHapus.message ? (
        <p
          className={`mt-2 text-xs ${
            stateHapus.sukses ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {stateHapus.message}
        </p>
      ) : null}
    </div>
  );
}
