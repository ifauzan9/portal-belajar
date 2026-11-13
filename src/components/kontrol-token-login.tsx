"use client";

import { useActionState } from "react";
import {
  hapusSemuaTokenKelas,
  setTokenLoginDibuka,
  type HasilTokenLogin,
} from "@/app/guru/kelas/actions";
import { Notifikasi } from "@/components/ui/notifikasi";
import { JAM_TUTUP_TOKEN_LOGIN } from "@/lib/pengaturan-soal";

// ============================================================================
// Kontrol login token siswa (Tahap 43) di /guru/kelas.
//
//   1. Saklar induk buka/tutup login token (berlaku semua kelas).
//   2. Tombol hapus SEMUA token sekaligus.
//
// Token per kelas tetap dikelola lewat TokenKelasForm di bawahnya.
// ============================================================================

export function KontrolTokenLogin({
  tokenDibuka,
  jumlahToken,
  siap,
}: {
  tokenDibuka: boolean;
  jumlahToken: number;
  /** false = kolom Tahap 43 belum ada, saklar belum bisa dipakai. */
  siap: boolean;
}) {
  const [stateSaklar, actionSaklar, pendingSaklar] = useActionState<
    HasilTokenLogin,
    FormData
  >(setTokenLoginDibuka, { message: null });

  const [stateHapus, actionHapus, pendingHapus] = useActionState<
    HasilTokenLogin,
    FormData
  >(hapusSemuaTokenKelas, { message: null });

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Login Token Siswa
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                !siap
                  ? "bg-slate-50 text-slate-500 ring-slate-200"
                  : tokenDibuka
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-red-50 text-red-700 ring-red-200"
              }`}
            >
              {!siap ? "Belum aktif" : tokenDibuka ? "Dibuka" : "Ditutup guru"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {jumlahToken} token aktif. Login token otomatis ditutup pukul{" "}
            {JAM_TUTUP_TOKEN_LOGIN}.00 WIB setiap hari. Login username &
            password tidak terpengaruh.
          </p>
        </div>

        <form action={actionSaklar} className="shrink-0">
          <input type="hidden" name="dibuka" value={tokenDibuka ? "false" : "true"} />
          <button
            type="submit"
            disabled={pendingSaklar || !siap}
            onClick={(event) => {
              if (tokenDibuka) {
                const yakin = window.confirm(
                  "Tutup login token untuk semua kelas? Siswa masih bisa masuk lewat username & password.",
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
            {pendingSaklar
              ? "Menyimpan..."
              : tokenDibuka
                ? "Tutup login token"
                : "Buka login token"}
          </button>
        </form>
      </div>

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
