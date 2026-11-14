import Link from "next/link";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createSiswaClient } from "@/lib/supabase/siswa";
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
import { IkonJam, IkonNilai, IkonUlangan } from "@/components/ui/ikon-siswa";
import {
  formatTanggalJamPendekWib,
  formatTanggalWib,
} from "@/lib/waktu";

// ============================================================================
// Halaman daftar ulangan siswa.
// Fokus: ulangan apa saja yang bisa dikerjakan dan mana yang sudah selesai.
// Nilai & grafik tetap ada di menu "Nilai".
// ============================================================================

type StatusView = {
  label: string;
  varian: "netral" | "info" | "sukses" | "bahaya" | "peringatan";
};

function statusUlangan(u: {
  status: "akan" | "sudah";
  dibuka: boolean;
  bolehSoal: boolean;
  deadlineLewat: boolean;
  sudahSubmit: boolean;
  belumWaktunya: boolean;
  punyaSesi: boolean;
}): StatusView {
  if (u.status === "akan") {
    if (u.sudahSubmit)
      return { label: "Sudah dikerjakan", varian: "sukses" };
    if (!u.dibuka) return { label: "Ditutup guru", varian: "bahaya" };
    if (u.punyaSesi && !u.deadlineLewat)
      return { label: "Sedang dikerjakan", varian: "info" };
    if (!u.bolehSoal) return { label: "Ditutup guru", varian: "bahaya" };
    if (u.deadlineLewat) return { label: "Lewat tenggat", varian: "netral" };
    if (u.belumWaktunya)
      return { label: "Dijadwalkan", varian: "peringatan" };
    return { label: "Bisa dikerjakan", varian: "info" };
  }
  return {
    label: u.dibuka ? "Selesai" : "Selesai (ditutup)",
    varian: "sukses",
  };
}

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
    (u.bolehSoal || u.punyaSesi) &&
    u.dibuka
  );
}

