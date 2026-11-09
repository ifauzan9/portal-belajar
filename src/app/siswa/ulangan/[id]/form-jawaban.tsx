"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import {
  submitUlangan,
  catatProbe,
  type HasilSubmitUlangan,
} from "@/app/siswa/actions";
import { Badge } from "@/components/ui/badge";
import { Notifikasi } from "@/components/ui/notifikasi";
import { IkonJam } from "@/components/ui/ikon-siswa";
import { TeksSoalTerlindungi } from "@/components/teks-soal-terlindungi";
import {
  EditorKodeUjian,
  type PeganganEditorKode,
} from "@/components/lab-runner-ujian";
import { formatTanggalJamPendekWib } from "@/lib/waktu";

type Soal = {
  id: string;
  soal: string;
  jenis: string;
  pilihan: string[] | null;
  kunci: string | null;
  poin: number;
  urutan: number;
  kode_awal?: string | null;
  keluaran_diharapkan?: string | null;
  masukan?: string | null;
  aturan?: {
    variabel_wajib?: string[];
    dari_input?: boolean;
    min_input?: number;
    min_print?: number;
  } | null;
};

function formatMenit(detik: number): string {
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function barisTeks(teks: string | null | undefined): string[] {
  if (!teks) return [];
  const baris = teks.replace(/\r\n/g, "\n").split("\n");
  while (baris.length > 0 && baris[baris.length - 1].trim() === "") baris.pop();
  return baris;
}

export function FormJawaban({
  examId,
  soalList,
  tenggat,
  durasi,
  nilaiDitampilkan,
  blokirTempel,
  mulaiAt,
}: {
  examId: string;
  soalList: Soal[];
  // Batas waktu submit (ISO/null)
  tenggat: string | null;
  // Durasi pengerjaan dalam menit (null = tanpa timer)
  durasi: number | null;
  // Apakah nilai langsung kelihatan setelah submit
  nilaiDitampilkan: boolean;
  // Guru menyalakan blokir paste/drop di editor kode.
  blokirTempel: boolean;
  // Waktu mulai dari server (exam_sessions.mulai_at). Timer tidak reset
  // saat halaman di-refresh.
  mulaiAt: string;
}) {
  const [state, formAction, pending] = useActionState<
    HasilSubmitUlangan,
    FormData
  >(submitUlangan, { message: null, nilaiTotal: null });

  // Simpan jawaban di state; hidden input per soal dikirim ke form.
  const [jawaban, setJawaban] = useState<Record<string, string>>({});

  // ------------------- TIMER (server-anchored) -------------------
  const mulaiMs = useMemo(() => {
    const nilai = new Date(mulaiAt).getTime();
    return Number.isFinite(nilai) ? nilai : 0;
  }, [mulaiAt]);

  const [detikSisa, setDetikSisa] = useState<number | null>(
    durasi !== null ? durasi * 60 : null,
  ); // null = tanpa timer
  const [lewatTenggat, setLewatTenggat] = useState(false);
  const [lewatDurasi, setLewatDurasi] = useState(false);

  useEffect(() => {
    function hitung() {
      const now = Date.now();

      if (tenggat) {
        setLewatTenggat(new Date(tenggat).getTime() - now <= 0);
      }

      if (durasi !== null) {
        const durasiMs = durasi * 60 * 1000;
        const sisa = durasiMs - (now - mulaiMs);
        setDetikSisa(Math.max(0, Math.floor(sisa / 1000)));
        if (sisa <= 0) setLewatDurasi(true);
      }
    }

    hitung();
    const idInterval = setInterval(hitung, 1000);
    return () => clearInterval(idInterval);
  }, [tenggat, durasi, mulaiMs]);

  // Auto-submit saat durasi habis
  useEffect(() => {
    if (lewatDurasi && !pending && !state.nilaiTotal) {
      const form = document.querySelector<HTMLFormElement>(
        'form[data-jawaban-form="true"]',
      );
      form?.requestSubmit();
    }
  }, [lewatDurasi, pending, state.nilaiTotal]);

  // ------------------- KUNCI HALAMAN -------------------
  // Cegah siswa meninggalkan halaman sebelum submit (browser + SPA).
  const sudahSubmit = state.nilaiTotal !== null || state.message?.includes("berhasil");

  useEffect(() => {
    if (sudahSubmit) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sudahSubmit]);

  // ------------------- CATAT PROBE -------------------
  // Hitung & simpan berapa kali siswa:
  //   - blur:       kehilangan fokus window (pindah tab / aplikasi lain)
  //   - visibility: document.visibilityState → hidden (minimize / lock screen)
  //   - freeze:     Page Visibility Level 2 (OS membekukan tab)
  const jumlahProbe = useRef(0);
  const [probeCount, setProbeCount] = useState(0);

  useEffect(() => {
    if (sudahSubmit) return;

    function kirimProbe(jenis: "blur" | "visibility" | "freeze") {
      jumlahProbe.current += 1;
      setProbeCount(jumlahProbe.current);

      const fd = new FormData();
      fd.set("exam_id", examId);
      fd.set("jenis", jenis);
      void catatProbe(fd);
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        kirimProbe("visibility");
      }
    };

    const onBlur = () => kirimProbe("blur");
    const onFreeze = () => kirimProbe("freeze");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("freeze", onFreeze);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("freeze", onFreeze);
    };
  }, [sudahSubmit, examId]);

  // ------------------- SUBMIT -------------------
  // Untuk soal kode: jalankan kode terakhir dengan input wajib SEBELUM
  // mengirim, supaya nilai tidak memakai output lama. Run manual tidak
  // menyimpan apa pun; hanya submit yang mengirim hasil.
  const formRef = useRef<HTMLFormElement>(null);
  const editorRefs = useRef<Record<string, PeganganEditorKode | null>>({});
  const kirimRef = useRef(false);
  const [menyiapkanKode, setMenyiapkanKode] = useState(false);

  const soalKode = soalList.filter((s) => s.jenis === "kode");

  async function tanganiSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (soalKode.length === 0) return; // form biasa (PG/esai)

    e.preventDefault();
    if (pending || menyiapkanKode || kirimRef.current) return;

    const form = formRef.current;
    if (!form) return;

    kirimRef.current = true;
    setMenyiapkanKode(true);
    try {
      const fd = new FormData(form);

      for (const soal of soalKode) {
        const editor = editorRefs.current[soal.id];
        const hasil = editor ? await editor.siapkanHasil() : null;
        if (!hasil) continue; // kode tetap terkirim lewat hidden input

        fd.set(`kode_${soal.id}`, hasil.kode);
        fd.set(`keluaran_${soal.id}`, hasil.keluaran);
        fd.set(`keluaran_uji_${soal.id}`, hasil.keluaranUji ?? "");
        fd.set(`analisis_${soal.id}`, JSON.stringify(hasil.analisis));
        fd.set(`stdin_${soal.id}`, JSON.stringify(hasil.stdin));
        fd.set(`percobaan_${soal.id}`, String(hasil.percobaan));
      }

      startTransition(() => formAction(fd));
    } finally {
      kirimRef.current = false;
      setMenyiapkanKode(false);
    }
  }

  // ------------------- HITUNG PROGRES -------------------
  const totalPoin = soalList.reduce((akum, s) => akum + s.poin, 0);
  const soalPG = soalList.filter((s) => s.jenis === "pg");
  const soalEsai = soalList.filter((s) => s.jenis === "esai");

  const dijawabPG = soalPG.filter((s) => jawaban[s.id]).length;
  const dijawabEsai = soalEsai.filter(
    (s) => jawaban[s.id]?.trim(),
  ).length;

  // Tenggat lokal: jika durasi aktif, hitung sisa dari durasi;
  // jika hanya tenggat (tanpa durasi), hitung sisa dari tenggat.
  const waktuBerakhir =
    durasi !== null
      ? `${formatMenit(detikSisa ?? 0)}`
      : tenggat
        ? formatTanggalJamPendekWib(tenggat)
        : null;

  const sedangKirim = pending || menyiapkanKode;

  // ------------------- RENDER -------------------
  return (
    <div className="space-y-4">
      {/* ---------------- Info & TIMER ---------------- */}
      <div
        className={`sticky top-2 z-10 rounded-xl p-4 ring-1 backdrop-blur ${
          lewatDurasi || lewatTenggat
            ? "bg-red-50/95 ring-red-200"
            : durasi !== null && (detikSisa ?? 0) <= 30
              ? "bg-red-50/95 ring-red-200"
              : "bg-white/95 ring-slate-200"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Kiri: info soal */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge varian="netral">{soalList.length} soal</Badge>
              <span className="text-xs text-slate-500">
                Total {totalPoin} poin
              </span>
            </div>
            <div className="flex gap-3 text-xs text-slate-500">
              <span>
                PG: <span className="font-medium text-slate-700">{dijawabPG}</span>
                /{soalPG.length}
              </span>
              <span>
                Esai:{" "}
                <span className="font-medium text-slate-700">{dijawabEsai}</span>
                /{soalEsai.length}
              </span>
              {soalKode.length > 0 ? (
                <span>
                  Kode:{" "}
                  <span className="font-medium text-slate-700">
                    {soalKode.length}
                  </span>{" "}
                  soal
                </span>
              ) : null}
            </div>

            {/* Counter probe live */}
            {probeCount > 0 ? (
              <span className="mt-0.5 text-xs font-medium text-rose-600">
                ⚠ Sudah meninggalkan halaman {probeCount} kali
              </span>
            ) : null}
          </div>

          {/* Kanan: timer */}
          {durasi !== null ? (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1 ${
                (detikSisa ?? 0) <= 30
                  ? "bg-red-100 ring-red-200 text-red-700"
                  : "bg-slate-900 ring-slate-900 text-white"
              }`}
            >
              <IkonJam className="h-4 w-4" />
              <span className="text-sm font-semibold tabular-nums">
                {waktuBerakhir}
              </span>
              <span
                className={`text-xs ${
                  (detikSisa ?? 0) <= 30 ? "text-red-600" : "text-slate-300"
                }`}
              >
                tersisa
              </span>
            </div>
          ) : tenggat ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">
              <span className="text-xs text-slate-500">Tenggat:</span>
              <span className="text-sm font-medium text-slate-900">
                {formatTanggalJamPendekWib(tenggat)}
              </span>
            </div>
          ) : null}
        </div>

        {/* Peringatan */}
        {lewatDurasi ? (
          <p className="mt-2 text-xs font-medium text-red-700">
            Waktu habis — jawaban sedang dikumpulkan otomatis.
          </p>
        ) : lewatTenggat ? (
          <p className="mt-2 text-xs font-medium text-red-700">
            Tenggat waktu sudah lewat.
          </p>
        ) : durasi !== null && (detikSisa ?? 0) <= 30 ? (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Segera selesaikan — waktu hampir habis!
          </p>
        ) : null}
      </div>

      {/* Nota: nilai tidak langsung kelihatan */}
      {!nilaiDitampilkan ? (
        <Notifikasi varian="info">
          📝 Nilai akan ditahan oleh guru. Kamu tidak akan melihat angka
          nilaimu setelah submit sampai guru menandai &ldquo;selesai
          dinilai&rdquo;.
        </Notifikasi>
      ) : null}

      {/* ---------------- FORM ---------------- */}
      <form
        ref={formRef}
        action={formAction}
        onSubmit={tanganiSubmit}
        data-jawaban-form="true"
        className="space-y-4"
      >
        <input type="hidden" name="exam_id" value={examId} />

        {/* Hidden input per soal — nilai diupdate dari state */}
        {soalList.map((s) => (
          <input
            key={s.id}
            type="hidden"
            name={`jawaban_${s.id}`}
            value={jawaban[s.id] ?? ""}
          />
        ))}

        {soalList.map((soal, i) => {
          const dijawab =
            soal.jenis === "esai"
              ? Boolean(jawaban[soal.id]?.trim())
              : soal.jenis === "pg"
                ? Boolean(jawaban[soal.id])
                : false;
          const lindungiSoal = blokirTempel && soal.jenis === "kode";
          return (
            <div
              key={soal.id}
              className={`rounded-2xl bg-white p-4 ring-1 transition sm:p-5 ${
                dijawab ? "ring-emerald-200" : "ring-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    dijawab
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {i + 1}
                </span>
                <TeksSoalTerlindungi
                  aktif={lindungiSoal}
                  className="flex-1 pt-0.5"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {soal.soal}
                  </p>
                  {lindungiSoal ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      🔒 Teks soal tidak dapat disalin.
                    </p>
                  ) : null}
                </TeksSoalTerlindungi>
                <span className="shrink-0 pt-0.5 text-xs text-slate-400">
                  {soal.poin} poin
                </span>
              </div>

              {soal.jenis === "pg" && soal.pilihan ? (
                <div className="mt-3 space-y-1.5">
                  {soal.pilihan.map((opsi) => {
                    const label = opsi.split(".")[0].trim();
                    const dipilih = jawaban[soal.id] === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setJawaban((prev) => ({ ...prev, [soal.id]: label }))
                        }
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          dipilih
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            dipilih
                              ? "bg-white text-slate-900"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {label}
                        </span>
                        <span>{opsi.replace(/^[A-D]\.\s*/, "")}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {soal.jenis === "esai" ? (
                <textarea
                  rows={3}
                  placeholder="Tulis jawabanmu di sini..."
                  value={jawaban[soal.id] ?? ""}
                  onChange={(e) =>
                    setJawaban((prev) => ({
                      ...prev,
                      [soal.id]: e.target.value,
                    }))
                  }
                  className="mt-3 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              ) : null}

              {soal.jenis === "kode" ? (
                <div className="mt-3 space-y-3">
                  <TeksSoalTerlindungi
                    aktif={lindungiSoal}
                    className="space-y-3"
                  >
                    {barisTeks(soal.masukan).length > 0 ? (
                      <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          Input wajib
                        </p>
                        <ol className="mt-2 flex flex-wrap gap-2">
                          {barisTeks(soal.masukan).map((isi, urutan) => (
                            <li
                              key={urutan}
                              className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs text-slate-800 ring-1 ring-slate-200"
                            >
                              {isi === "" ? "(kosong)" : isi}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {soal.keluaran_diharapkan ? (
                      <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          Target output
                        </p>
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-5 text-emerald-200">
                          {soal.keluaran_diharapkan}
                        </pre>
                      </div>
                    ) : null}

                    {(soal.aturan?.variabel_wajib?.length ?? 0) > 0 ? (
                      <div className="rounded-xl bg-indigo-50/60 p-3 ring-1 ring-indigo-100">
                        <p className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">
                          Variabel yang diminta
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {soal.aturan!.variabel_wajib!.map((nama) => (
                            <li
                              key={nama}
                              className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200"
                            >
                              {nama}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </TeksSoalTerlindungi>

                  <EditorKodeUjian
                    ref={(el) => {
                      editorRefs.current[soal.id] = el;
                    }}
                    examId={examId}
                    soalId={soal.id}
                    kodeAwal={soal.kode_awal ?? null}
                    masukan={soal.masukan ?? ""}
                    nonaktif={lewatDurasi || lewatTenggat}
                    blokirTempel={blokirTempel}
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        {/* ---------------- BILAH AKSI ---------------- */}
        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button
            type="submit"
            disabled={sedangKirim || lewatDurasi || lewatTenggat}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {menyiapkanKode
              ? "Menyiapkan jawaban kode..."
              : pending
                ? "Mengumpulkan..."
                : lewatDurasi || lewatTenggat
                  ? "Ulangan ditutup"
                  : "Selesai & Kirim"}
          </button>
          <p className="text-xs text-slate-400">
            {sudahSubmit
              ? "Jawaban sudah dikumpulkan."
              : "Run Python tidak menyimpan jawaban. Setelah Selesai & Kirim, jawaban tidak bisa diubah."}
          </p>
        </div>
      </form>

      {/* ---------------- HASIL ---------------- */}
      {state.message ? (
        <Notifikasi
          varian={
            state.nilaiTotal !== null && nilaiDitampilkan
              ? "sukses"
              : state.nilaiTotal !== null
                ? "info"
                : "peringatan"
          }
        >
          <p>{state.message}</p>
          {state.nilaiTotal !== null && nilaiDitampilkan ? (
            <p className="mt-1">
              <span className="font-semibold">Nilai sementara:</span>{" "}
              {state.nilaiTotal}
            </p>
          ) : state.nilaiTotal !== null ? (
            <p className="mt-1 text-xs opacity-80">
              Nilai akan ditampilkan setelah guru selesai menilai.
            </p>
          ) : null}
        </Notifikasi>
      ) : null}
    </div>
  );
}