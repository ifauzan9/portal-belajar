import Link from "next/link";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createSiswaClient } from "@/lib/supabase/siswa";
import { hitungRataRata, tampilkanRataRata } from "@/lib/rata-rata";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { belumWaktunyaMulai } from "@/lib/jadwal-ulangan";
import {
  ambilPengaturanSoal,
  ulanganBolehDiakses,
} from "@/lib/pengaturan-soal";
import { statusAksesSoal } from "@/lib/status-soal";
import { PemberitahuanSoalDitutup } from "@/components/pemberitahuan-soal";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { KartuStat } from "@/components/ui/kartu-stat";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonNilai } from "@/components/ui/ikon-siswa";
import { formatTanggalBulanWib, formatTanggalWib } from "@/lib/waktu";

function tanggalPendek(iso: string | null): string {
  return formatTanggalWib(iso);
}

// Label status untuk satu ulangan (dipakai di tabel desktop & kartu mobile).
type StatusView = { label: string; varian: "bahaya" | "netral" | "sukses" | "info" | "peringatan" };

function statusUlangan(u: {
  status: "akan" | "sudah";
  dibuka: boolean;
  bolehSoal: boolean;
  deadlineLewat: boolean;
  sudahSubmit: boolean;
  punyaSesi: boolean;
  belumWaktunya: boolean;
  tenggat: string | null;
}): StatusView {
  if (u.status === "akan") {
    if (u.sudahSubmit)
      return { label: "Sudah dikerjakan", varian: "sukses" };
    if (!u.dibuka) return { label: "Ditutup guru", varian: "bahaya" };
    if (u.punyaSesi) return { label: "Sedang dikerjakan", varian: "info" };
    if (!u.bolehSoal) return { label: "Ditutup guru", varian: "bahaya" };
    if (u.deadlineLewat) return { label: "Ditutup", varian: "netral" };
    if (u.belumWaktunya)
      return { label: "Dijadwalkan", varian: "peringatan" };
    const tgl = u.tenggat
      ? formatTanggalBulanWib(u.tenggat)
      : "Tanpa tenggat";
    return { label: `Buka · ${tgl}`, varian: "info" };
  }
  return {
    label: u.dibuka ? "Selesai" : "Selesai (ditutup)",
    varian: "sukses",
  };
}

// Boleh dikerjakan sekarang?
function bisaDikerjakan(u: {
  status: "akan" | "sudah";
  sudahSubmit: boolean;
  deadlineLewat: boolean;
  dibuka: boolean;
  bolehSoal: boolean;
  punyaSesi: boolean;
}): boolean {
  return (
    u.status === "akan" &&
    !u.sudahSubmit &&
    !u.deadlineLewat &&
    u.dibuka &&
    (u.bolehSoal || u.punyaSesi)
  );
}