export default async function UlanganSiswaPage() {
  const { siswa, kelas } = await requireSiswa();
  const supabase = await createSiswaClient();

  const [
    hasilUlangan,
    hasilSubmit,
    hasilSesi,
    pengaturanSoal,
    hasilBagikan,
    hasilNilai,
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(
        "id, judul, kelas_id, tanggal, status, tenggat, durasi, dibuka, exam_classes(kelas_id)",
      ),
    supabase
      .from("exam_submissions")
      .select("exam_id")
      .eq("siswa_id", siswa.id),
    supabase
      .from("exam_sessions")
      .select("exam_id")
      .eq("siswa_id", siswa.id),
    ambilPengaturanSoal(supabase),
    // Tahap 48: status bagikan nilai untuk tombol "Lihat nilai".
    supabase.from("exams").select("id, bagikan_nilai"),
    // Nilai yang sudah ada untuk siswa ini (termasuk nilai manual guru).
    supabase
      .from("exam_scores")
      .select("exam_id")
      .eq("siswa_id", siswa.id),
  ]);

  const setBagikan = new Set(
    ((hasilBagikan.data ?? []) as { id: string; bagikan_nilai: boolean }[])
      .filter((row) => row.bagikan_nilai === true)
      .map((row) => row.id),
  );

  const setNilai = new Set(
    (hasilNilai.data ?? []).map(
      (n) => (n as { exam_id: string }).exam_id,
    ),
  );

  const setSubmit = new Set(
    (hasilSubmit.data ?? []).map((s) => (s as { exam_id: string }).exam_id),
  );
  const setSesi = new Set(
    (hasilSesi.data ?? []).map((s) => (s as { exam_id: string }).exam_id),
  );

  const daftar = (hasilUlangan.data ?? []).flatMap((u) => {
    const row = u as {
      id: string;
      judul: string;
      kelas_id: string | null;
      tanggal: string | null;
      status: "akan" | "sudah";
      tenggat: string | null;
      durasi: number | null;
      dibuka: boolean | null;
      exam_classes?: { kelas_id: string }[];
    };

    const daftarKelasId = ambilKelasUlangan(row);
    const relevanUntukSiswa =
      daftarKelasId.length === 0 ||
      (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

    if (!relevanUntukSiswa) return [];

    const statusRow = row.status ?? "sudah";
    const dibukaRow = row.dibuka !== false;
    const deadlineLewat =
      statusRow === "akan" &&
      tenggatSudahLewat(row.tenggat) &&
      dibukaRow;
    const belumWaktunya =
      statusRow === "akan" && belumWaktunyaMulai(row.tanggal);
    const bolehSoal = ulanganBolehDiakses(pengaturanSoal, dibukaRow);

    // Detail hanya bisa dibuka bila ulangan tidak sedang ditutup / kehabisan
    // waktu. Tutup akses soal global hanya relevan untuk ulangan yang masih
    // berjalan (status "akan"); ulangan "sudah" tetap boleh dilihat detailnya.
    const terkunci =
      !dibukaRow || (statusRow === "akan" && (!bolehSoal || deadlineLewat));
    const alasanTerkunci = !dibukaRow
      ? "Ulangan sudah ditutup guru"
      : deadlineLewat
        ? "Waktu ulangan sudah habis"
        : "Akses soal sedang ditutup guru";

    return [
      {
        id: row.id,
        judul: row.judul,
        tanggal: row.tanggal,
        status: statusRow,
        tenggat: row.tenggat,
        durasi: row.durasi,
        dibuka: dibukaRow,
        dibagikan: setBagikan.has(row.id),
        punyaNilai: setSubmit.has(row.id) || setNilai.has(row.id),
        bolehSoal,
        punyaSesi: setSesi.has(row.id),
        deadlineLewat,
        belumWaktunya,
        sudahSubmit: setSubmit.has(row.id),
        terkunci,
        alasanTerkunci,
      },
    ];
  });

  // Urutan: yang aktif bisa dikerjakan → yang dijadwalkan → sisanya,
  // lalu yang terbaru.
  const peringkat = (u: (typeof daftar)[number]) => {
    if (bisaDikerjakan(u) && !u.belumWaktunya) return 0;
    if (bisaDikerjakan(u) && u.belumWaktunya) return 1;
    return 2;
  };
  const urut = [...daftar].sort((a, b) => {
    const selisih = peringkat(a) - peringkat(b);
    if (selisih !== 0) return selisih;
    return (b.tanggal ?? "").localeCompare(a.tanggal ?? "");
  });

  const jumlahBisa = daftar.filter(
    (u) => bisaDikerjakan(u) && !u.belumWaktunya,
  ).length;
  const jumlahTerjadwal = daftar.filter(
    (u) => bisaDikerjakan(u) && u.belumWaktunya,
  ).length;
  const jumlahSudah = daftar.filter((u) => u.sudahSubmit).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ulangan</h1>
        <p className="mt-1 text-sm text-slate-500">
          {kelas?.nama_kelas ?? "Belum ada kelas"} ·{" "}
          {pengaturanSoal.tutupUlangan
            ? "Akses soal ditutup guru"
            : jumlahBisa > 0
              ? `${jumlahBisa} ulangan bisa dikerjakan`
              : jumlahTerjadwal > 0
                ? `${jumlahTerjadwal} ulangan dijadwalkan`
                : "Tidak ada ulangan yang menunggu"}
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
          label="Bisa Dikerjakan"
          nilai={jumlahBisa}
          warna="biru"
          aksen="biru"
          ikon={<IkonUlangan className="h-4 w-4" />}
        />
        <KartuStat
          label="Dijadwalkan"
          nilai={jumlahTerjadwal}
          warna="amber"
          aksen="amber"
          ikon={<IkonJam className="h-4 w-4" />}
        />
        <KartuStat
          label="Sudah Dikerjakan"
          nilai={jumlahSudah}
          warna="emerald"
          aksen="emerald"
          ikon={<IkonNilai className="h-4 w-4" />}
        />
      </div>

      <Kartu>
        <KartuJudul
          judul="Daftar Ulangan"
          subjudul={`${daftar.length} ulangan`}
        />

        {urut.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {urut.map((u) => {
              const status = statusUlangan(u);
              const aksesSoal = statusAksesSoal(u);
              const boleh = bisaDikerjakan(u);
              return (
                <li key={u.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{u.judul}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                        {u.tanggal ? (
                          <>
                            <span>
                              Jadwal: {formatTanggalWib(u.tanggal)}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        ) : null}
                        <span>
                          Tenggat:{" "}
                          {u.tenggat
                            ? formatTanggalJamPendekWib(u.tenggat)
                            : "tanpa tenggat"}
                        </span>
                        {u.durasi ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{u.durasi} menit</span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge varian={status.varian} titik>
                        {status.label}
                      </Badge>
                      {aksesSoal ? (
                        <Badge varian={aksesSoal.varian}>
                          {aksesSoal.label}
                        </Badge>
                      ) : null}
                      {boleh ? (
                        <Link
                          href={`/siswa/ulangan/${u.id}/konfirmasi`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
                        >
                          {u.belumWaktunya
                            ? "Lihat jadwal"
                            : u.punyaSesi
                              ? "Lanjutkan"
                              : "Kerjakan"}
                        </Link>
                      ) : (
                        <>
                          {u.terkunci ? (
                            <button
                              type="button"
                              disabled
                              title={u.alasanTerkunci}
                              className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-400 opacity-60"
                            >
                              Detail
                            </button>
                          ) : (
                            <Link
                              href={
                                u.sudahSubmit
                                  ? `/siswa/ulangan/${u.id}`
                                  : `/siswa/ulangan/${u.id}/konfirmasi`
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              Detail
                            </Link>
                          )}

                          {u.dibagikan && u.punyaNilai ? (
                            <Link
                              href={`/siswa/nilai/${u.id}?nilai=1`}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500"
                            >
                              Lihat nilai
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title={
                                !u.dibagikan
                                  ? "Nilai belum dibagikan guru"
                                  : "Nilai belum tersedia"
                              }
                              className="cursor-not-allowed rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-400 opacity-60"
                            >
                              Lihat nilai
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            padat
            ikon={<IkonUlangan className="h-5 w-5" />}
            judul="Belum ada ulangan"
            keterangan="Ulangan dari gurumu akan muncul di sini."
          />
        )}
      </Kartu>
    </div>
  );
}
