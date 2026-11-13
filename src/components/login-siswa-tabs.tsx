"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import {
  loginSiswa,
  loginSiswaToken,
  type HasilLogin,
} from "@/app/siswa/actions";
import { JAM_TUTUP_TOKEN_LOGIN } from "@/lib/pengaturan-soal";
import { jamWib } from "@/lib/waktu";
import { Notifikasi } from "@/components/ui/notifikasi";

type Kelas = { id: string; nama_kelas: string };
type Siswa = {
  id: string;
  nama_siswa: string;
  nis: string | null;
  kelas_id: string | null;
};

const KELAS_INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

// ---------------------------------------------------------------------------
// Pemantau batas jam token (Tahap 43).
//
// Server mengirim status awal, lalu browser menyegarkan diri tiap 30 detik
// supaya banner & form berubah sendiri begitu pukul 18.00 WIB lewat — tanpa
// reload. Pola useSyncExternalStore sama seperti komponen JamRealtime.
// ---------------------------------------------------------------------------

function subscribe(callback: () => void) {
  const id = setInterval(callback, 30_000);
  return () => clearInterval(id);
}

export function LoginSiswaTabs({
  kelasList,
  siswaList,
  tokenDibuka = true,
  lewatBatasJam = false,
  infoLogin = "",
  infoLoginAktif = false,
}: {
  kelasList: Kelas[];
  siswaList: Siswa[];
  /** Saklar induk guru (Tahap 43). */
  tokenDibuka?: boolean;
  /** Status saat halaman dirender server. */
  lewatBatasJam?: boolean;
  /** Informasi bebas dari guru (Tahap 44). */
  infoLogin?: string;
  infoLoginAktif?: boolean;
}) {
  const [tab, setTab] = useState<"password" | "token">("password");

  // Status jam dihitung ulang tiap 30 detik di browser. Sebelum mount (dan
  // saat hydration) dipakai nilai dari server agar markup cocok.
  const lewatJam = useSyncExternalStore(
    subscribe,
    () => jamWib() >= JAM_TUTUP_TOKEN_LOGIN,
    () => lewatBatasJam,
  );

  const infoToken = !tokenDibuka
    ? "Login dengan token sedang ditutup oleh guru."
    : lewatJam
      ? `Login token sudah ditutup (lewat pukul ${JAM_TUTUP_TOKEN_LOGIN}.00 WIB). Gunakan username & password.`
      : `Login dengan token hanya dibuka sampai pukul ${JAM_TUTUP_TOKEN_LOGIN}.00 WIB.`;

  const teksInfo = infoLoginAktif ? infoLogin.trim() : "";

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-semibold text-slate-900">Portal Siswa</h1>
      <p className="mt-1 text-sm text-slate-500">
        Masuk untuk mengakses tugas, ulangan, dan materi.
      </p>

      {/* Info batas waktu login token, selalu terlihat. */}
      <p
        className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ring-1 ${
          !tokenDibuka || lewatJam
            ? "bg-red-50 text-red-700 ring-red-200"
            : "bg-amber-50 text-amber-800 ring-amber-200"
        }`}
      >
        {infoToken}
      </p>

      {/* Informasi bebas dari guru (Tahap 44). Baris baru dipertahankan. */}
      {teksInfo ? (
        <Notifikasi varian="info" judul="Informasi" className="mt-3">
          <p className="whitespace-pre-line break-words">{teksInfo}</p>
        </Notifikasi>
      ) : null}

      {/* Tab pemilih metode login */}
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("password")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === "password"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Username & Password
        </button>
        <button
          type="button"
          onClick={() => setTab("token")}
          className={`relative rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === "token"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Kode Token
          {!tokenDibuka || lewatJam ? (
            <span className="ml-1.5 inline-block rounded-full bg-red-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-red-700">
              tutup
            </span>
          ) : null}
        </button>
      </div>

      {tab === "password" ? (
        <FormPassword />
      ) : (
        <FormToken
          kelasList={kelasList}
          siswaList={siswaList}
          tokenDibuka={tokenDibuka}
          lewatJam={lewatJam}
        />
      )}

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
  );
}

function FormPassword() {
  const [state, formAction, pending] = useActionState<HasilLogin, FormData>(
    loginSiswa,
    { message: null },
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
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
          className={KELAS_INPUT}
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
          className={KELAS_INPUT}
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
  );
}

function FormToken({
  kelasList,
  siswaList,
  tokenDibuka,
  lewatJam,
}: {
  kelasList: Kelas[];
  siswaList: Siswa[];
  tokenDibuka: boolean;
  lewatJam: boolean;
}) {
  const [state, formAction, pending] = useActionState<HasilLogin, FormData>(
    loginSiswaToken,
    { message: null },
  );

  const [kelasId, setKelasId] = useState("");

  const ditutupGuru = !tokenDibuka;
  const bolehIsi = !ditutupGuru && !lewatJam;

  // Daftar siswa disaring sesuai kelas yang dipilih (data sudah ada di
  // browser, tidak perlu request tambahan).
  const siswaSeKelas = kelasId
    ? siswaList.filter((s) => s.kelas_id === kelasId)
    : [];

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="kelas_id"
          className="block text-sm font-medium text-slate-700"
        >
          Kelas
        </label>
        <select
          id="kelas_id"
          name="kelas_id"
          required
          value={kelasId}
          onChange={(e) => setKelasId(e.target.value)}
          disabled={!bolehIsi}
          className={KELAS_INPUT}
        >
          <option value="">Pilih kelas</option>
          {kelasList.map((kelas) => (
            <option key={kelas.id} value={kelas.id}>
              {kelas.nama_kelas}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="siswa_id"
          className="block text-sm font-medium text-slate-700"
        >
          Nama
        </label>
        <select
          id="siswa_id"
          name="siswa_id"
          required
          disabled={!bolehIsi || !kelasId}
          defaultValue=""
          className={KELAS_INPUT}
        >
          <option value="">
            {kelasId ? "Pilih namamu" : "Pilih kelas dulu"}
          </option>
          {siswaSeKelas.map((siswa) => (
            <option key={siswa.id} value={siswa.id}>
              {siswa.nama_siswa}
              {siswa.nis ? ` (${siswa.nis})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="token"
          className="block text-sm font-medium text-slate-700"
        >
          Token Kelas
        </label>
        {/* Token kelas bukan pengganti akun: siswa tetap harus punya akun
            login yang aktif (dibuat guru). */}
        <input
          id="token"
          name="token"
          type="text"
          required
          autoComplete="off"
          placeholder="Dari gurumu"
          disabled={!bolehIsi}
          className={`${KELAS_INPUT} font-mono tracking-widest uppercase`}
        />
      </div>

      {state.message ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !bolehIsi}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Memproses..."
          : bolehIsi
            ? "Masuk dengan Token"
            : "Login Token Ditutup"}
      </button>
    </form>
  );
}
