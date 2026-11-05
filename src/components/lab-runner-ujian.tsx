"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { python } from "@codemirror/lang-python";
import { ambilMasukanUjiUlangan } from "@/app/siswa/actions";
import {
  ModalInputLab,
  type ModalInputState,
} from "@/components/modal-input-lab";
import { bacaInput } from "@/lib/input-lab";
import type { AnalisisBebas } from "@/lib/lab";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[240px] items-center justify-center rounded-lg bg-slate-900 text-sm text-slate-400">
      Memuat editor...
    </div>
  ),
});

// ============================================================================
// Editor kode untuk ulangan praktik.
//
// Berbeda dari LabRunner (latihan):
//   - Run hanya menampilkan output program / traceback.
//   - Tidak ada benar/salah, tidak ada bantuan materi.
//   - Tidak ada autosave. Kode hanya dikirim saat siswa menekan
//     "Selesai & Kirim".
//   - Run tidak dibatasi selama waktu masih ada.
// ============================================================================

export type HasilKode = {
  kode: string;
  keluaran: string;
  keluaranUji: string | null;
  galat: string | null;
  analisis: AnalisisBebas | null;
  stdin: string[];
  percobaan: number;
};

export type PeganganEditorKode = {
  /** Jalankan kode dengan input wajib (tanpa modal) untuk keperluan submit. */
  siapkanHasil: () => Promise<HasilKode | null>;
};

type Status = "siap" | "memuat" | "menjalankan";

const BATAS_JALAN_MS = 8000;
const BATAS_MUAT_MS = 90000;

function barisInput(teks: string): string[] {
  const baris = teks.replace(/\r\n/g, "\n").split("\n");
  while (baris.length > 0 && baris[baris.length - 1].trim() === "") baris.pop();
  return baris;
}

export const EditorKodeUjian = forwardRef<
  PeganganEditorKode,
  {
    examId: string;
    soalId: string;
    kodeAwal: string | null;
    /** Input wajib, satu baris per input(). */
    masukan: string;
    /** Timer habis atau sudah submit → editor dikunci. */
    nonaktif: boolean;
  }
