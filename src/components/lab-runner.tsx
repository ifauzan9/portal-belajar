"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { python } from "@codemirror/lang-python";
import { Badge } from "@/components/ui/badge";
import { simpanHasilLab } from "@/app/siswa/lab/actions";
import type { AnalisisBebas } from "@/lib/lab";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[240px] items-center justify-center rounded-lg bg-slate-900 text-sm text-slate-400">
      Memuat editor...
    </div>
  ),
});

type Status = "siap" | "memuat" | "menjalankan" | "menilai";

const PESAN_BENAR = "Benar! Tantangan berikutnya sudah terbuka.";

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
  jenis,
  bantuan,
  wajibVariabel,
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
  jenis: string;
  bantuan: string | null;
  wajibVariabel: string[];
}) {
  const router = useRouter();
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
  const [pesan, setPesan] = useState<string | null>(null);

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

  async function simpan(
    keluaranBaru: string,
    analisis: AnalisisBebas | null,
    galatBaru: string | null,
  ) {
    // Tahan output sampai server/database selesai menilai.
    setStatus("menilai");
    try {
      const hasil = await simpanHasilLab({
        exerciseId,
        kode,
        keluaran: keluaranBaru,
        analisis,
      });

      setKeluaran(keluaranBaru);
      setSudahJalan(true);
      setGalat(galatBaru);

      if (hasil.sukses) {
        setPercobaan(hasil.percobaan);
        setPernahBenar(hasil.pernahBenar);
        setTersimpan(true);
        setBenar(hasil.benar);
        setPesan(hasil.benar ? PESAN_BENAR : hasil.petunjuk);
        if (hasil.benar) router.refresh();
      } else if (hasil.message) {
        setGalat(hasil.message);
      }
    } catch {
      setKeluaran(keluaranBaru);
      setSudahJalan(true);
      setGalat(galatBaru ?? "Gagal menghubungi server penilaian. Coba lagi.");
    } finally {
      setStatus("siap");
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
    setPesan(null);

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
        analisis?: AnalisisBebas | null;
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
      void simpan(keluaranBaru, data.analisis ?? null, data.error ?? null);
    };

    pekerja.onerror = () => {
      if (selesai) return;
      selesai = true;
      clearTimeout(timer);
      setStatus("siap");
      setGalat("Terjadi kesalahan pada mesin Python. Coba muat ulang halaman.");
    };

    pekerja.postMessage({
      id,
      kode,
      analisis: jenis === "bebas" || wajibVariabel.length > 0,
    });
  }

  function resetKode() {
    setKode(kodeAwal ?? "");
    setKeluaran("");
    setGalat(null);
    setBenar(null);
    setSudahJalan(false);
    setTersimpan(false);
    setPesan(null);
  }

  const statusText =
    status === "memuat"
      ? "Menyiapkan Python... (pertama kali agak lama)"
      : status === "menjalankan"
        ? "Menjalankan program..."
        : status === "menilai"
          ? "Memeriksa hasil ke server... sebentar."
          : null;

  const panelEditor = (tinggi: string) => (
    <section
      aria-labelledby="editor-python-heading"
      className="overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-800 shadow-sm"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div>
          <h2 id="editor-python-heading" className="text-sm font-semibold text-white">
            Editor Python
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">Tulis kode, lalu jalankan untuk memeriksa hasil.</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300">
          Percobaan {percobaan}
        </span>
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
    </section>
  );

  const panelTombol = (gelap: boolean) => (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={jalankan}
        disabled={sibuk}
        className="min-h-12 rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "menilai"
          ? "Memeriksa..."
          : sibuk
            ? "Menjalankan..."
            : "▶ Run Python"}
      </button>
      <button
        type="button"
        onClick={resetKode}
        disabled={sibuk}
        className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${
          gelap
            ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
        }`}
      >
        Mulai ulang kode
      </button>
      {!gelap ? (
        <button
          type="button"
          onClick={() => setFokus(true)}
          disabled={sibuk}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ⛶ Mode Fokus
        </button>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className={`flex w-full items-center gap-2 text-sm ${gelap ? "text-slate-300" : "text-slate-600"}`}
      >
        {sibuk ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        <span>
          {statusText ??
            (tersimpan
              ? "✓ Kode dan hasil tersimpan."
              : "Kode tersimpan saat kamu menjalankan program.")}
        </span>
      </p>
    </div>
  );

  const panelGalat = galat ? (
    <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-900 ring-1 ring-red-200">
      <p className="font-semibold">Program perlu diperiksa</p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-sm">{galat}</pre>
    </div>
  ) : null;

  const panelOutput = (gelap: boolean) =>
    sudahJalan ? (
      <section
        aria-labelledby="hasil-output-heading"
        className={`rounded-2xl p-4 ring-1 ${
          benar === true
            ? gelap
              ? "bg-emerald-950/40 ring-emerald-800"
              : "bg-emerald-50 ring-emerald-200"
            : gelap
              ? "bg-slate-900 ring-slate-700"
              : "bg-white ring-slate-200"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="hasil-output-heading"
            className={`text-base font-semibold ${gelap ? "text-slate-100" : "text-slate-900"}`}
          >
            Hasil program
          </h2>
          {benar === true ? (
            <Badge varian="sukses">✓ Benar</Badge>
          ) : benar === false ? (
            <Badge varian="peringatan">Belum tepat</Badge>
          ) : null}
        </div>
        <pre
          aria-live="polite"
          className={`mt-3 min-h-[64px] overflow-x-auto whitespace-pre-wrap rounded-xl p-4 font-mono text-sm leading-6 ${
            gelap ? "bg-slate-950 text-slate-100" : "bg-slate-900 text-slate-100"
          }`}
        >
          {keluaran || "(program belum menampilkan output)"}
        </pre>
      </section>
    ) : null;

  const panelPesan = pesan ? (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl p-4 text-base leading-6 ring-1 ${
        benar
          ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
          : "bg-amber-50 text-amber-900 ring-amber-200"
      }`}
    >
      <p className="font-semibold">{benar ? "✓ Berhasil" : "Petunjuk"}</p>
      <p className="mt-1">{pesan}</p>
    </div>
  ) : null;

  const panelStatus = (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
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
        <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-4 p-3 sm:gap-5 sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-emerald-300 uppercase">Ruang praktik Python</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-white sm:text-xl">
                Tantangan {levelNumber}: {judul}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {pernahBenar ? <Badge varian="sukses" titik>Sudah benar</Badge> : null}
              <button
                type="button"
                onClick={() => setFokus(false)}
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                ✕ Keluar fokus
              </button>
            </div>
          </header>

          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="order-2 flex flex-col gap-4 lg:order-1">
              {panelEditor("min(58vh, 620px)")}
              {panelTombol(true)}
              {panelGalat}
              {panelOutput(true)}
              {panelPesan}
            </div>

            <aside className="order-1 flex flex-col gap-3 lg:order-2">
              <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <p className="text-xs font-semibold tracking-wide text-emerald-300 uppercase">Tantangan {levelNumber}</p>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-100">{instruksi}</p>
              </section>

              {jenis !== "bebas" ? (
                <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                  <h3 className="text-sm font-semibold text-white">Target output</h3>
                  <p className="mt-1 text-xs text-slate-400">Lihat sebagai acuan, teks tidak dapat dipilih.</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-200 select-none">{keluaranDiharapkan}</pre>
                </section>
              ) : null}

              {bantuan ? (
                <details className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                    Bantuan materi: variabel dan print()
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{bantuan}</p>
                </details>
              ) : null}

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
      {panelPesan}
      {panelStatus}
    </div>
  );
}
