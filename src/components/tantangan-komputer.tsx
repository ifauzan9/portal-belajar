"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { simpanHasilKomputer } from "@/app/siswa/komputer/actions";

export type Konfigurasi = {
  pilihan?: string[];
  jawaban?: string | string[];
  tahanMs?: number;
  item?: string;
  tujuan?: string;
  teks?: string;
  paragraf?: string;
  pertanyaan?: string;
  mulai?: string;
  lewat?: string[];
  menu?: string;
  jumlah?: number;
  target?: number;
  toleransi?: number;
  min?: number;
  max?: number;
  ukuranTarget?: number;
};

function acak<T>(arr: T[]): T[] {
  const hasil = [...arr];
  for (let i = hasil.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

const JAWABAN_BANYAK = (k: Konfigurasi): string[] =>
  Array.isArray(k.jawaban) ? k.jawaban : [];
const JAWABAN_TUNGGAL = (k: Konfigurasi): string =>
  typeof k.jawaban === "string" ? k.jawaban : "";

// Posisi tetap (relatif %) untuk item marquee & seret_jalur.
const POSISI_ITEM = [
  { x: 8, y: 12 },
  { x: 40, y: 10 },
  { x: 70, y: 16 },
  { x: 14, y: 52 },
  { x: 44, y: 48 },
  { x: 72, y: 56 },
  { x: 26, y: 78 },
  { x: 60, y: 82 },
];

export function TantanganKomputer({
  challengeId,
  jenis,
  konfigurasi,
  judul,
  level,
  penjelasan,
  contoh,
  instruksi,
  poin,
  lessonId,
  berikutLevel,
  pernahBenarAwal,
  percobaanAwal,
}: {
  challengeId: string;
  jenis: string;
  konfigurasi: Konfigurasi;
  judul: string;
  level: number;
  penjelasan: string;
  contoh: string | null;
  instruksi: string;
  poin: number;
  lessonId: string;
  berikutLevel: number | null;
  pernahBenarAwal: boolean;
  percobaanAwal: number;
}) {
  const [benar, setBenar] = useState<boolean | null>(
    pernahBenarAwal ? true : null,
  );
  const [selesai, setSelesai] = useState(pernahBenarAwal);
  const [pesan, setPesan] = useState<string | null>(null);
  const [salahPilih, setSalahPilih] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(percobaanAwal);
  const [progres, setProgres] = useState(0);
  const [waktuMs, setWaktuMs] = useState<number | null>(null);

  const timerRef = useRef<number | null>(null);
  const seretItemRef = useRef<string | null>(null);
  const tikRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const terjawab = benar === true;

  // Jenis yang berbasis drag: matikan seleksi teks agar tidak ikut tersorot.
  const tanpaSeleksi = [
    "drag",
    "drag_urut",
    "seret_kotak",
    "seret_jalur",
    "resize",
    "pan",
  ].includes(jenis);

  // Penghitung waktu sederhana (100 ms per tik) untuk gamifikasi.
  useEffect(() => {
    const id = window.setInterval(() => {
      tikRef.current += 1;
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  async function catat(benarNilai: boolean, waktu?: number | null) {
    setPercobaan((p) => p + 1);
    const waktuPakai = waktu ?? null;
    const skor =
      benarNilai && waktuPakai != null
        ? Math.max(0, 100 - Math.floor(waktuPakai / 100))
        : null;
    try {
      const res = await simpanHasilKomputer({
        challengeId,
        benar: benarNilai,
        waktuMs: waktuPakai,
        skor,
      });
      if (res?.sukses) setPercobaan(res.percobaan);
    } catch {
      // abaikan
    }
  }

  function jawabBenar(waktu?: number | null) {
    if (terjawab) return;
    if (waktu != null) setWaktuMs(waktu);
    setBenar(true);
    setSelesai(true);
    setSalahPilih(null);
    setPesan("Hebat! Jawabanmu benar. 🎉");
    void catat(true, waktu);
  }

  function jawabSalah(label?: string, teksPesan?: string) {
    if (terjawab) return;
    setBenar(false);
    if (label) setSalahPilih(label);
    setPesan(
      teksPesan ?? "Belum tepat. Baca lagi materi di atas, lalu coba lagi.",
    );
    void catat(false);
  }

  // ---- hover dwell ----
  function mulaiHover(label: string) {
    if (terjawab || label !== JAWABAN_TUNGGAL(konfigurasi)) return;
    const tahan = konfigurasi.tahanMs ?? 1000;
    const langkah = Math.max(1, Math.round(tahan / 50));
    let hitung = 0;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      hitung += 1;
      setProgres(Math.min(100, (hitung / langkah) * 100));
      if (hitung >= langkah) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setProgres(0);
        jawabBenar();
      }
    }, 50);
  }
  function hentikanHover() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setProgres(0);
  }

  const pilihan = useState<string[]>(() => acak(konfigurasi.pilihan ?? []))[0];

  function kelasKartu(label: string, benarLabel: string) {
    const dasar =
      "relative flex min-h-[72px] items-center justify-center overflow-hidden rounded-xl border-2 px-3 py-3 text-center text-sm font-medium transition select-none";
    if (terjawab && label === benarLabel)
      return `${dasar} border-emerald-500 bg-emerald-50 text-emerald-700`;
    if (salahPilih === label)
      return `${dasar} border-red-400 bg-red-50 text-red-600`;
    return `${dasar} border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50`;
  }

  // ================== Rendering tiap jenis ==================
  function kartuKlik(gesture: "klik" | "kanan" | "ganda" | "hover") {
    const jawaban = JAWABAN_TUNGGAL(konfigurasi);
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {pilihan.map((label) => (
          <button
            key={label}
            type="button"
            disabled={terjawab}
            onContextMenu={(e) => {
              if (gesture !== "kanan") return;
              e.preventDefault();
              if (label === jawaban) jawabBenar();
              else jawabSalah(label, "Objeknya belum tepat untuk klik kanan.");
            }}
            onDoubleClick={() => {
              if (gesture !== "ganda") return;
              if (label === jawaban) jawabBenar();
              else jawabSalah(label, "Objeknya belum tepat untuk klik ganda.");
            }}
            onClick={() => {
              if (gesture === "kanan" || gesture === "hover") return;
              if (gesture === "ganda") return;
              if (label === jawaban) jawabBenar();
              else jawabSalah(label, "Belum tepat. Klik objek yang sesuai.");
            }}
            onPointerEnter={() => {
              if (gesture === "hover") mulaiHover(label);
            }}
            onPointerLeave={() => {
              if (gesture === "hover") hentikanHover();
            }}
            className={kelasKartu(label, jawaban)}
          >
            {gesture === "hover" && label === jawaban && progres > 0 ? (
              <span
                className="absolute inset-y-0 left-0 bg-emerald-200/60"
                style={{ width: `${progres}%` }}
              />
            ) : null}
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderKuis() {
    const jawaban = JAWABAN_TUNGGAL(konfigurasi);
    return (
      <div>
        <p className="mb-3 text-sm font-medium text-slate-800">
          {konfigurasi.pertanyaan ?? instruksi}
        </p>
        <div className="grid gap-2">
          {pilihan.map((label) => (
            <button
              key={label}
              type="button"
              disabled={terjawab}
              onClick={() =>
                label === jawaban
                  ? jawabBenar()
                  : jawabSalah(label, "Jawaban belum tepat. Coba pilihan lain.")
              }
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                terjawab && label === jawaban
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : salahPilih === label
                    ? "border-red-400 bg-red-50 text-red-600"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderDrag() {
    return (
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
          <span className="text-xs text-slate-500">Seret item ini</span>
          <div
            draggable={!terjawab}
            onDragStart={() => {
              seretItemRef.current = konfigurasi.item ?? "";
            }}
            className="cursor-grab rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm active:cursor-grabbing"
          >
            {konfigurasi.item}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {pilihan.map((label) => (
            <div
              key={label}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (terjawab || !seretItemRef.current) return;
                if (label === konfigurasi.tujuan) jawabBenar();
                else
                  jawabSalah(label, "Belum tepat. Lepaskan di tempat yang benar.");
                seretItemRef.current = null;
              }}
              className={`flex min-h-[72px] items-center justify-center rounded-xl border-2 border-dashed px-3 py-3 text-center text-sm font-medium transition ${
                terjawab && label === konfigurasi.tujuan
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : salahPilih === label
                    ? "border-red-400 bg-red-50 text-red-600"
                    : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderScroll() {
    const jawaban = JAWABAN_TUNGGAL(konfigurasi);
    return (
      <div className="rounded-xl border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
          Gulir daftar ini ↓
        </div>
        <div className="max-h-56 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {pilihan.map((label) => (
              <button
                key={label}
                type="button"
                disabled={terjawab}
                onClick={() =>
                  label === jawaban
                    ? jawabBenar()
                    : jawabSalah(label, "Bukan itu. Terus gulir dan cari yang benar.")
                }
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  terjawab && label === jawaban
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : salahPilih === label
                      ? "border-red-400 bg-red-50 text-red-600"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderSeleksi() {
    return (
      <div>
        <p
          onMouseUp={() => {
            if (terjawab) return;
            const teks = window.getSelection()?.toString().trim() ?? "";
            if (!teks) return;
            const target = (konfigurasi.teks ?? "").trim().toLowerCase();
            if (target && teks.toLowerCase().includes(target)) jawabBenar();
            else
              jawabSalah(
                undefined,
                "Belum tepat. Sorot (drag) tepat kalimat yang diminta.",
              );
          }}
          className="cursor-text rounded-xl border border-slate-300 bg-white p-4 text-base leading-relaxed text-slate-800 select-text"
        >
          {konfigurasi.paragraf}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Petunjuk: tahan tombol kiri di awal kalimat, seret sampai akhir, lalu lepas.
        </p>
      </div>
    );
  }

  // ---- pilih_banyak ----
  const [terpilih, setTerpilih] = useState<string[]>([]);
  function renderPilihBanyak() {
    const target = JAWABAN_BANYAK(konfigurasi);
    function toggle(label: string) {
      if (terjawab) return;
      setTerpilih((s) =>
        s.includes(label) ? s.filter((x) => x !== label) : [...s, label],
      );
    }
    function periksa() {
      const sama =
        terpilih.length === target.length &&
        target.every((t) => terpilih.includes(t));
      if (sama) jawabBenar();
      else
        jawabSalah(
          undefined,
          "Belum tepat. Pilih tepat item yang diminta (tidak lebih, tidak kurang).",
        );
    }
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pilihan.map((label) => {
            const aktif = terpilih.includes(label);
            return (
              <button
                key={label}
                type="button"
                disabled={terjawab}
                onClick={() => toggle(label)}
                className={`relative flex min-h-[64px] items-center justify-center rounded-xl border-2 px-3 py-3 text-sm font-medium transition ${
                  terjawab && target.includes(label)
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : aktif
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-sky-400"
                }`}
              >
                {aktif ? <span className="mr-1 text-sky-600">✓</span> : null}
                {label}
              </button>
            );
          })}
        </div>
        {!terjawab ? (
          <button
            type="button"
            onClick={periksa}
            className="mt-3 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Periksa
          </button>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">
          Klik item untuk memilih/melepas. Bisa lebih dari satu.
        </p>
      </div>
    );
  }

  // ---- seret_kotak (marquee) ----
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const sudutRef = useRef<{ x: number; y: number } | null>(null);
  function renderSeretKotak() {
    const target = JAWABAN_BANYAK(konfigurasi);
    function rel(e: React.PointerEvent) {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function selesaiKotak() {
      const kont = containerRef.current;
      if (!kont) return;
      const rk = kont.getBoundingClientRect();
      const kotak = rectRef.current;
      sudutRef.current = null;
      rectRef.current = null;
      setRect(null);
      if (!kotak || kotak.w < 6 || kotak.h < 6) return;
      const terpilih: string[] = [];
      kont.querySelectorAll<HTMLElement>("[data-item]").forEach((el) => {
        const b = el.getBoundingClientRect();
        const bx = b.left - rk.left;
        const by = b.top - rk.top;
        const didalam =
          bx >= kotak.x &&
          by >= kotak.y &&
          bx + b.width <= kotak.x + kotak.w &&
          by + b.height <= kotak.y + kotak.h;
        if (didalam) terpilih.push(el.dataset.item ?? "");
      });
      const sama =
        terpilih.length === target.length &&
        target.every((t) => terpilih.includes(t));
      if (sama) jawabBenar();
      else
        jawabSalah(
          undefined,
          "Kotak harus mencakup tepat item yang diminta (semuanya, tanpa yang lain).",
        );
    }
    return (
      <div>
        <div
          ref={containerRef}
          onPointerDown={(e) => {
            if (terjawab) return;
            const p = rel(e);
            sudutRef.current = p;
            rectRef.current = { x: p.x, y: p.y, w: 0, h: 0 };
            setRect(rectRef.current);
          }}
          onPointerMove={(e) => {
            if (!sudutRef.current || terjawab) return;
            const p = rel(e);
            const s = sudutRef.current;
            const r = {
              x: Math.min(s.x, p.x),
              y: Math.min(s.y, p.y),
              w: Math.abs(p.x - s.x),
              h: Math.abs(p.y - s.y),
            };
            rectRef.current = r;
            setRect(r);
          }}
          onPointerUp={selesaiKotak}
          onPointerLeave={() => {
            if (sudutRef.current) selesaiKotak();
          }}
          className="relative h-56 w-full touch-none overflow-hidden rounded-xl border border-slate-300 bg-slate-50"
          data-area="kotak"
        >
          {pilihan.map((label, i) => {
            const pos = POSISI_ITEM[i % POSISI_ITEM.length];
            const aktif = terjawab && target.includes(label);
            return (
              <span
                key={label}
                data-item={label}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute rounded-lg border-2 px-3 py-2 text-xs font-medium ${
                  aktif
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {label}
              </span>
            );
          })}
          {rect ? (
            <span
              className="pointer-events-none absolute border-2 border-sky-500 bg-sky-400/20"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tahan klik kiri lalu tarik kotak untuk menyorot item.
        </p>
      </div>
    );
  }

  // ---- seret_jalur (tahan + gerakkan) ----
  const [lewatJalur, setLewatJalur] = useState<string[]>([]);
  const lewatRef = useRef<string[]>([]);
  const jalurAktifRef = useRef(false);
  function renderSeretJalur() {
    const titik = konfigurasi.lewat ?? [];
    function rel(e: React.PointerEvent) {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function jarak(a: { x: number; y: number }, bx: number, by: number) {
      return Math.hypot(a.x - bx, a.y - by);
    }
    return (
      <div>
        <div
          ref={containerRef}
          onPointerDown={(e) => {
            if (terjawab) return;
            const r = containerRef.current?.getBoundingClientRect();
            if (!r) return;
            const p = rel(e);
            // mulai hanya jika menekan dekat titik "Mulai" (kiri bawah)
            if (jarak(p, 30, r.height - 30) < 44) {
              jalurAktifRef.current = true;
              lewatRef.current = [];
              setLewatJalur([]);
            }
          }}
          onPointerMove={(e) => {
            if (!jalurAktifRef.current || terjawab) return;
            const r = containerRef.current?.getBoundingClientRect();
            if (!r) return;
            const p = rel(e);
            titik.forEach((label, i) => {
              const pos = POSISI_ITEM[i % POSISI_ITEM.length];
              const bx = (pos.x / 100) * r.width;
              const by = (pos.y / 100) * r.height;
              if (jarak(p, bx, by) < 40) {
                if (!lewatRef.current.includes(label)) {
                  const baru = [...lewatRef.current, label];
                  lewatRef.current = baru;
                  setLewatJalur(baru);
                }
              }
            });
          }}
          onPointerUp={(e) => {
            if (!jalurAktifRef.current || terjawab) return;
            jalurAktifRef.current = false;
            const r = containerRef.current?.getBoundingClientRect();
            if (!r) return;
            const p = rel(e);
            const diTujuan = jarak(p, r.width - 30, 30) < 44;
            const semuaLewat = titik.every((t) => lewatRef.current.includes(t));
            if (diTujuan && semuaLewat) jawabBenar();
            else
              jawabSalah(
                undefined,
                "Tahan klik kiri dari Mulai, ikuti titik, dan lepas tepat di Tujuan.",
              );
          }}
          className="relative h-56 w-full touch-none overflow-hidden rounded-xl border border-slate-300 bg-slate-50"
          data-area="jalur"
        >
          <span className="absolute bottom-4 left-4 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
            Mulai
          </span>
          <span className="absolute top-4 right-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            Tujuan
          </span>
          {titik.map((label, i) => {
            const pos = POSISI_ITEM[i % POSISI_ITEM.length];
            const sudah = lewatJalur.includes(label);
            return (
              <span
                key={label}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold ${
                  sudah
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-slate-600 ring-2 ring-slate-300"
                }`}
              >
                {i + 1}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tahan tombol kiri di “Mulai”, gerakkan (jangan lepas) melewati titik,
          lalu lepas di “Tujuan”.
        </p>
      </div>
    );
  }

  // ---- drag_urut ----
  const [urutan, setUrutan] = useState<string[]>(() =>
    acak(konfigurasi.pilihan ?? []),
  );
  function renderDragUrut() {
    const target = JAWABAN_BANYAK(konfigurasi);
    function periksa() {
      const sama = urutan.every((v, i) => v === target[i]);
      if (sama) jawabBenar();
      else jawabSalah(undefined, "Urutannya belum benar. Coba susun ulang.");
    }
    function tukar(from: number, to: number) {
      if (terjawab) return;
      setUrutan((s) => {
        const a = [...s];
        const [x] = a.splice(from, 1);
        a.splice(to, 0, x);
        return a;
      });
    }
    return (
      <div>
        <ul className="space-y-2">
          {urutan.map((label, i) => (
            <li
              key={label}
              draggable={!terjawab}
              onDragStart={() => {
                seretItemRef.current = String(i);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(seretItemRef.current);
                if (Number.isNaN(from)) return;
                tukar(from, i);
                seretItemRef.current = null;
              }}
              className="flex cursor-grab items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 active:cursor-grabbing"
            >
              <span className="text-slate-400">⠿</span>
              {label}
            </li>
          ))}
        </ul>
        {!terjawab ? (
          <button
            type="button"
            onClick={periksa}
            className="mt-3 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Periksa
          </button>
        ) : null}
      </div>
    );
  }

  // ---- hover_klik ----
  const [menuTerbuka, setMenuTerbuka] = useState(false);
  function renderHoverKlik() {
    const jawaban = JAWABAN_TUNGGAL(konfigurasi);
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onPointerEnter={() => setMenuTerbuka(true)}
          onClick={() => setMenuTerbuka((v) => !v)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {konfigurasi.menu ?? "Menu ▾"}
        </button>
        {menuTerbuka ? (
          <div className="mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {pisahlah(konfigurasi.pilihan ?? []).map((label) => (
              <button
                key={label}
                type="button"
                disabled={terjawab}
                onPointerEnter={() => setMenuTerbuka(true)}
                onClick={() =>
                  label === jawaban
                    ? jawabBenar()
                    : jawabSalah(label, "Menu itu belum tepat.")
                }
                className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">
          Arahkan kursor ke menu untuk membukanya, lalu klik pilihan yang benar.
        </p>
      </div>
    );
  }

  // ---- klik_bergerak ----
  const [pindeks, setPindeks] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setPindeks((p) => (p + 1) % POSISI_ITEM.length);
    }, 900);
    return () => window.clearInterval(id);
  }, []);
  function renderKlikBergerak() {
    const jawaban = JAWABAN_TUNGGAL(konfigurasi);
    const pos = POSISI_ITEM[pindeks % POSISI_ITEM.length];
    return (
      <div>
        <div className="relative h-56 w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-50">
          <button
            type="button"
            disabled={terjawab}
            onClick={() => jawabBenar(tikRef.current * 100)}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className="absolute rounded-xl border-2 border-emerald-500 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all"
          >
            {jawaban}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Kejar dan klik target yang bergerak (secepat mungkin).
        </p>
      </div>
    );
  }

  // ---- klik_beruntun ----
  const [terklik, setTerklik] = useState<string[]>([]);
  function renderKlikBeruntun() {
    const jumlah = konfigurasi.jumlah ?? 4;
    const daftar = (konfigurasi.pilihan ?? []).slice(0, jumlah);
    function klik(label: string) {
      if (terjawab || terklik.includes(label)) return;
      const baru = [...terklik, label];
      setTerklik(baru);
      if (baru.length >= daftar.length) jawabBenar(tikRef.current * 100);
    }
    return (
      <div>
        <div className="grid grid-cols-3 gap-3">
          {daftar.map((label, i) => {
            const sudah = terklik.includes(label);
            return (
              <button
                key={label}
                type="button"
                disabled={terjawab || sudah}
                onClick={() => klik(label)}
                className={`flex h-16 items-center justify-center rounded-xl border-2 text-lg font-bold transition ${
                  sudah
                    ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                    : "border-slate-300 bg-white text-slate-700 hover:border-sky-400"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Klik semua kotak secepat mungkin: {terklik.length}/{daftar.length}
        </p>
      </div>
    );
  }

  // ---- slider ----
  const [nilai, setNilai] = useState<number>(() => konfigurasi.min ?? 0);
  function renderSlider() {
    const target = konfigurasi.target ?? 50;
    const tol = konfigurasi.toleransi ?? 2;
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-slate-800">
          Geser hingga nilai <b>{target}</b>.
        </p>
        <input
          type="range"
          min={konfigurasi.min ?? 0}
          max={konfigurasi.max ?? 100}
          value={nilai}
          disabled={terjawab}
          onChange={(e) => {
            const v = Number(e.target.value);
            setNilai(v);
            if (Math.abs(v - target) <= tol) jawabBenar();
          }}
          className="w-full accent-emerald-600"
        />
        <p className="mt-2 text-sm text-slate-500">
          Nilai sekarang: <b className="tabular-nums">{nilai}</b>
        </p>
      </div>
    );
  }

  // ---- resize ----
  const [lebar, setLebar] = useState(120);
  const resizeRef = useRef<{ x: number; lebar: number } | null>(null);
  function renderResize() {
    const target = konfigurasi.ukuranTarget ?? 220;
    const tol = konfigurasi.toleransi ?? 12;
    function move(e: React.PointerEvent) {
      if (!resizeRef.current) return;
      const d = e.clientX - resizeRef.current.x;
      const w = Math.max(80, Math.min(360, resizeRef.current.lebar + d));
      setLebar(w);
      if (Math.abs(w - target) <= tol) jawabBenar();
    }
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-slate-800">
          Tarik sudut untuk mengubah lebar kotak menjadi ± {target}px.
        </p>
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div
            style={{ width: lebar }}
            className="relative flex h-24 items-center justify-center rounded-lg bg-sky-100 text-sm font-medium text-sky-700"
          >
            {Math.round(lebar)}px
            <span
              onPointerDown={(e) => {
                if (terjawab) return;
                resizeRef.current = { x: e.clientX, lebar };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={move}
              onPointerUp={() => {
                resizeRef.current = null;
              }}
              className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize rounded-sm bg-sky-600"
            />
          </div>
        </div>
      </div>
    );
  }

  // ---- pan ----
  const [geser, setGeser] = useState({ x: 0, y: 0 });
  const geserRef = useRef({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number; gx: number; gy: number } | null>(null);
  function renderPan() {
    function move(e: React.PointerEvent) {
      if (!panRef.current) return;
      const d = panRef.current;
      const baru = {
        x: d.gx + (e.clientX - d.x),
        y: d.gy + (e.clientY - d.y),
      };
      geserRef.current = baru;
      setGeser(baru);
    }
    return (
      <div>
        <div
          onPointerDown={(e) => {
            if (terjawab) return;
            panRef.current = { x: e.clientX, y: e.clientY, gx: geser.x, gy: geser.y };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={move}
          onPointerUp={() => {
            panRef.current = null;
            // target dianggap tercapai bila sudah digeser cukup
            if (geserRef.current.x < -120) jawabBenar();
          }}
          className="relative h-44 w-full touch-none overflow-hidden rounded-xl border border-slate-300 bg-slate-100"
          data-area="pan"
        >
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${geser.x}px, ${geser.y}px)` }}
          >
            <span className="absolute top-6 left-6 text-xs text-slate-500">
              geser →
            </span>
            <span className="absolute top-20 left-[300px] rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
              {konfigurasi.tujuan ?? "Target"}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tahan klik lalu geser (pan) ke kanan sampai target terlihat.
        </p>
      </div>
    );
  }

  function renderTantangan() {
    switch (jenis) {
      case "klik":
        return kartuKlik("klik");
      case "klik_kanan":
        return (
          <div onContextMenu={(e) => e.preventDefault()}>
            {kartuKlik("kanan")}
            <p className="mt-2 text-xs text-slate-500">
              Petunjuk: gunakan tombol kanan mouse.
            </p>
          </div>
        );
      case "klik_ganda":
        return (
          <div>
            {kartuKlik("ganda")}
            <p className="mt-2 text-xs text-slate-500">
              Petunjuk: klik dua kali cepat dengan tombol kiri.
            </p>
          </div>
        );
      case "hover":
        return (
          <div>
            {kartuKlik("hover")}
            <p className="mt-2 text-xs text-slate-500">
              Petunjuk: arahkan kursor (tanpa klik) dan tahan.
            </p>
          </div>
        );
      case "kuis":
        return renderKuis();
      case "drag":
        return renderDrag();
      case "scroll":
        return renderScroll();
      case "seleksi":
        return renderSeleksi();
      case "pilih_banyak":
        return renderPilihBanyak();
      case "seret_kotak":
        return renderSeretKotak();
      case "seret_jalur":
        return renderSeretJalur();
      case "drag_urut":
        return renderDragUrut();
      case "hover_klik":
        return renderHoverKlik();
      case "klik_bergerak":
        return renderKlikBergerak();
      case "klik_beruntun":
        return renderKlikBeruntun();
      case "slider":
        return renderSlider();
      case "resize":
        return renderResize();
      case "pan":
        return renderPan();
      default:
        return (
          <p className="text-sm text-slate-500">Jenis tantangan belum didukung.</p>
        );
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Level {level} — {judul}
          </h2>
          <Badge varian="netral">{poin} poin</Badge>
          {selesai ? (
            <Badge varian="sukses" titik>
              Selesai
            </Badge>
          ) : null}
          <span className="text-xs text-slate-400">Percobaan: {percobaan}</span>
          {waktuMs != null ? (
            <span className="text-xs text-slate-400">
              Waktu: {(waktuMs / 1000).toFixed(1)} s
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            📖 Materi ringkas
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
            {penjelasan}
          </p>
          {contoh ? (
            <p className="mt-2 text-xs text-slate-500">Contoh: {contoh}</p>
          ) : null}
        </div>

        <div className={`mt-4 ${tanpaSeleksi ? "select-none" : ""}`}>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            🎯 Tantangan
          </p>
          <p className="mt-1 mb-3 text-sm font-medium text-slate-800">
            {instruksi}
          </p>
          {renderTantangan()}
        </div>

        {pesan ? (
          <div
            className={`mt-4 rounded-xl p-3 text-sm ring-1 ${
              terjawab
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
          >
            {pesan}
          </div>
        ) : null}

        {terjawab ? (
          <div className="mt-4 flex items-center gap-2">
            {berikutLevel ? (
              <Link
                href={`/siswa/komputer/${lessonId}/${berikutLevel}`}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Lanjut ke Level {berikutLevel} →
              </Link>
            ) : (
              <Link
                href={`/siswa/komputer/${lessonId}`}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Selesai — kembali ke daftar
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Utilitas kecil: pisahkan pilihan (untuk menu) tanpa acak agar urutan menu wajar.
function pisahlah(arr: string[]): string[] {
  return arr;
}