>(function EditorKodeUjian(
  { examId, soalId, kodeAwal, masukan, nonaktif },
  ref,
) {
  const [kode, setKode] = useState(kodeAwal ?? "");
  const [status, setStatus] = useState<Status>("siap");
  const [keluaran, setKeluaran] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sudahJalan, setSudahJalan] = useState(false);
  const [percobaan, setPercobaan] = useState(0);
  const [modal, setModal] = useState<ModalInputState | null>(null);

  const pekerjaRef = useRef<Worker | null>(null);
  const hitungRef = useRef(0);
  const percobaanRef = useRef(0);
  const hasilRef = useRef<{ kode: string; hasil: HasilKode } | null>(null);

  const sibuk = status !== "siap" || modal !== null || nonaktif;

  function ambilPekerja() {
    if (!pekerjaRef.current) {
      pekerjaRef.current = new Worker("/lab-pyodide-worker.js", {
        type: "module",
      });
    }
    return pekerjaRef.current;
  }

  async function eksekusi(
    nilai: string[],
    prompt: string[],
    tampilkan: boolean,
  ): Promise<HasilKode | null> {
    const pekerja = ambilPekerja();
    const id = ++hitungRef.current;

    if (tampilkan) {
      setKeluaran("");
      setGalat(null);
      setSudahJalan(false);
    }
    setStatus("memuat");

    // Input uji diambil saat Run/submit, bukan saat halaman dimuat.
    let stdinUji: string[] | null = null;
    try {
      const uji = await ambilMasukanUjiUlangan(examId, soalId);
      if (uji?.masukan) stdinUji = barisInput(uji.masukan);
    } catch {
      // Kalau gagal dimuat, lanjut tanpa uji. Server menilai apa adanya.
      stdinUji = null;
    }

    return await new Promise<HasilKode | null>((resolve) => {
      let selesai = false;
      let timer = setTimeout(() => {
        if (selesai) return;
        selesai = true;
        setStatus("siap");
        const pesan =
          "Python masih disiapkan dan memakan waktu lama. Periksa koneksi internet, lalu tekan Run Python lagi.";
        if (tampilkan) setGalat(pesan);
        resolve(null);
      }, BATAS_MUAT_MS);

      function mulaiBatasJalan() {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (selesai) return;
          selesai = true;
          pekerja.terminate();
          pekerjaRef.current = null;
          setStatus("siap");
          const pesan = `Program berjalan terlalu lama (lebih dari ${
            BATAS_JALAN_MS / 1000
          } detik) dan dihentikan. Periksa kemungkinan perulangan tanpa henti.`;
          if (tampilkan) setGalat(pesan);
          resolve(null);
        }, BATAS_JALAN_MS);
      }

      pekerja.onmessage = (event) => {
        const data = event.data as {
          id: number;
          status?: string;
          stdout?: string;
          error?: string | null;
          stdinDipakai?: string[] | null;
          stdoutUji?: string | null;
          errorUji?: string | null;
          analisis?: AnalisisBebas | null;
        };
        if (!data || data.id !== id) return;

        if (data.status === "loading") {
          setStatus("memuat");
          return;
        }
        if (data.status === "running") {
          setStatus("menjalankan");
          if (!selesai) mulaiBatasJalan();
          return;
        }

        if (selesai) return;
        selesai = true;
        clearTimeout(timer);

        const nomor = percobaanRef.current + 1;
        percobaanRef.current = nomor;

        const hasil: HasilKode = {
          kode,
          keluaran: data.stdout ?? "",
          keluaranUji:
            typeof data.stdoutUji === "string" ? data.stdoutUji : null,
          galat: data.error
            ? data.error
            : data.errorUji
              ? `Saat diuji dengan input berbeda: ${data.errorUji}`
              : null,
          analisis: data.analisis ?? null,
          stdin: Array.isArray(data.stdinDipakai) ? data.stdinDipakai : [],
          percobaan: nomor,
        };

        hasilRef.current = { kode, hasil };
        setPercobaan(nomor);

        if (tampilkan) {
          setKeluaran(hasil.keluaran);
          setGalat(hasil.galat);
          setSudahJalan(true);
        }
        setStatus("siap");
        resolve(hasil);
      };

      pekerja.onerror = () => {
        if (selesai) return;
        selesai = true;
        clearTimeout(timer);
        setStatus("siap");
        const pesan =
          "Terjadi kesalahan pada mesin Python. Coba muat ulang halaman.";
        if (tampilkan) setGalat(pesan);
        resolve(null);
      };

      pekerja.postMessage({
        id,
        kode,
        stdin: nilai,
        stdinUji,
        prompt,
        analisis: true,
      });
    });
  }

  async function siapkanHasil(): Promise<HasilKode | null> {
    const cache = hasilRef.current;
    if (cache && cache.kode === kode) return cache.hasil;

    const rencana = bacaInput(kode);
    return eksekusi(
      barisInput(masukan),
      rencana.daftar.map((item) => item.pertanyaan),
      false,
    );
  }

  useImperativeHandle(ref, () => ({ siapkanHasil }));

  function jalankan() {
    if (sibuk) return;
    const rencana = bacaInput(kode);
    if (rencana.jumlah === 0) {
      void eksekusi([], [], true);
      return;
    }
    setModal({ rencana, saran: barisInput(masukan) });
  }

  const statusText =
    status === "memuat"
      ? "Menyiapkan Python pertama kali (unduh + kompilasi). Setelah sekali, run berikutnya instan."
      : status === "menjalankan"
        ? "Menjalankan program..."
        : null;

  return (
    <div className="space-y-3">
      {/* Nilai kode ikut terkirim kalau form disubmit (fallback bila run gagal). */}
      <input type="hidden" name={`kode_${soalId}`} value={kode} />

      <section className="overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Editor Python</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Run hanya menampilkan output program. Kode tidak disimpan
              otomatis.
            </p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
            Percobaan {percobaan}
          </span>
        </div>
        <CodeMirror
          value={kode}
          height="260px"
          theme="dark"
          extensions={[python()]}
          onChange={(nilai) => setKode(nilai)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: false,
          }}
          editable={!nonaktif}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={jalankan}
          disabled={sibuk}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status !== "siap"
            ? "Menjalankan..."
            : nonaktif
              ? "Waktu habis"
              : "▶ Run Python"}
        </button>
        <button
          type="button"
          onClick={() => {
            setKode(kodeAwal ?? "");
            setKeluaran("");
            setGalat(null);
            setSudahJalan(false);
            hasilRef.current = null;
          }}
          disabled={sibuk}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mulai ulang kode
        </button>
        {statusText ? (
          <p role="status" className="text-sm text-slate-500">
            {statusText}
          </p>
        ) : null}
      </div>

      {galat ? (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-900 ring-1 ring-red-200"
        >
          <p className="font-semibold">Program error</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-sm">
            {galat}
          </pre>
        </div>
      ) : null}

      {sudahJalan ? (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Output program</h3>
          <pre className="mt-3 min-h-[64px] overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-100">
            {keluaran || "(program belum menampilkan output)"}
          </pre>
        </section>
      ) : null}

      {modal ? (
        <ModalInputLab
          state={modal}
          onBatal={() => setModal(null)}
          onKirim={(nilai) => {
            const prompt = modal.rencana.daftar.map((item) => item.pertanyaan);
            setModal(null);
            void eksekusi(nilai, prompt, true);
          }}
        />
      ) : null}
    </div>
  );
});