"use client";

import { useEffect, useRef, useState } from "react";
import type { RencanaInput } from "@/lib/input-lab";

// ============================================================================
// Modal input interaktif untuk Lab Coding.
//
// Ditampilkan satu per satu mengikuti urutan input() di kode siswa. Setelah
// semua terisi, program dijalankan oleh Pyodide memakai data tersebut.
//
// Catatan: Pyodide berjalan di worker dan tidak bisa berhenti menunggu
// ketikan (SharedArrayBuffer tidak tersedia di browser lab), jadi modal
// selesai lebih dulu, lalu output program muncul. Urutan pertanyaan tetap
// sama dengan urutan input().
// ============================================================================

export type ModalInputState = {
  rencana: RencanaInput;
  /** Jawaban yang wajib diketik, satu baris per input(). */
  saran: string[];
};

export function ModalInputLab({
  state,
  onKirim,
  onBatal,
}: {
  state: ModalInputState;
  onKirim: (nilai: string[]) => void;
  onBatal: () => void;
}) {
  const { rencana, saran } = state;
  // Kotak mulai KOSONG. Jawaban yang diminta hanya ditampilkan sebagai
  // arahan, supaya siswa benar-benar mengetik sendiri.
  const [jawaban, setJawaban] = useState<string[]>(() =>
    rencana.daftar.map(() => ""),
  );
  const [aktif, setAktif] = useState(0);
  const [modeSemua, setModeSemua] = useState(!rencana.pasti);
  const kotakRef = useRef<HTMLInputElement>(null);

  const total = Math.max(rencana.daftar.length, 1);
  const arahanAktif = (saran[aktif] ?? "").trim();

  useEffect(() => {
    if (modeSemua) return;
    const kotak = kotakRef.current;
    if (!kotak) return;
    kotak.focus();
    kotak.select();
  }, [aktif, modeSemua]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBatal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBatal]);

  const pertanyaanAktif = rencana.daftar[aktif]?.pertanyaan?.trim();
  const sudahDiisi = (jawaban[aktif] ?? "").trim().length > 0;

  function kirimSatu() {
    // Kotak kosong tidak dikirim; siswa diberi tahu apa yang harus diisi.
    if (!sudahDiisi) return;
    if (aktif + 1 < total) {
      setAktif(aktif + 1);
      return;
    }
    onKirim(jawaban.map((nilai) => nilai ?? ""));
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-input-judul"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h2
            id="modal-input-judul"
            className="flex items-center gap-2 text-sm font-semibold text-slate-900"
          >
            <span aria-hidden="true" className="font-mono text-emerald-700">
              ⌨
            </span>
            Program meminta input
          </h2>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            {modeSemua ? `${total} input` : `${aktif + 1} dari ${total}`}
          </span>
        </div>

        <div className="px-5 py-4">
          {!modeSemua ? (
            <>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Input ke-{aktif + 1}
              </p>
              <p className="mt-1 min-h-6 text-base leading-7 font-medium whitespace-pre-wrap text-slate-900">
                {pertanyaanAktif && pertanyaanAktif.length > 0
                  ? pertanyaanAktif
                  : `Masukkan data ke-${aktif + 1}:`}
              </p>

              {arahanAktif ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                  <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase">
                    Yang harus diketik
                  </p>
                  <code className="mt-1 block font-mono text-base font-semibold break-words text-emerald-900">
                    {arahanAktif}
                  </code>
                  <p className="mt-1 text-xs leading-5 text-emerald-800/80">
                    Ketik persis seperti itu, termasuk huruf besar/kecil dan
                    spasinya.
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-5 text-slate-600">
                  Isi teks yang diminta program di kotak di bawah ini.
                </p>
              )}

              <label htmlFor="jawaban-input" className="sr-only">
                Jawaban untuk input ke-{aktif + 1}
              </label>
              <input
                id="jawaban-input"
                ref={kotakRef}
                value={jawaban[aktif] ?? ""}
                onChange={(e) =>
                  setJawaban((lama) => {
                    const baru = [...lama];
                    baru[aktif] = e.target.value;
                    return baru;
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    kirimSatu();
                  }
                }}
                placeholder={
                  arahanAktif ? "Ketik jawabanmu di sini…" : "Tulis jawaban…"
                }
                autoComplete="off"
                spellCheck={false}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Tekan{" "}
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                  Enter
                </kbd>{" "}
                untuk mengirim.
                {!sudahDiisi ? (
                  <span className="font-medium text-amber-700">
                    {" "}
                    Isi dulu jawabannya.
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-slate-700">
                Program ini meminta <strong>{total} input</strong>. Tulis satu
                jawaban per baris, sesuai urutan permintaan program.
              </p>
              {rencana.catatan ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 ring-1 ring-amber-200">
                  {rencana.catatan}
                </p>
              ) : null}
              {saran.length > 0 && saran.some((isi) => isi.trim() !== "") ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                  <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase">
                    Yang harus diketik
                  </p>
                  <ol className="mt-1 space-y-0.5">
                    {saran.map((isi, urutan) =>
                      isi.trim() === "" ? null : (
                        <li
                          key={urutan}
                          className="flex gap-2 font-mono text-sm leading-6 text-emerald-900"
                        >
                          <span className="w-4 shrink-0 text-right text-emerald-700/60">
                            {urutan + 1}
                          </span>
                          <span className="break-words">{isi}</span>
                        </li>
                      ),
                    )}
                  </ol>
                </div>
              ) : null}
              <label htmlFor="jawaban-semua" className="sr-only">
                Semua jawaban input, satu per baris
              </label>
              <textarea
                id="jawaban-semua"
                value={jawaban.join("\n")}
                onChange={(e) =>
                  setJawaban(e.target.value.replace(/\r\n/g, "\n").split("\n"))
                }
                placeholder="Satu jawaban per baris…"
                rows={Math.min(Math.max(total, 3), 10)}
                spellCheck={false}
                className="mt-3 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="button"
                onClick={() => setModeSemua(false)}
                className="mt-2 text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
              >
                Isi satu per satu
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onBatal}
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Batal
          </button>
          <div className="flex items-center gap-2">
            {!modeSemua && aktif > 0 ? (
              <button
                type="button"
                onClick={() => setAktif(aktif - 1)}
                className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                ← Sebelumnya
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (modeSemua) onKirim(jawaban.map((nilai) => nilai ?? ""));
                else kirimSatu();
              }}
              disabled={
                modeSemua
                  ? !jawaban.some((nilai) => (nilai ?? "").trim() !== "")
                  : !sudahDiisi
              }
              className="min-h-10 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {modeSemua
                ? "Jalankan program"
                : aktif + 1 < total
                  ? "Kirim"
                  : "Kirim & jalankan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
