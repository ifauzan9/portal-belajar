"use client";

import { useEffect, useState, useTransition } from "react";
import { simpanTampilan } from "@/app/siswa/profil/preferensi-actions";
import {
  PREFERENSI_BAWAAN,
  type PreferensiTersimpan,
  type Tema,
  type UkuranTeks,
} from "@/lib/preferensi-siswa";

// ============================================================================
// Pemilih preferensi tampilan siswa.
//
// Alur simpan:
//  1. Klik pilihan → hitung tema efektif (kalau "sistem", tanya media query).
//  2. Pasang atribut di #area-siswa supaya perubahan langsung terlihat.
//  3. Kirim ke Server Action → cookie diperbarui → refresh ringan agar
//     render server berikutnya memakai nilai yang sama.
//
// Tidak ada password atau data pribadi yang disimpan di sini.
// ============================================================================

const PILIHAN_TEMA: { nilai: Tema; label: string; keterangan: string }[] = [
  { nilai: "terang", label: "Terang", keterangan: "Latar putih" },
  { nilai: "gelap", label: "Gelap", keterangan: "Nyaman di malam hari" },
  {
    nilai: "sistem",
    label: "Ikut Sistem",
    keterangan: "Menyesuaikan perangkat",
  },
];

const PILIHAN_UKURAN: { nilai: UkuranTeks; label: string }[] = [
  { nilai: "normal", label: "Normal" },
  { nilai: "besar", label: "Besar" },
];

function temaEfektif(tema: Tema): "terang" | "gelap" {
  if (tema !== "sistem") return tema;
  if (typeof window === "undefined") return "terang";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "gelap"
    : "terang";
}

function terapkanKeArea(nilai: PreferensiTersimpan) {
  const area = document.getElementById("area-siswa");
  if (!area) return;
  area.dataset.tema = nilai.efektif;
  area.dataset.ukuran = nilai.ukuran;
}

export function PreferensiTampilan({
  awal,
}: {
  awal: PreferensiTersimpan;
}) {
  const [nilai, setNilai] = useState<PreferensiTersimpan>(
    awal ?? PREFERENSI_BAWAAN,
  );
  const [tersimpan, setTersimpan] = useState(false);
  const [pending, mulai] = useTransition();

  // Ikuti perubahan tema perangkat selama pilihan "sistem" aktif.
  useEffect(() => {
    if (nilai.tema !== "sistem") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const saatBerubah = () => {
      const efektif: "terang" | "gelap" = media.matches ? "gelap" : "terang";
      setNilai((lama) => {
        const baru: PreferensiTersimpan = { ...lama, efektif };
        terapkanKeArea(baru);
        // Simpan juga ke server supaya konsisten setelah refresh.
        mulai(async () => {
          await simpanTampilan(baru);
        });
        return baru;
      });
    };

    media.addEventListener("change", saatBerubah);
    return () => media.removeEventListener("change", saatBerubah);
  }, [nilai.tema]);

  function ubah(perubahan: Partial<Pick<PreferensiTersimpan, "tema" | "ukuran">>) {
    const temaBaru = perubahan.tema ?? nilai.tema;
    const baru: PreferensiTersimpan = {
      tema: temaBaru,
      ukuran: perubahan.ukuran ?? nilai.ukuran,
      efektif: temaEfektif(temaBaru),
    };

    setNilai(baru);
    terapkanKeArea(baru);

    setTersimpan(true);
    window.setTimeout(() => setTersimpan(false), 1600);

    mulai(async () => {
      await simpanTampilan(baru);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Tema</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Berlaku hanya di halaman siswa.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {PILIHAN_TEMA.map((pilihan) => {
            const aktif = nilai.tema === pilihan.nilai;
            return (
              <button
                key={pilihan.nilai}
                type="button"
                aria-pressed={aktif}
                onClick={() => ubah({ tema: pilihan.nilai })}
                className={`pilihan-tampilan rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  aktif
                    ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">
                  {pilihan.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {pilihan.keterangan}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700">Ukuran teks</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Pilih yang paling nyaman dibaca.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PILIHAN_UKURAN.map((pilihan) => {
            const aktif = nilai.ukuran === pilihan.nilai;
            return (
              <button
                key={pilihan.nilai}
                type="button"
                aria-pressed={aktif}
                onClick={() => ubah({ ukuran: pilihan.nilai })}
                className={`pilihan-tampilan inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  aktif
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {pilihan.label}
              </button>
            );
          })}
        </div>
      </div>

      <p
        aria-live="polite"
        className={`text-xs transition-opacity ${
          tersimpan || pending
            ? "text-emerald-700 opacity-100"
            : "opacity-0"
        }`}
      >
        {pending ? "Menyimpan..." : "Preferensi disimpan di perangkat ini."}
      </p>
    </div>
  );
}