export default async function NilaiSiswaPage() {
  const { siswa, kelas } = await requireSiswa();
  const supabase = await createSiswaClient();

  const [
    { data: ulanganData },
    { data: sesiData },
    pengaturanSoal,
    { data: bagikanData },
  ] =
    await Promise.all([
      supabase
        .from("exams")
        .select(
          "id, judul, kelas_id, tanggal, status, tenggat, durasi, dibuka, exam_scores(nilai, siswa_id), exam_classes(kelas_id), exam_submissions(nilai_total, siswa_id)",
        ),
      supabase
        .from("exam_sessions")
        .select("exam_id")
        .eq("siswa_id", siswa.id),
      ambilPengaturanSoal(supabase),
      // Tahap 48: status bagikan nilai per ulangan. Kalau kolom belum ada,
      // query ini gagal → semua dianggap belum dibagikan.
      supabase.from("exams").select("id, bagikan_nilai"),
    ]);

  // Hanya ulangan dengan bagikan_nilai = true yang nilainya boleh tampil.
  const setBagikan = new Set(
    ((bagikanData ?? []) as { id: string; bagikan_nilai: boolean }[])
      .filter((row) => row.bagikan_nilai === true)
      .map((row) => row.id),
  );

  const setSesi = new Set(
    (sesiData ?? []).map((s) => (s as { exam_id: string }).exam_id),
  );

  // Cek submit per siswa untuk ulangan bersoal
  const { data: submitData } = await supabase
    .from("exam_submissions")
    .select("exam_id, siswa_id, nilai_total, disubmit_at")
    .eq("siswa_id", siswa.id);

  const mapSubmit = new Map(
    (submitData ?? []).map((s) => [
      (s as { exam_id: string }).exam_id,
      s as { nilai_total: number; disubmit_at: string },
    ]),
  );

  // Ulangan yang relevan untuk siswa ini:
  //  - kelas siswa ada di daftar ulangan (gabungan legacy + relasi), atau
  //  - ulangan "semua kelas" (tidak ada kelas sama sekali).
  // Siswa tanpa kelas tetap melihat ulangan "semua kelas".
  const daftarUlangan = (ulanganData ?? []).flatMap((u) => {
    const row = u as {
      id: string;
      judul: string;
      kelas_id: string | null;
      tanggal: string | null;
      status: "akan" | "sudah";
      tenggat: string | null;
      durasi: number | null;
      dibuka: boolean | null;
      exam_scores?: { nilai: number; siswa_id: string }[];
      exam_classes?: { kelas_id: string }[];
    };

    const daftarKelasId = ambilKelasUlangan(row);
    const relevanUntukSiswa =
      daftarKelasId.length === 0 ||
      (siswa.kelas_id !== null &&
        daftarKelasId.includes(siswa.kelas_id));

    if (!relevanUntukSiswa) {
      return [];
    }

    const nilaiSiswaRaw =
      row.exam_scores?.find((n) => n.siswa_id === siswa.id)?.nilai ??
      mapSubmit.get(row.id)?.nilai_total ??
      null;

    // Tahap 48: nilai hanya tampil bila guru sudah membagikannya.
    const dibagikan = setBagikan.has(row.id);
    const nilaiSiswa = dibagikan ? nilaiSiswaRaw : null;

    const statusRow = row.status ?? "sudah";
    // Ulangan ditutup guru (kolom baru; null = DDL belum jalan → anggap dibuka)
    const dibukaRow = row.dibuka !== false;
    const deadlineLewat =
      statusRow === "akan" &&
      tenggatSudahLewat(row.tenggat) &&
      dibukaRow;
    const sudahSubmit = mapSubmit.has(row.id);
    const belumWaktunya =
      statusRow === "akan" && belumWaktunyaMulai(row.tanggal);
    const bolehSoal = ulanganBolehDiakses(pengaturanSoal, dibukaRow);

    return [
      {
        id: row.id,
        judul: row.judul,
        tanggal: row.tanggal,
        nilai: nilaiSiswa,
        dibagikan,
        status: statusRow,
        tenggat: row.tenggat,
        deadlineLewat,
        belumWaktunya,
        dibuka: dibukaRow,
        bolehSoal,
        punyaSesi: setSesi.has(row.id),
        sudahSubmit,
        aksesSoal: statusAksesSoal({
          status: statusRow,
          dibuka: dibukaRow,
          bolehSoal,
          deadlineLewat,
          belumWaktunya,
        }),
      },
    ];
  });

  const nilaiTerisi = daftarUlangan
    .filter((u) => u.nilai !== null)
    .map((u) => u.nilai as number);
  const rataSaya = hitungRataRata(nilaiTerisi);

  // Grafik batang (nilainya 0–100).
  const batang = daftarUlangan
    .filter((u) => u.nilai !== null)
    .map((u) => ({ ...u, proporsi: (u.nilai as number) / 100 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Nilai Ulangan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {kelas?.nama_kelas ?? "Belum ada kelas"} ·{" "}
          {nilaiTerisi.length} ulangan dinilai
        </p>
      </div>

      {pengaturanSoal.tutupUlangan ? (
        <PemberitahuanSoalDitutup
          jenis="ulangan"
          pesan={pengaturanSoal.pesan}
        />
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <KartuStat
          label="Rata-rata"
          nilai={tampilkanRataRata(rataSaya)}
          warna="emerald"
          ikon={<IkonNilai className="h-4 w-4" />}
        />
        <KartuStat
          label="Tertinggi"
          nilai={nilaiTerisi.length ? Math.max(...nilaiTerisi) : "–"}
        />
        <KartuStat
          label="Terendah"
          nilai={nilaiTerisi.length ? Math.min(...nilaiTerisi) : "–"}
        />
      </div>

      {/* Grafik batang */}
      <Kartu>
        <KartuJudul
          judul="Grafik Nilai per Ulangan"
          subjudul="Batang menunjukkan nilai kamu (skala 0–100). Hijau ≥ 70, kuning ≥ 50, merah < 50."
        />

        {batang.length > 0 ? (
          <div className="mt-4 space-y-3">
            {batang.map((u) => {
              const n = u.nilai as number;
              const warna =
                n >= 70
                  ? "bg-emerald-500"
                  : n >= 50
                    ? "bg-amber-500"
                    : "bg-red-400";
              return (
                <div key={u.id} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate text-slate-600 sm:w-40">
                    {u.judul}
                  </span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className={`h-full ${warna} transition-all`}
                      style={{ width: `${Math.min(100, u.proporsi * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums font-medium text-slate-700">
                    {u.nilai}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            padat
            ikon={<IkonNilai className="h-5 w-5" />}
            judul="Belum ada nilai yang terisi"
            keterangan="Grafik muncul setelah gurumu membagikan nilai."
          />
        )}
      </Kartu>

      {/* Rincian: kartu di mobile, tabel di desktop */}
      <Kartu>
        <KartuJudul
          judul="Rincian per Ulangan"
          subjudul={`${daftarUlangan.length} ulangan`}
        />

        {daftarUlangan.length > 0 ? (
          <>
            {/* Mobile: daftar kartu */}
            <ul className="mt-3 space-y-2 md:hidden">
              {daftarUlangan.map((u) => {
                const s = statusUlangan(u);
                const boleh = bisaDikerjakan(u);
                return (
                  <li
                    key={u.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-medium text-slate-900">
                        {u.judul}
                      </span>
                      <div className="shrink-0 text-right">
                        <span className="text-lg font-semibold tabular-nums text-slate-900">
                          {u.nilai === null ? "–" : u.nilai}
                        </span>
                        {u.nilai === null && !u.dibagikan ? (
                          <p className="text-[10px] text-slate-400">
                            Belum dibagikan
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge varian={s.varian}>{s.label}</Badge>
                      {u.aksesSoal ? (
                        <Badge varian={u.aksesSoal.varian}>
                          {u.aksesSoal.label}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-slate-400">
                        {tanggalPendek(u.tanggal)}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {boleh ? (
                        <Link
                          href={`/siswa/ulangan/${u.id}/konfirmasi`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
                        >
                          {u.belumWaktunya ? "Lihat jadwal" : "Kerjakan"}
                        </Link>
                      ) : null}
                      <Link
                        href={`/siswa/nilai/${u.id}?nilai=1`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Lihat detail
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: tabel */}
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {["Ulangan", "Tanggal", "Status", "Nilai", "Aksi"].map(
                      (h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {daftarUlangan.map((u) => {
                    const s = statusUlangan(u);
                    const boleh = bisaDikerjakan(u);
                    return (
                      <tr key={u.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {u.judul}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {tanggalPendek(u.tanggal)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge varian={s.varian}>{s.label}</Badge>
                            {u.aksesSoal ? (
                              <Badge varian={u.aksesSoal.varian}>
                                {u.aksesSoal.label}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-slate-700">
                          {u.nilai === null ? "–" : u.nilai}
                          {u.nilai === null && !u.dibagikan ? (
                            <span className="block text-[11px] font-normal text-slate-400">
                              Belum dibagikan
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {boleh ? (
                              <Link
                                href={`/siswa/ulangan/${u.id}/konfirmasi`}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
                              >
                                {u.belumWaktunya ? "Lihat jadwal" : "Kerjakan"}
                              </Link>
                            ) : null}
                            <Link
                              href={`/siswa/nilai/${u.id}?nilai=1`}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                            >
                              Lihat detail
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            padat
            ikon={<IkonNilai className="h-5 w-5" />}
            judul="Belum ada ulangan"
            keterangan="Ulangan dari guru akan muncul di sini."
          />
        )}
      </Kartu>
    </div>
  );
}
