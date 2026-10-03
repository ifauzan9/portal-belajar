"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  submitUlangan,
  catatProbe,
  type HasilSubmitUlangan,
} from "@/app/siswa/actions";
import { Badge } from "@/components/ui/badge";
import { Notifikasi } from "@/components/ui/notifikasi";
import { IkonJam } from "@/components/ui/ikon-siswa";

type Soal = {
  id: string;
  soal: string;
  jenis: string;
  pilihan: string[] | null;
  kunci: string | null;
  poin: number;
  urutan: number;
};

function formatMenit(detik: number): string {
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FormJawaban({
  examId,
  soalList,
  tenggat,
  durasi,
  nilaiDitampilkan,
}: {
  examId: string;
  soalList: Soal[];
  // Batas waktu submit (ISO/null)
  tenggat: string | null;
  // Durasi pengerjaan dalam menit (null = tanpa timer)
  durasi: number | null;
  // Apakah nilai langsung kelihatan setelah submit
  nilaiDitampilkan: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    HasilSubmitUlangan,
    FormData
  >(submitUlangan, { message: null, nilaiTotal: null });

  // Simpan jawaban di state; hidden input per soal dikirim ke form.
  const [jawaban, setJawaban] = useState<Record<string, string>>({});

  // ------------------- TIMER -------------------
  // Mulai hitung saat halaman pertama kali dirender (tandai kapan
  // siswa membuka form — waktu mulai disimpan di ref).
  const mulaiRef = useRef<number>(0);
  useEffect(() => {
    mulaiRef.current = Date.now();
  }, []);

  // detik tersisa (untuk durasi) dan tenggat (untuk batas luar)
  const [detikSisa, setDetikSisa] = useState<number | null>(null); // null = tanpa timer
  const [lewatTenggat, setLewatTenggat] = useState(false);
  const [lewatDurasi, setLewatDurasi] = useState(false);

  useEffect(() => {
    const idInterval = setInterval(() => {
      const now = Date.now();

      // Cek tenggat
      if (tenggat) {
        const sisaTenggatMs = new Date(tenggat).getTime() - now;
        setLewatTenggat(sisaTenggatMs <= 0);
      }

      // Cek durasi
      if (durasi !== null) {
        const durasiMs = durasi * 60 * 1000;
        const sudahLama = now - mulaiRef.current;
        const sisa = durasiMs - sudahLama;
        setDetikSisa(Math.max(0, Math.floor(sisa / 1000)));
        if (sisa <= 0) setLewatDurasi(true);
      }
    }, 1000);

    return () => clearInterval(idInterval);
  }, [tenggat, durasi]);

  // Auto-submit saat durasi habis
  useEffect(() => {
    if (lewatDurasi && !pending && !state.nilaiTotal) {
      // submit otomatis form
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
  //
  // Setiap event → kirim `catatProbe` ke server (fire-and-forget).
  // Server memvalidasi sesi siswa & mengabaikan probe jika:
  //   - ulangan sudah lewat tenggat, atau
  //   - siswa sudah submit.
  // Jika DDL Tahap 11 belum dijalankan, insert gagal diam-diam.
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

    // visibilitychange: pindah tab / minimize / sleep
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        kirimProbe("visibility");
      }
    };

    // blur: window kehilangan fokus (pindah ke aplikasi lain)
    const onBlur = () => kirimProbe("blur");

    // freeze: Page Visibility Level 2 (tidak semua browser dukung)
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
        ? new Date(tenggat).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;

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
                {new Date(tenggat).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
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
        action={formAction}
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
              : Boolean(jawaban[soal.id]);
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
                <p className="flex-1 pt-0.5 text-sm font-medium text-slate-900">
                  {soal.soal}
                </p>
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
            </div>
          );
        })}

        {/* ---------------- BILAH AKSI ---------------- */}
        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button
            type="submit"
            disabled={pending || lewatDurasi || lewatTenggat}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Mengumpulkan..."
              : lewatDurasi || lewatTenggat
                ? "Ulangan ditutup"
                : "Kumpulkan Jawaban"}
          </button>
          <p className="text-xs text-slate-400">
            {sudahSubmit
              ? "Jawaban sudah dikumpulkan."
              : "Setelah submit, jawaban tidak bisa diubah."}
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
