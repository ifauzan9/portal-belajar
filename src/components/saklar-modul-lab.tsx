"use client";

import { toggleModulLab } from "@/app/guru/lab/actions";

// ============================================================================
// Tombol tutup/buka akses satu modul Lab Coding (Tahap 42).
//
// Konfirmasi hanya muncul saat MENUTUP modul, supaya guru sadar siswanya
// langsung tidak bisa membuka modul tersebut.
// ============================================================================

export function SaklarModulLab({
  lessonId,
  judul,
  dibuka,
  siap,
}: {
  lessonId: string;
  judul: string;
  dibuka: boolean;
  siap: boolean;
}) {
  return (
    <form action={toggleModulLab}>
      <input type="hidden" name="lesson_id" value={lessonId} />
      <button
        type="submit"
        disabled={!siap}
        onClick={(event) => {
          if (!dibuka) return;
          const yakin = window.confirm(
            `Tutup modul "${judul}" untuk siswa? Siswa tidak bisa membuka modul maupun levelnya, tetapi progres yang sudah tersimpan tetap aman.`,
          );
          if (!yakin) event.preventDefault();
        }}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          dibuka
            ? "bg-red-600 text-white hover:bg-red-500"
            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
        }`}
      >
        {dibuka ? "Tutup modul" : "Buka modul"}
      </button>
    </form>
  );
}
