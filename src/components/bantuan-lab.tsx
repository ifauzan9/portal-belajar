"use client";

import { useEffect, useState } from "react";

// Tombol bantuan yang menetap di kanan bawah halaman tantangan.
// Berisi penjelasan singkat + materi konsep + contoh pola (bukan jawaban).
//
// Aturan tampil:
// - "👀 Lihat Contoh" selalu bisa dibuka (menampilkan pola pengerjaan).
// - "💡 Lihat Petunjuk" baru muncul setelah siswa salah beberapa kali.
export function BantuanLab({
  penjelasan,
  materi,
  contoh,
  salahCount = 0,
  ambangPetunjuk = 5,
}: {
  penjelasan: string;
  materi: string | null;
  contoh: string | null;
  /** Berapa kali siswa sudah salah di level ini. */
  salahCount?: number;
  /** Tombol petunjuk muncul setelah salah sebanyak ini. */
  ambangPetunjuk?: number;
}) {
  const [buka, setBuka] = useState(false);
  const [lihatContoh, setLihatContoh] = useState(false);
  const [lihatPetunjuk, setLihatPetunjuk] = useState(false);

  const petunjukTersedia = salahCount >= ambangPetunjuk;

  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buka]);

  return (
    <>
      {buka ? (
        <div
          id="bantuan-lab-panel"
          role="region"
          aria-label="Bantuan tantangan"
          className="fixed right-4 bottom-20 z-40 flex max-h-[70vh] w-[min(92vw,26rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 sm:right-6 sm:bottom-24"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Bantuan</h2>
            <button
              type="button"
              onClick={() => setBuka(false)}
              aria-label="Tutup bantuan"
              className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-5 overflow-y-auto px-5 py-4">
            <section>
              <h3 className="text-sm font-semibold text-emerald-800">Penjelasan singkat</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {penjelasan}
              </p>
            </section>

            {/* Contoh pola pengerjaan — isinya berbeda dari target soal. */}
            {contoh ? (
              <section className="border-t border-slate-100 pt-4">
                {lihatContoh ? (
                  <>
                    <h3 className="text-sm font-semibold text-emerald-800">
                      Contoh pola (bukan jawaban)
                    </h3>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-100">
                      {contoh}
                    </pre>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLihatContoh(true)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <span aria-hidden="true">👀</span> Lihat Contoh
                  </button>
                )}
              </section>
            ) : null}

            {/* Petunjuk tambahan hanya muncul setelah beberapa kali salah. */}
            <section className="border-t border-slate-100 pt-4">
              {lihatPetunjuk ? (
                <>
                  <h3 className="text-sm font-semibold text-amber-700">
                    💡 Petunjuk tambahan
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {materi}
                  </p>
                </>
              ) : petunjukTersedia ? (
                <button
                  type="button"
                  onClick={() => setLihatPetunjuk(true)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                >
                  <span aria-hidden="true">💡</span> Lihat Petunjuk
                </button>
              ) : (
                <p className="text-xs leading-5 text-slate-400">
                  Butuh bantuan tambahan? Coba dulu beberapa kali. Tombol petunjuk
                  akan muncul setelah kamu mencoba {ambangPetunjuk} kali.
                </p>
              )}
            </section>
          </div>
        </div>
      ) : null}

      <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
        <button
          type="button"
          onClick={() => setBuka((v) => !v)}
          aria-expanded={buka}
          aria-controls="bantuan-lab-panel"
          className="flex min-h-12 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <span aria-hidden="true">💡</span>
          {buka ? "Tutup bantuan" : "Bantuan"}
        </button>
      </div>
    </>
  );
}