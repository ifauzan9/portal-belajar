"use client";

import { useState } from "react";
import { GRUP_FILE, type GrupFile } from "@/lib/tugas";

// Checkbox kelompok jenis file yang boleh diunggah siswa.
// Nilai yang dicentang dikirim sebagai input bernama `file_diizinkan[]`
// (array ekstensi) supaya mudah dibaca di server action.
export function PilihFileDiizinkan({
  name = "file_diizinkan[]",
  awal = [],
}: {
  name?: string;
  awal?: string[];
}) {
  const [terpilih, setTerpilih] = useState<string[]>(() =>
    Array.from(new Set(awal.map((e) => e.toLowerCase()))),
  );

  const grupAktif = (grup: GrupFile) =>
    grup.ekstensi.every((ekstensi) => terpilih.includes(ekstensi));

  function ubah(grup: GrupFile, nyala: boolean) {
    setTerpilih((sekarang) =>
      nyala
        ? Array.from(new Set([...sekarang, ...grup.ekstensi]))
        : sekarang.filter((ekstensi) => !grup.ekstensi.includes(ekstensi)),
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {GRUP_FILE.map((grup) => {
          const aktif = grupAktif(grup);
          return (
            <label
              key={grup.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                aktif
                  ? "bg-emerald-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <input
                type="checkbox"
                checked={aktif}
                onChange={(e) => ubah(grup, e.target.checked)}
                className="rounded border-slate-300"
              />
              {grup.label}
            </label>
          );
        })}
      </div>

      {terpilih.map((ekstensi) => (
        <input
          key={ekstensi}
          type="hidden"
          name={name}
          value={ekstensi}
        />
      ))}

      <p className="mt-1 text-xs text-slate-400">
        Kosong = semua jenis file diizinkan (dalam batas aman).
      </p>
    </div>
  );
}
