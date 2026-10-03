"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteUlangan,
  toggleUlangan,
  updateUlangan,
} from "@/app/guru/ulangan/actions";
import { PilihKelasMulti } from "@/components/pilih-kelas-multi";

type Kelas = { id: string; nama_kelas: string };

export function BarisUlangan({
  nomor,
  id,
  judul,
  daftarKelasNama,
  tanggal,
  rataRata,
  kelasList,
  // Kode akses yang sudah diatur guru (null = belum ada)
  kodeAkses,
  // Status: "akan" (bersoal) atau "sudah" (manual)
  status,
  // Tenggat waktu ISO (untuk status "akan")
  tenggat,
  // Durasi pengerjaan dalam menit (null = tanpa timer)
  durasi,
  // Tampilkan nilai langsung setelah submit
  nilaiDitampilkan,
  // Jumlah soal yang sudah ada di ulangan ini
  jumlahSoal,
  // Apakah deadline sudah lewat (untuk badge)
  deadlineLewat,
  // Ulangan dibuka/ditutup oleh guru (false = siswa tidak bisa akses)
  dibuka,
}: {
  nomor: number;
  id: string;
  judul: string;
  // Nama-nama kelas (dari gabungan legacy + relasi). [] = semua kelas.
  daftarKelasNama: string[];
  tanggal: string;
  rataRata: string;
  kelasList: Kelas[];
  kodeAkses: string | null;
  status: "akan" | "sudah";
  tenggat: string | null;
  durasi: number | null;
  nilaiDitampilkan: boolean;
  jumlahSoal: number;
  deadlineLewat: boolean;
  dibuka: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [statusEdit, setStatusEdit] = useState<"akan" | "sudah">(status);

  // Dropdown aksi sekunder. Memakai posisi `fixed` supaya tidak
  // terpotong oleh `overflow-hidden` / `overflow-x-auto` tabel.
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [posMenu, setPosMenu] = useState<{ top: number; left: number } | null>(
    null,
  );

  const bukaTutupMenu = (terbuka: boolean) => {
    if (!terbuka) {
      setPosMenu(null);
      return;
    }
    const tombol = menuRef.current?.querySelector("summary");
    if (!tombol) return;
    const r = tombol.getBoundingClientRect();
    // Lebar menu 144px (w-36); tempelkan ke kanan tombol.
    setPosMenu({ top: r.bottom + 4, left: r.right - 144 });
  };

  // Tutup dropdown saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!posMenu) return;

    const tutup = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        menuRef.current.open = false;
        setPosMenu(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuRef.current) {
        menuRef.current.open = false;
        setPosMenu(null);
      }
    };

    document.addEventListener("mousedown", tutup);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", tutup);
      document.removeEventListener("keydown", onEsc);
    };
  }, [posMenu]);

  const [state, formAction, pending] = useActionState<
    { message: string | null },
    FormData
  >(async (_prev, formData) => {
    const result = await updateUlangan({ message: null }, formData);
    // Aksi sukses selalu mengembalikan pesan null, jadi tutup formnya.
    if (result.message === null) {
      setEditing(false);
    }
    return result;
  }, { message: null });

  // Id kelas yang tampil → untuk defaultValue form ubah.
  const daftarKelasIdAwal = daftarKelasNama.flatMap((nama) => {
    const ketemu = kelasList.find((k) => k.nama_kelas === nama);
    return ketemu ? [ketemu.id] : [];
  });

  const teksKelas =
    daftarKelasNama.length === 0
      ? "Semua kelas"
      : daftarKelasNama.length <= 3
        ? daftarKelasNama.join(", ")
        : `${daftarKelasNama.slice(0, 3).join(", ")}, +${
            daftarKelasNama.length - 3
          }`;

  // Badge status — varian "akan" menampilkan jumlah soal di bawah
  // (bukan melebar jadi badge panjang) supaya rapi dalam satu baris.
  // Prioritas: ditutup guru > waktu habis > akan dilaksanakan.
  const badgeStatus =
    status === "akan"
      ? !dibuka
        ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Ditutup guru
            </span>
          )
        : deadlineLewat
          ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Waktu habis
              </span>
            )
          : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Akan dilaksanakan
                {jumlahSoal > 0 ? ` · ${jumlahSoal} soal` : ""}
              </span>
            )
      : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Sudah dilaksanakan
            {!dibuka ? (
              <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700">
                ditutup
              </span>
            ) : null}
          </span>
        );

  // Teks tenggat singkat (untuk status "akan" yang belum lewat).
  const teksTenggat =
    status === "akan" && tenggat && !deadlineLewat
      ? (() => {
          const d = new Date(tenggat);
          if (Number.isNaN(d.getTime())) return null;
          return new Intl.DateTimeFormat("id-ID", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(d);
        })()
      : null;

  if (!editing) {
    return (
      <tr className="transition hover:bg-slate-50">
        <td className="px-4 py-3.5 text-slate-400 tabular-nums sm:px-5">
          {nomor}
        </td>
        <td className="max-w-[220px] px-4 py-3.5 font-medium text-slate-900 sm:px-5">
          <span className="block truncate" title={judul}>
            {judul}
          </span>
        </td>
        <td
          className="max-w-[160px] px-4 py-3.5 text-slate-600 sm:px-5"
          title={
            daftarKelasNama.length === 0
              ? "Berlaku untuk semua kelas"
              : daftarKelasNama.join(", ")
          }
        >
          <span className="block truncate">{teksKelas}</span>
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-slate-500 sm:px-5">
          {tanggal}
        </td>
        <td className="px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-1.5">
            {badgeStatus}
            {status === "akan" && durasi ? (
              <span
                title={`Durasi pengerjaan ${durasi} menit`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-[11px] text-amber-700 ring-1 ring-amber-200"
              >
                ⏱
              </span>
            ) : null}
            {status === "akan" && !nilaiDitampilkan ? (
              <span
                title="Nilai ditahan sampai guru menandai selesai dinilai"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-50 text-[11px] text-violet-700 ring-1 ring-violet-200"
              >
                🔒
              </span>
            ) : null}
          </div>
          {teksTenggat ? (
            <p className="mt-1 text-[11px] text-slate-400">
              Tenggat {teksTenggat}
            </p>
          ) : null}
        </td>
        <td className="px-4 py-3.5 text-right tabular-nums sm:px-5">
          {rataRata === "–" ? (
            <span className="text-slate-300">–</span>
          ) : (
            <span className="font-medium text-slate-900">{rataRata}</span>
          )}
        </td>
        <td className="px-4 py-3.5 sm:px-5">
          {kodeAkses ? (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
              {kodeAkses}
            </code>
          ) : (
            <span className="text-xs text-slate-300">–</span>
          )}
        </td>
        <td className="px-4 py-3.5 sm:px-5">
          <div className="flex items-center justify-end gap-1.5">
            {/* Aksi utama */}
            {status === "akan" ? (
              <Link
                href={`/guru/ulangan/${id}/soal`}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                Soal
              </Link>
            ) : null}
            <Link
              href={`/guru/ulangan/${id}/nilai`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Nilai
            </Link>

            {/* Aksi sekunder: dropdown titik-tiga (native details) */}
            <details
              ref={menuRef}
              className="relative"
              onToggle={(e) => bukaTutupMenu(e.currentTarget.open)}
            >
              <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="text-base leading-none">
                  ⋮
                </span>
              </summary>
              <div
                style={
                  posMenu
                    ? { top: posMenu.top, left: posMenu.left }
                    : undefined
                }
                className="fixed z-30 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setStatusEdit(status);
                    setEditing(true);
                  }}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Ubah
                </button>
                <form action={toggleUlangan}>
                  <input type="hidden" name="id" value={id} />
                  <button
                    type="submit"
                    onClick={(event) => {
                      const pesan = dibuka
                        ? `Tutup ulangan "${judul}" untuk siswa? Siswa tidak bisa lagi mengaksesnya.`
                        : `Buka kembali ulangan "${judul}" untuk siswa?`;
                      if (!confirm(pesan)) {
                        event.preventDefault();
                      }
                    }}
                    className={`flex w-full items-center px-3 py-1.5 text-left text-xs font-medium transition ${
                      dibuka
                        ? "text-amber-700 hover:bg-amber-50"
                        : "text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {dibuka ? "Tutup ulangan" : "Buka ulangan"}
                  </button>
                </form>
                <form action={deleteUlangan}>
                  <input type="hidden" name="id" value={id} />
                  <button
                    type="submit"
                    onClick={(event) => {
                      if (
                        !confirm(
                          `Yakin menghapus ulangan "${judul}"? Nilai dan jawaban siswa juga ikut terhapus.`,
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </form>
              </div>
            </details>
          </div>
        </td>
      </tr>
    );
  }

  // Tenggat default untuk form ubah (konversi ISO ke format
  // datetime-local: "YYYY-MM-DDTHH:MM")
  const tenggatDefault = tenggat
    ? (() => {
        const d = new Date(tenggat);
        if (Number.isNaN(d.getTime())) return "";
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : "";

  return (
    <tr className="bg-slate-50/60">
      <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
        {nomor}
      </td>
      <td colSpan={7} className="px-4 py-4 sm:px-5">
        {/* Form ubah mengisi sisa kolom (No sudah kolom sendiri). */}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />

          {/* Baris 1: Judul + Kelas + Tanggal */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_12rem]">
            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-500">
                Judul
              </label>
              <input
                name="judul"
                type="text"
                defaultValue={judul}
                required
                autoFocus
                placeholder="Judul ulangan"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-500">
                Kelas
              </label>
              <PilihKelasMulti
                daftarKelas={kelasList}
                awalTerpilih={daftarKelasIdAwal}
                compact
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-500">
                Tanggal
              </label>
              <input
                name="tanggal"
                type="date"
                defaultValue={tanggal === "-" ? "" : tanggal}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-40"
              />
            </div>
          </div>

          {/* Baris 2: Status + Tenggat + Durasi + Centang nilai + Kode akses */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_14rem_7rem_auto_9rem] sm:items-end">
            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-500">
                Status
              </label>
              <div className="flex gap-1">
                {(["sudah", "akan"] as const).map((nilaiStatus) => (
                  <label
                    key={nilaiStatus}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      statusEdit === nilaiStatus
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={nilaiStatus}
                      checked={statusEdit === nilaiStatus}
                      onChange={() => setStatusEdit(nilaiStatus)}
                      className="hidden"
                    />
                    {nilaiStatus === "sudah" ? "Sudah" : "Akan"}
                  </label>
                ))}
              </div>
            </div>

            {statusEdit === "akan" ? (
              <>
                <div>
                  <label className="mb-0.5 block text-xs font-medium text-slate-500">
                    Tenggat
                  </label>
                  <input
                    name="tenggat"
                    type="datetime-local"
                    defaultValue={tenggatDefault}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium text-slate-500">
                    Durasi (mnt)
                  </label>
                  <input
                    name="durasi"
                    type="number"
                    min={1}
                    max={9999}
                    defaultValue={durasi ?? ""}
                    placeholder="Opsional"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-24"
                  />
                </div>
                <label className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 sm:h-[38px]">
                  <input
                    type="checkbox"
                    name="tampilkan_nilai"
                    defaultChecked={nilaiDitampilkan}
                    className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                  />
                  Nilai langsung tampil
                </label>
              </>
            ) : (
              <>
                <div />
                <div />
                <div />
              </>
            )}

            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-500">
                Kode akses
              </label>
              <input
                name="access_code"
                type="text"
                defaultValue={kodeAkses ?? ""}
                placeholder="Opsional"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-36"
              />
            </div>
          </div>

          {/* Baris 3: Tombol simpan / batal */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Batal
            </button>
            {state.message ? (
              <p className="text-xs text-red-600">{state.message}</p>
            ) : null}
          </div>
        </form>
      </td>
    </tr>
  );
}
