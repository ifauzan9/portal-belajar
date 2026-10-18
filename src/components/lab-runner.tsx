"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { python } from "@codemirror/lang-python";
import { Badge } from "@/components/ui/badge";
import { ambilMasukanUji, simpanHasilLab } from "@/app/siswa/lab/actions";
import { BantuanLab } from "@/components/bantuan-lab";
import { ModalInputLab, type ModalInputState } from "@/components/modal-input-lab";
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

type Status = "siap" | "memuat" | "menjalankan" | "menilai";

const PESAN_BENAR = "Benar! Tantangan berikutnya sudah terbuka.";

// Input wajib disimpan satu baris per input(). Baris kosong di akhir dibuang,
// baris kosong di tengah tetap dipertahankan (bisa jadi input yang memang kosong).
function barisInput(teks: string): string[] {
  const baris = teks.replace(/\r\n/g, "\n").split("\n");
  while (baris.length > 0 && baris[baris.length - 1].trim() === "") baris.pop();
  return baris;
}

// Batas waktu eksekusi kode Python (dihitung sejak Python benar-benar berjalan,
// bukan sejak tombol Run diklik). Ini untuk mendeteksi infinite loop.
const BATAS_JALAN_MS = 8000;
// Batas waktu menyiapkan Pyodide pertama kali (unduh + kompilasi WASM ~13 MB).
// Di PC lambat ini bisa lama, jadi sengaja diberi kelonggaran besar.
const BATAS_MUAT_MS = 90000;

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
  finalBoss = false,
  badge,
  contoh,
  masukan = "",
  punyaUji = false,
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
  /** Level puncak (mis. level 15 "FINAL BOSS"). */
  finalBoss?: boolean;
  /** Nama badge saat final boss berhasil (mis. "PRINT MASTER"). */
  badge?: string | null;
  /** Contoh pola pengerjaan (isinya berbeda dari target soal). */
  contoh?: string | null;
  /** Input wajib, satu baris per input(). Ditampilkan ke siswa. */
  masukan?: string;
  /** Ada uji internal dengan input berbeda (tidak ditampilkan). */
  punyaUji?: boolean;
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
  // Berapa kali siswa salah di level ini (untuk memunculkan petunjuk).
  const [salahCount, setSalahCount] = useState(0);
  // Modal input: null = tidak tampil.
  const [modal, setModal] = useState<ModalInputState | null>(null);
  // Input yang dipakai saat run terakhir (submitted lewat modal).
  const [inputTerpakai, setInputTerpakai] = useState<string[]>([]);

  const pekerjaRef = useRef<Worker | null>(null);
  const hitungRef = useRef(0);
  const sibuk = status !== "siap" || modal !== null;

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

  async function simpan(hasil: {
    keluaran: string;
    keluaranUji: string | null;
    galatUji: string | null;
    analisis: AnalisisBebas | null;
    galat: string | null;
    stdinDipakai: string[];
  }) {
    // Tahan output sampai server/database selesai menilai.
    setStatus("menilai");
    try {
      const jawab = await simpanHasilLab({
        exerciseId,
        kode,
        keluaran: hasil.keluaran,
        keluaranUji: hasil.keluaranUji,
        galatUji: hasil.galatUji,
        masukanDipakai: hasil.stdinDipakai,
        analisis: hasil.analisis,
      });

      setKeluaran(hasil.keluaran);
      setSudahJalan(true);
      setGalat(hasil.galat);

      if (jawab.sukses) {
        setPercobaan(jawab.percobaan);
        setPernahBenar(jawab.pernahBenar);
        setTersimpan(true);
        setBenar(jawab.benar);
        setPesan(jawab.benar ? PESAN_BENAR : jawab.petunjuk);
        if (!jawab.benar) setSalahCount((n) => n + 1);
        if (jawab.benar) router.refresh();
      } else if (jawab.message) {
        setGalat(jawab.message);
      }
    } catch {
      setKeluaran(hasil.keluaran);
      setSudahJalan(true);
      setGalat(hasil.galat ?? "Gagal menghubungi server penilaian. Coba lagi.");
    } finally {
      setStatus("siap");
    }
  }

  // Langkah 1: Run ditekan → tampilkan modal input (kalau kode meminta input).
  function jalankan() {
    const rencana = bacaInput(kode);
    setKeluaran("");
    setGalat(null);
    setTersimpan(false);
    setSudahJalan(false);
    setBenar(null);
    setPesan(null);

    if (rencana.jumlah === 0 && barisInput(masukan).length > 0) {
      // Soal memakai input wajib tetapi kode belum punya input(): beri tahu
      // tanpa modal kosong.
      setGalat(
        "Program ini belum memakai input(). Pada tantangan ini kamu harus mengambil data dengan input().",
      );
      setSudahJalan(true);
      return;
    }

    if (rencana.jumlah === 0) {
      void mulaiJalan([], []);
      return;
    }

    setModal({ rencana, saran: barisInput(masukan) });
  }

  // Batal di modal: jangan jalankan apa pun, dan kembalikan tampilan ke
  // keadaan sebelum Run (output lama tetap terlihat kalau ada).
  function batalModal() {
    setModal(null);
    setStatus("siap");
  }

  // Langkah 5: jalankan program memakai data dari modal.
  async function mulaiJalan(nilai: string[], prompt: string[]) {
    const pekerja = ambilPekerja();
    const id = ++hitungRef.current;

    setInputTerpakai(nilai);
    setStatus("memuat");
    setKeluaran("");
    setGalat(null);
    setTersimpan(false);
    setSudahJalan(false);
    setBenar(null);
    setPesan(null);

    // Input uji diambil saat Run ditekan (bukan saat halaman dimuat), supaya
    // isinya tidak ikut terkirim bersama halaman. Fail-closed: kalau uji gagal
    // dimuat, jangan jalankan kode tanpa uji — hentikan dengan pesan jelas.
    let stdinUji: string[] | null = null;
    if (punyaUji) {
      try {
        const uji = await ambilMasukanUji(exerciseId);
        if (uji?.masukan) stdinUji = barisInput(uji.masukan);
      } catch {
        stdinUji = null;
      }
      if (!stdinUji || stdinUji.length === 0) {
        setStatus("siap");
        setGalat(
          "Gagal memuat data uji untuk soal ini. Periksa koneksimu, lalu tekan Run Python lagi.",
        );
        return;
      }
    }

    let selesai = false;
    // Fase 1: menyiapkan Python. Timer ini besar dan TIDAK men-terminate worker,
    // supaya pemuatan Pyodide yang sedang berjalan tidak terbuang sia-sia.
    let timer = setTimeout(() => {
      if (selesai) return;
      selesai = true;
      setStatus("siap");
      setGalat(
        "Python masih disiapkan dan memakan waktu lama. Periksa koneksi internet, lalu tekan Run Python lagi — pemuatan akan dilanjutkan.",
      );
    }, BATAS_MUAT_MS);

    // Fase 2: kode sedang berjalan. Baru di sini batas 8 detik berlaku.
    function mulaiBatasJalan() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (selesai) return;
        selesai = true;
        pekerja.terminate();
        pekerjaRef.current = null;
        setStatus("siap");
        setGalat(
          `Program berjalan terlalu lama (lebih dari ${
            BATAS_JALAN_MS / 1000
          } detik) dan dihentikan. Periksa kemungkinan perulangan tanpa henti.`,
        );
      }, BATAS_JALAN_MS);
    }

    pekerja.onmessage = (event) => {
      const data = event.data as {
        id: number;
        status?: string;
        stdout?: string;
        stderr?: string;
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
        // Python siap dan kode mulai dieksekusi: mulai hitung batas 8 detik.
        if (!selesai) mulaiBatasJalan();
        return;
      }

      if (selesai) return;
      selesai = true;
      clearTimeout(timer);

      const keluaranBaru = data.stdout ?? "";
      const keluaranUjiBaru =
        typeof data.stdoutUji === "string" ? data.stdoutUji : null;
      // Baris input yang benar-benar dikonsumsi input(). Kalau kosong (kode
      // error sebelum input()), kirim null supaya server menolak dengan jelas.
      const stdinDipakai = Array.isArray(data.stdinDipakai)
        ? data.stdinDipakai
        : [];
      // Run uji memakai input berbeda; kalau error di situ, tampilkan
      // penyebabnya (mis. EOFError karena input() dipanggil lebih banyak).
      const galatBaru = data.error
        ? data.error
        : data.errorUji
          ? `Saat diuji dengan input berbeda: ${data.errorUji}`
          : null;

      void simpan({
        keluaran: keluaranBaru,
        keluaranUji: keluaranUjiBaru,
        galatUji: data.errorUji ?? null,
        analisis: data.analisis ?? null,
        galat: galatBaru,
        stdinDipakai,
      });
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
      stdin: nilai,
      stdinUji,
      // Teks input("...") tidak boleh ikut jadi output; prompt dikirim
      // supaya worker bisa membersihkannya dari stdout.
      prompt,
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
    setInputTerpakai([]);
  }

  const statusText =
    status === "memuat"
      ? "Menyiapkan Python pertama kali (unduh + kompilasi). Di PC lambat ini bisa lama — setelah sekali, run berikutnya instan."
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
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
          >
            <span className="font-mono text-sm font-bold">&gt;_</span>
          </span>
          <div>
            <h2 id="editor-python-heading" className="text-sm font-semibold text-white">
              Editor Python
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">Tulis kode, lalu jalankan untuk memeriksa hasil.</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25">
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

  // Input yang benar-benar dipakai saat Run terakhir (bukti bagi siswa).
  const panelInputDipakai =
    sudahJalan && masukan.trim() && inputTerpakai.length > 0 ? (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Input yang dipakai program
        </h3>
        <ul className="mt-2 space-y-1">
          {inputTerpakai.map((isi, urutan) => {
            const wajib = barisInput(masukan)[urutan];
            const beda = wajib !== undefined && wajib !== isi;
            return (
              <li
                key={urutan}
                className="flex items-start gap-2 font-mono text-xs leading-5"
              >
                <span className="w-4 shrink-0 text-right text-slate-400">
                  {urutan + 1}
                </span>
                <span className={beda ? "text-amber-800" : "text-slate-800"}>
                  {isi === "" ? "(kosong)" : isi}
                </span>
                {beda ? (
                  <span className="font-sans text-[11px] font-semibold text-amber-700">
                    (wajib: {wajib})
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
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
      className={`rounded-2xl p-4 ring-1 ${
        benar
          ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
          : "bg-amber-50 text-amber-900 ring-amber-200"
      }`}
    >
      <p className="flex items-center gap-2 text-base font-bold">
        <span aria-hidden="true" className="font-mono">
          {benar ? "✓" : "✕"}
        </span>
        {benar ? "BENAR!" : "BELUM TEPAT"}
      </p>
      <p className="mt-1.5 text-sm leading-6">{pesan}</p>
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

  // Panel kemenangan spesial untuk FINAL BOSS (level puncak).
  const panelFinalBoss =
    finalBoss && benar === true ? (
      <section
        role="status"
        aria-live="assertive"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-emerald-600 p-1 shadow-lg"
      >
        <div className="rounded-[calc(1rem-1px)] bg-slate-950 p-6 text-center">
          <p className="text-4xl" aria-hidden="true">
            🏆
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-amber-300">
            FINAL BOSS TAKLUK!
          </h2>
          <p className="mt-2 text-base text-slate-200">
            Kamu menuntaskan seluruh tantangan dengan tepat. Kerja kerasmu luar biasa!
          </p>
          {badge ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-base font-extrabold text-slate-900 shadow">
              <span aria-hidden="true">🏆</span> {badge}
            </p>
          ) : null}
        </div>
      </section>
    ) : null;

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
              {panelInputDipakai}
              {panelFinalBoss}
              {panelPesan}
            </div>

            <aside className="order-1 flex flex-col gap-3 lg:order-2">
              <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <p className="text-xs font-semibold tracking-wide text-emerald-300 uppercase">Tantangan {levelNumber}</p>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-100">{instruksi}</p>
              </section>

              {masukan.trim() ? (
                <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      {jenis === "bebas" ? "Contoh input" : "Input wajib"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {jenis === "bebas"
                        ? `${barisInput(masukan).length} baris`
                        : `${barisInput(masukan).length} input`}
                    </p>
                  </div>
                  <ol className="mt-3 space-y-1.5">
                    {barisInput(masukan).map((isi, urutan) => (
                      <li key={urutan} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-[11px] font-semibold text-slate-400">
                          {urutan + 1}
                        </span>
                        <code className="font-mono text-sm break-words text-emerald-200">
                          {isi === "" ? "(kosong)" : isi}
                        </code>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    {jenis === "bebas"
                      ? "Isi jawaban modal sesuai contoh ini. Pakai minimal 5 baris pertama."
                      : "Ketik jawaban modal persis seperti ini dengan urutan yang sama. Menulis input(\"Teks: \") tidak masalah — teksnya hanya tampil di modal."}
                  </p>
                </section>
              ) : null}

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
                    Bantuan materi
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{bantuan}</p>
                </details>
              ) : null}

              {panelStatus}
            </aside>
          </div>
        </div>
        {modal ? (
          <ModalInputLab
            state={modal}
            onBatal={batalModal}
            onKirim={(nilai) => {
              const prompt = modal.rencana.daftar.map((item) => item.pertanyaan);
              setModal(null);
              void mulaiJalan(nilai, prompt);
            }}
          />
        ) : null}
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
      {panelInputDipakai}
      {panelFinalBoss}
      {panelPesan}
      {panelStatus}

      <BantuanLab
        penjelasan={instruksi}
        materi={bantuan}
        contoh={contoh ?? null}
        salahCount={salahCount}
      />

      {modal ? (
        <ModalInputLab
          state={modal}
          onBatal={batalModal}
          onKirim={(nilai) => {
            const prompt = modal.rencana.daftar.map((item) => item.pertanyaan);
            setModal(null);
            void mulaiJalan(nilai, prompt);
          }}
        />
      ) : null}
    </div>
  );
}
