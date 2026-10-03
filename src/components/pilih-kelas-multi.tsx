"use client";

import { useState } from "react";

type Kelas = { id: string; nama_kelas: string };

// Combobox "pilih beberapa kelas". Panel berisi checkbox untuk tiap
// kelas + checkbox khusus "Semua kelas" (yang kalau dicentang akan
// mengunci/mengosongkan pilihan per kelas). Untuk banyak kelas,
// panelnya di-scroll (max-height), bukan memanjang tanpa batas.
export function PilihKelasMulti({
  daftarKelas,
  awalTerpilih = [],
  compact = false,
  name = "kelas[]",
}: {
  daftarKelas: Kelas[];
  awalTerpilih?: string[];
  // compact = dipakai di form ubah (baris sempit)
  compact?: boolean;
  // Nama field yang dikirim ke FormData (default `kelas[]`).
  name?: string;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const [terpilih, setTerpilih] = useState<string[]>(() =>
    Array.from(new Set(awalTerpilih)),
  );

  const semuaDipilih =
    daftarKelas.length > 0 && daftarKelas.every((k) => terpilih.includes(k.id));

  const tutupLalu = () => setTerbuka(false);

  // Checkbox "Semua kelas": kalau diaktifkan, tandai semua;
  // kalau dinonaktifkan dan memang semua tadinya terpilih, kosongkan.
  function klikSemua(centang: boolean) {
    if (centang) {
      setTerpilih(daftarKelas.map((k) => k.id));
    } else if (semuaDipilih) {
      setTerpilih([]);
    }
    // Tutup panel supaya pilihan langsung terlihat
    setTerbuka(false);
  }

  function klikSatu(idKelas: string, centang: boolean) {
    setTerpilih((sekarang) =>
      centang
        ? sekarang.includes(idKelas)
          ? sekarang
          : [...sekarang, idKelas]
        : sekarang.filter((id) => id !== idKelas),
    );
  }

  const namaTerpilih = daftarKelas
    .filter((k) => terpilih.includes(k.id))
    .map((k) => k.nama_kelas);

  const ringkas =
    namaTerpilih.length === 0
      ? "Semua kelas"
      : namaTerpilih.length <= 3
        ? namaTerpilih.join(", ")
        : `${namaTerpilih.slice(0, 3).join(", ")}, +${
            namaTerpilih.length - 3
          } kelas lagi`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setTerbuka((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
          compact ? "" : "sm:w-64"
        }`}
      >
        <span className={terpilih.length === 0 ? "text-slate-500" : ""}>
          {ringkas}
        </span>
        <span aria-hidden="true" className="text-xs text-slate-400">
          {terbuka ? "▴" : "▾"}
        </span>
      </button>

      {/* Input tersembunyi: semua kelas terpilih dikirim sebagai
          checkbox dengan nama `kelas[]` — agar formData.getAll
          bisa membacanya di server action. */}
      {terpilih.map((idKelas) => (
        <input key={idKelas} type="hidden" name={name} value={idKelas} />
      ))}

      {terbuka ? (
        <>
          {/* Tutup panel kalau klik di luar */}
          <div className="fixed inset-0 z-10" onClick={tutupLalu} />

          <div className="absolute left-0 z-20 mt-1 w-full min-w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:min-w-72">
            <label className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={semuaDipilih}
                onChange={(e) => klikSemua(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="font-medium">Semua kelas</span>
            </label>

            <div
              className={`mt-2 grid gap-1.5 overflow-y-auto ${
                compact ? "max-h-40" : "max-h-52"
              } grid-cols-2 sm:grid-cols-3`}
            >
              {daftarKelas.map((kelas) => (
                <label
                  key={kelas.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                    terpilih.includes(kelas.id)
                      ? "bg-emerald-600 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    name={name}
                    value={kelas.id}
                    checked={terpilih.includes(kelas.id)}
                    onChange={(e) => klikSatu(kelas.id, e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  {kelas.nama_kelas}
                </label>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => setTerpilih([])}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
              >
                Hapus pilihan
              </button>
              <button
                type="button"
                onClick={tutupLalu}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Terapkan
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
