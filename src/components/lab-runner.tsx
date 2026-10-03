"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { python } from "@codemirror/lang-python";
import { Badge } from "@/components/ui/badge";
import { simpanHasilLab } from "@/app/siswa/lab/actions";
import { keluaranCocok } from "@/lib/lab";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[240px] items-center justify-center rounded-lg bg-slate-900 text-sm text-slate-400">
      Memuat editor...
    </div>
  ),
});

type Status = "siap" | "memuat" | "menjalankan";

export function LabRunner({
  exerciseId,
  kodeAwal,
  keluaranDiharapkan,
  kodeTersimpan,
  percobaanAwal,
  pernahBenarAwal,
  judul,
  levelNumber,
  instruksi,
}: {
  exerciseId: string;
  kodeAwal: string | null;
  keluaranDiharapkan: string;
  kodeTersimpan: string | null;
  percobaanAwal: number;
  pernahBenarAwal: boolean;
  judul: string;
  levelNumber: number;
  instruksi: string;
}) {
  const [kode, setKode] = useState(kodeTersimpan ?? kodeAwal ?? "");
  const [status, setStatus] = useState<Status>("siap");
  const [keluaran, setKeluaran] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [benar, setBenar] = useState<boolean | null>(null);
  const [pernahBenar, setPernahBenar] = useState(pernahBenarAwal);
  const [percobaan, setPercobaan] = useState(percobaanAwal);
  const [tersimpan, setTersimpan] = useState(false);
  const [sudahJalan, setSudahJalan] = useState(false);
  const [fokus, setFokus] = useState(false);

  const pekerjaRef = useRef<Worker | null>(null);
  const hitungRef = useRef(0);
  const sibuk = status !== "siap";

  // Mode fokus: kunci scroll halaman & keluar dengan Esc.
  useEffect(() => {
    if (!fokus) return;
    const htmlSebelumnya = document.documentElement.style.overflow;
    const bodySebelumnya = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFokus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = htmlSebelumnya;
      document.body.style.overflow = bodySebelumnya;
      window.removeEventListener("keydown", onKey);
    };
  }, [fokus]);

  function ambilPekerja() {
    if (!pekerjaRef.current) {
      pekerjaRef.current = new Worker("/lab-pyodide-worker.js", {
        type: "module",
      });
    }
    return pekerjaRef.current;
  }

  async function simpan(keluaranBaru: string, benarBaru: boolean) {
    const hasil = await simpanHasilLab({
      exerciseId,
      kode,
      keluaran: keluaranBaru,
      benar: benarBaru,
    });
    if (hasil.sukses) {
      setPercobaan(hasil.percobaan);
      setPernahBenar(hasil.pernahBenar);
      setTersimpan(true);
    } else if (hasil.message) {
      setGalat(hasil.message);
    }
  }

  function jalankan() {
    const pekerja = ambilPekerja();
    const id = ++hitungRef.current;

    setStatus("memuat");
    setKeluaran("");
    setGalat(null);
    setTersimpan(false);
    setSudahJalan(false);
    setBenar(null);

    let selesai = false;

    const timer = setTimeout(() => {
      if (selesai) return;
      selesai = true;
      pekerja.terminate();
      pekerjaRef.current = null;
      setStatus("siap");
      setGalat(
        "Program berjalan terlalu lama (lebih dari 8 detik) dan dihentikan. Periksa kemungkinan perulangan tanpa henti.",
      );
    }, 8000);

    pekerja.onmessage = (event) => {
      const data = event.data as {
        id: number;
        status?: string;
        stdout?: string;
        stderr?: string;
        error?: string | null;
      };
      if (!data || data.id !== id) return;

      if (data.status === "loading") {
        setStatus("memuat");
        return;
      }
      if (data.status === "running") {
        setStatus("menjalankan");
        return;
      }

      if (selesai) return;
      selesai = true;
      clearTimeout(timer);

      const keluaranBaru = data.stdout ?? "";
      setKeluaran(keluaranBaru);
      setSudahJalan(true);
      setStatus("siap");

      if (data.error) {
        setGalat(data.error);
        setBenar(false);
        void simpan(keluaranBaru, false);
        return;
      }

      const cocok = keluaranCocok(keluaranBaru, keluaranDiharapkan);
      setBenar(cocok);
      void simpan(keluaranBaru, cocok);
    };

    pekerja.onerror = () => {
      if (selesai) return;
      selesai = true;
      clearTimeout(timer);
      setStatus("siap");
      setGalat("Terjadi kesalahan pada mesin Python. Coba muat ulang halaman.");
    };

    pekerja.postMessage({ id, kode });
  }

  function resetKode() {
    setKode(kodeAwal ?? "");
    setKeluaran("");
    setGalat(null);
    setBenar(null);
    setSudahJalan(false);
    setTersimpan(false);
  }

  const statusText =
    status === "memuat"
      ? "Menyiapkan Python... (pertama kali agak lama)"
      : status === "menjalankan"
        ? "Menjalankan program..."
        : null;

  const panelEditor = (tinggi: string) => (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2">
        <span className="text-xs font-medium text-slate-300">Editor Python</span>
        <span className="text-xs text-slate-500">Percobaan: {percobaan}</span>
      </div>
      <CodeMirror
        value={kode}
        height={tinggi}
        theme="dark"
        extensions={[python()]}
        onChange={(nilai) => setKode(nilai)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          autocompletion: false,
        }}
      />
    </div>
  );

  const panelTombol = (gelap: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={jalankan}
        disabled={sibuk}
        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sibuk ? "Menjalankan..." : "▶ Jalankan"}
      </button>
      <button
        type="button"
        onClick={resetKode}
        disabled={sibuk}
        className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
          gelap
            ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
        }`}
      >
        Reset ke kode awal
      </button>
      {!gelap ? (
        <button
          type="button"
          onClick={() => setFokus(true)}
          disabled={sibuk}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ⛶ Mode Fokus
        </button>
      ) : null}

      {statusText ? (
        <span
          className={`text-xs ${gelap ? "text-slate-400" : "text-slate-500"}`}
        >
          {statusText}
        </span>
      ) : null}
      {!statusText && tersimpan ? (
        <span className="text-xs font-medium text-emerald-500">
          ✓ Hasil tersimpan otomatis
        </span>
      ) : null}
    </div>
  );

  const panelGalat = galat ? (
    <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
      <p className="font-semibold">Terjadi kesalahan</p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{galat}</pre>
    </div>
  ) : null;

  const panelOutput = (gelap: boolean) =>
    sudahJalan ? (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
          <p className="mb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
            Output kamu
          </p>
          <pre className="min-h-[60px] overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-100">
            {keluaran || "(tidak ada output)"}
          </pre>
        </div>
        <div
          className={`rounded-xl p-3 ring-1 ${
            benar
              ? gelap
                ? "bg-emerald-950/50 ring-emerald-800"
                : "bg-emerald-50 ring-emerald-200"
              : gelap
                ? "bg-amber-950/50 ring-amber-800"
                : "bg-amber-50 ring-amber-200"
          }`}
        >
          <p
            className={`mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase ${
              gelap ? "text-slate-300" : "text-slate-500"
            }`}
          >
            Output diharapkan
            {benar === true ? (
              <Badge varian="sukses">Cocok</Badge>
            ) : benar === false ? (
              <Badge varian="bahaya">Belum cocok</Badge>
            ) : null}
          </p>
          <pre
            className={`min-h-[60px] overflow-x-auto whitespace-pre-wrap font-mono text-xs ${
              gelap ? "text-slate-200" : "text-slate-700"
            }`}
          >
            {keluaranDiharapkan}
          </pre>
        </div>
      </div>
    ) : null;

  const panelStatus = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      {pernahBenar ? (
        <Badge varian="sukses" titik>
          Sudah pernah berhasil
        </Badge>
      ) : (
        <Badge varian="netral">Belum berhasil</Badge>
      )}
    </div>
  );

  // ---------------- Mode fokus (layar penuh + gelap) ----------------
  if (fokus) {
    return createPortal(
      <div className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-4 p-4 sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium tracking-wide text-slate-300 uppercase">
                Mode Fokus
              </span>
              <h2 className="truncate text-lg font-semibold text-white">
                Level {levelNumber} — {judul}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {pernahBenar ? (
                <Badge varian="sukses" titik>
                  Sudah pernah berhasil
                </Badge>
              ) : null}
              <button
                type="button"
                onClick={() => setFokus(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
              >
                ✕ Keluar Fokus (Esc)
              </button>
            </div>
          </header>

          <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-3">
              {panelEditor("58vh")}
              {panelTombol(true)}
              {panelGalat}
              {panelOutput(true)}
            </div>

            <aside className="flex flex-col gap-3">
              <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  🎯 Tantangan
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-slate-200">
                  {instruksi}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Output diharapkan
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                  {keluaranDiharapkan}
                </pre>
              </div>

              {panelStatus}
            </aside>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ---------------- Tampilan biasa ----------------
  return (
    <div className="space-y-4">
      {panelEditor("240px")}
      {panelTombol(false)}
      {panelGalat}
      {panelOutput(false)}
      {panelStatus}
    </div>
  );
}
