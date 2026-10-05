"use client";

import { useEffect, useState } from "react";

// Tombol bantuan yang menetap di kanan bawah halaman tantangan.
// Berisi penjelasan singkat + materi konsep, tanpa kode jawaban.
export function BantuanLab({
  penjelasan,
  materi,
  contoh,
}: {
  penjelasan: string;
  materi: string | null;
  contoh: string | null;
}) {
  const [buka, setBuka] = useState(false);

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
              {contoh ? (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-100">
                  {contoh}
                </pre>
              ) : null}
            </section>

            {materi ? (
              <section className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-emerald-800">Materi: variabel dan print()</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {materi}
                </p>
              </section>
            ) : null}
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
