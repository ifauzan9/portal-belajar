"use client";

import { useActionState, useState } from "react";
import {
  gantiPasswordProfil,
  type HasilGantiPasswordProfil,
} from "@/app/siswa/profil/actions";
import { Notifikasi } from "@/components/ui/notifikasi";

// ============================================================================
// Form ganti password di halaman profil siswa.
//
// Aturan keamanan yang dijaga di sini:
//  - TIDAK ada password lama yang diminta/ditampilkan.
//  - TIDAK ada password tersimpan (tidak ada defaultValue, tidak localStorage).
//  - Setelah submit, nilai isian langsung dikosongkan.
//  - Password asli tidak pernah dikirim balik oleh server.
// ============================================================================

const GAYA_INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function FormGantiPassword({
  username,
  sisaKuota,
  maksKuota,
  statusKuota = "siap",
}: {
  username: string;
  sisaKuota: number;
  maksKuota: number;
  // "skema" = kolom Tahap 31 belum ada → form dinonaktifkan.
  // "galat" = kuota gagal dibaca sementara → form tetap aktif, tapi angka
  //           sisa TIDAK ditampilkan supaya tidak menyesatkan.
  statusKuota?: "siap" | "skema" | "galat";
}) {
  const [state, formAction, pending] = useActionState<
    HasilGantiPasswordProfil,
    FormData
  >(gantiPasswordProfil, {
    message: null,
    sukses: false,
    sisaKuota,
    maksKuota,
  });

  const [lihat, setLihat] = useState(false);
  const skemaBelumAda = statusKuota === "skema";
  const habis = statusKuota === "siap" && state.sisaKuota <= 0;
  const terkunci = habis || skemaBelumAda;

  let labelKuota = `${state.sisaKuota} dari ${state.maksKuota}`;
  if (skemaBelumAda) {
    labelKuota = "belum aktif";
  } else if (statusKuota === "galat") {
    labelKuota = "tidak bisa dibaca";
  }

  return (
    <form action={formAction} className="mt-4 space-y-4" autoComplete="off">
      {/* Username tersembunyi: membantu pengelola password browser mengaitkan
          formulir ini dengan akun yang benar. Bukan password, bukan rahasia. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        defaultValue={username}
        readOnly
        hidden
      />

      {/* Peringatan wajib dibaca sebelum mengganti password. */}
      <Notifikasi varian="peringatan" judul="Catat password barumu sebelum menyimpan">
        Password disimpan dalam bentuk terenkripsi dan{" "}
        <strong>tidak bisa dilihat lagi</strong> — termasuk oleh guru. Pastikan
        kamu mengingat atau mencatatnya di tempat aman.
      </Notifikasi>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
        <p className="text-xs text-slate-600">
          Kuota ganti password hari ini:{" "}
          <strong className="font-semibold text-slate-900">{labelKuota}</strong>
        </p>
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${
            terkunci ? "bg-red-500" : "bg-emerald-500"
          }`}
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
          type={lihat ? "text" : "password"}
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Minimal 6 karakter"
          disabled={terkunci}
          className={GAYA_INPUT}
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
          type={lihat ? "text" : "password"}
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Ketik ulang password baru"
          disabled={terkunci}
          className={GAYA_INPUT}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Catat sekarang — setelah disimpan, password tidak bisa ditampilkan
          lagi. Kalau lupa, minta guru untuk mereset.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={lihat}
          onChange={(e) => setLihat(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
        />
        Tampilkan isian saat mengetik
      </label>

      {state.sukses ? (
        <Notifikasi varian="sukses" judul="Password berhasil diganti">
          Simpan password barumu sekarang — password tidak bisa ditampilkan
          ulang. Sisa kuota hari ini: {state.sisaKuota} dari {state.maksKuota}.
        </Notifikasi>
      ) : null}

      {habis && !state.message ? (
        <Notifikasi varian="peringatan" judul="Kuota hari ini habis">
          Kamu sudah mengganti password 3 kali hari ini. Coba lagi besok, atau
          minta guru untuk mereset passwordmu.
        </Notifikasi>
      ) : null}

      {state.message && !state.sukses ? (
        <Notifikasi varian={terkunci ? "peringatan" : "gagal"}>
          {state.message}
        </Notifikasi>
      ) : null}

      <button
        type="submit"
        disabled={pending || terkunci}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Menyimpan..."
          : skemaBelumAda
            ? "Belum aktif"
            : habis
              ? "Kuota habis"
              : "Simpan Password Baru"}
      </button>
    </form>
  );
}
