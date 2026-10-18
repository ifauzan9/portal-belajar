"use client";

import { useActionState, useEffect, useState } from "react";
import {
  pindahKelasSiswa,
  type HasilPindahKelas,
} from "@/app/guru/siswa/actions";

type Kelas = { id: string; nama_kelas: string };

const AWAL: HasilPindahKelas = { message: null, sukses: false, info: null };

function namaKelasDari(daftar: Kelas[], id: string | null): string {
  if (!id) return "tanpa kelas";
  return daftar.find((kelas) => kelas.id === id)?.nama_kelas ?? "kelas lain";
}

// ============================================================================
// Tombol pindah kelas untuk satu siswa (dipakai di baris tabel & kartu).
// ============================================================================
export function PindahKelasSiswa({
  siswaId,
  namaSiswa,
  kelasId,
  kelasList,
}: {
  siswaId: string;
  namaSiswa: string;
  kelasId: string | null;
  kelasList: Kelas[];
}) {
  const [state, formAction, pending] = useActionState<HasilPindahKelas, FormData>(
    pindahKelasSiswa,
    AWAL,
  );

  const [terbuka, setTerbuka] = useState(false);
  const [pilihan, setPilihan] = useState(kelasId ?? "");

  // Tutup form otomatis beberapa saat setelah berhasil.
  useEffect(() => {
    if (!state.sukses) return;
    const timer = setTimeout(() => setTerbuka(false), 3000);
    return () => clearTimeout(timer);
  }, [state.sukses]);

  if (!terbuka) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            setPilihan(kelasId ?? "");
            setTerbuka(true);
          }}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Pindah kelas
        </button>
        {state.info ? (
          <p className="text-xs text-emerald-600">{state.info}</p>
        ) : null}
      </div>
    );
  }

  const berubah = pilihan !== (kelasId ?? "");

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const tujuan = namaKelasDari(kelasList, pilihan || null);
        const asal = namaKelasDari(kelasList, kelasId);
        if (
          !confirm(
            `Pindahkan ${namaSiswa} dari ${asal} ke ${tujuan}? Riwayat absensi ikut dipindah.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200 sm:flex-row sm:items-center"
    >
      <input type="hidden" name="ids" value={siswaId} />
      <select
        name="kelas_id"
        value={pilihan}
        onChange={(event) => setPilihan(event.target.value)}
        aria-label={`Kelas tujuan untuk ${namaSiswa}`}
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-40"
      >
        <option value="">Tanpa kelas</option>
        {kelasList.map((kelas) => (
          <option key={kelas.id} value={kelas.id}>
            {kelas.nama_kelas}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          disabled={pending || !berubah}
          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Memindah..." : "Pindah"}
        </button>
        <button
          type="button"
          onClick={() => setTerbuka(false)}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Batal
        </button>
      </div>

      {!berubah && !state.message ? (
        <p className="text-xs text-slate-500">Pilih kelas lain untuk memindah.</p>
      ) : null}
      {state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}

// ============================================================================
// Aksi massal: pindahkan semua siswa terpilih ke satu kelas.
// Dipakai di toolbar PilihanSiswa (halaman Data Siswa).
// ============================================================================
export function PindahKelasBanyak({
  ids,
  kelasList,
  kelasPerSiswa,
  onSukses,
}: {
  ids: string[];
  kelasList: Kelas[];
  // kelas_id siswa per id, untuk ringkasan konfirmasi.
  kelasPerSiswa: Record<string, string | null>;
  onSukses?: () => void;
}) {
  const [state, formAction, pending] = useActionState<HasilPindahKelas, FormData>(
    pindahKelasSiswa,
    AWAL,
  );

  const [pilihan, setPilihan] = useState("");

  useEffect(() => {
    if (!state.sukses) return;
    if (onSukses) onSukses();
    // onSukses sengaja tidak masuk dependency: hanya bereaksi ke hasil aksi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const jumlahBerubah = ids.filter(
    (id) => (kelasPerSiswa[id] ?? null) !== (pilihan || null),
  ).length;

  function konfirmasi(event: React.FormEvent<HTMLFormElement>) {
    const tujuan = namaKelasDari(kelasList, pilihan || null);
    const pesan =
      jumlahBerubah === 0
        ? `Semua ${ids.length} siswa terpilih sudah di ${tujuan}. Tetap simpan?`
        : `Pindahkan ${jumlahBerubah} siswa terpilih ke ${tujuan}? Riwayat absensi mereka ikut dipindah.`;
    if (!confirm(pesan)) event.preventDefault();
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        konfirmasi(event);
        if (!event.defaultPrevented) setPilihan("");
      }}
      className="flex flex-wrap items-center gap-2"
    >
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      <label htmlFor="pindah-kelas-tujuan" className="text-xs text-slate-300">
        Pindahkan ke
      </label>
      <select
        id="pindah-kelas-tujuan"
        name="kelas_id"
        value={pilihan}
        onChange={(event) => setPilihan(event.target.value)}
        className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white outline-none transition focus:border-emerald-400"
      >
        <option value="">Tanpa kelas</option>
        {kelasList.map((kelas) => (
          <option key={kelas.id} value={kelas.id}>
            {kelas.nama_kelas}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Memproses..." : "Pindahkan"}
      </button>

      {state.message ? (
        <span className="text-xs text-red-300">{state.message}</span>
      ) : null}
      {state.info ? (
        <span className="text-xs text-emerald-300">{state.info}</span>
      ) : null}
    </form>
  );
}
