import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createSiswaClient } from "@/lib/supabase/siswa";
import {
  ambilKelasUlangan,
  namaKelasDariIds,
} from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { belumWaktunyaMulai } from "@/lib/jadwal-ulangan";
import { formatTanggalWib, formatWaktuWib } from "@/lib/waktu";
import { ambilPengaturanSoal } from "@/lib/pengaturan-soal";
import { statusAksesSoal } from "@/lib/status-soal";
import { PemberitahuanSoalDitutup } from "@/components/pemberitahuan-soal";
import { Badge } from "@/components/ui/badge";
import { jenisSoalTersedia } from "@/lib/jenis-soal-ulangan";
import { ambilRankingUlangan } from "@/lib/ranking-ulangan";
import { nilaiDibagikan } from "@/lib/bagikan-nilai";
import {
  KartuPosisiRanking,
  PapanPeringkatSiswa,
  RankingTertahan,
} from "@/components/ranking-siswa";

// ============================================================================
// Detail nilai ulangan per siswa.
// Halaman dilindungi kode akses dari guru: tanpa ?kode=1 (kode sudah
// terverifikasi) siswa hanya melihat form input kode.
// Ulangan status "akan" juga bisa diakses langsung via /siswa/ulangan/[id].
// ============================================================================

import { FormKode } from "./form-kode";

export default async function DetailNilaiPage(props: PageProps<"/siswa/nilai/[id]">) {
  const { id } = await props.params;
  const { siswa } = await requireSiswa();
  const supabase = await createSiswaClient();

  const searchParams = await props.searchParams;
  const kodeTerbuka = searchParams.kode === "1";
  // ?nilai=1 = siswa memang membuka halaman untuk melihat nilai, bukan
  // untuk mengerjakan / melihat info ulangan.
  const mintaNilai = searchParams.nilai === "1";

  const [
    { data: ulangan, error: galatUlangan },
    pengaturanSoal,
    { data: infoBagikan },
  ] =
    await Promise.all([
      supabase
        .from("exams")
        .select(
          "id, judul, tanggal, kelas_id, access_code, status, tenggat, durasi, dibuka, exam_classes(kelas_id)",
        )
        .eq("id", id)
        .maybeSingle(),
      ambilPengaturanSoal(supabase),
      // Tahap 48: nilai hanya boleh tampil jika guru membagikannya.
      // Kalau kolom belum ada, query gagal → infoBagikan null → disembunyikan.
      supabase
        .from("exams")
        .select("bagikan_nilai")
        .eq("id", id)
        .maybeSingle(),
    ]);

  if (galatUlangan || !ulangan) {
    redirect("/siswa/nilai");
  }

  const dataUlangan = ulangan as unknown as {
    id: string;
    judul: string;
    tanggal: string | null;
    kelas_id: string | null;
    access_code: string | null;
    status: "akan" | "sudah";
    tenggat: string | null;
    durasi: number | null;
    dibuka: boolean | null;
    exam_classes?: { kelas_id: string }[];
  };

  const belumWaktunya =
    dataUlangan.status === "akan" &&
    belumWaktunyaMulai(dataUlangan.tanggal);

  // Apakah nilai boleh dilihat siswa? (Tahap 48: saklar bagikan nilai)
  const nilaiTerbuka = nilaiDibagikan(
    infoBagikan as { bagikan_nilai?: boolean | null } | null,
  );

  // Cek submit untuk ulangan bersoal
  let sudahSubmit = false;
  let submitInfo: {
    nilai_pg: number;
    nilai_esai: number;
    nilai_kode: number;
    nilai_kode_manual: number | null;
    nilai_total: number;
    disubmit_at: string;
  } | null = null;

  if (dataUlangan.status === "akan") {
    let submitData: unknown = null;

    const hasilSubmit = await supabase
      .from("exam_submissions")
      .select(
        "nilai_pg, nilai_esai, nilai_kode, nilai_kode_manual, nilai_total, disubmit_at",
      )
      .eq("exam_id", id)
      .eq("siswa_id", siswa.id)
      .maybeSingle();

    submitData = hasilSubmit.data;
    if (!submitData) {
      const fallback = await supabase
        .from("exam_submissions")
        .select("nilai_pg, nilai_esai, nilai_total, disubmit_at")
        .eq("exam_id", id)
        .eq("siswa_id", siswa.id)
        .maybeSingle();
      submitData = fallback.data;
    }

    if (submitData) {
      sudahSubmit = true;
      const row = submitData as {
        nilai_pg: number;
        nilai_esai: number;
        nilai_kode?: number;
        nilai_kode_manual?: number | null;
        nilai_total: number;
        disubmit_at: string;
      };
      submitInfo = {
        nilai_pg: row.nilai_pg,
        nilai_esai: row.nilai_esai,
        nilai_kode: row.nilai_kode ?? 0,
        nilai_kode_manual: row.nilai_kode_manual ?? null,
        nilai_total: row.nilai_total,
        disubmit_at: row.disubmit_at,
      };
    }
  }

  const deadlineLewat =
    dataUlangan.status === "akan" &&
    dataUlangan.dibuka !== false &&
    tenggatSudahLewat(dataUlangan.tenggat);

  // Ulangan ditutup guru (kolom baru; null = DDL belum jalan → anggap dibuka)
  const dibukaUlangan = dataUlangan.dibuka !== false;

  // Siswa yang sudah memulai ulangan tetap boleh melanjutkan walau saklar
  // global ditutup (soft close) supaya jawabannya tidak hilang.
  let punyaSesiUjian = false;
  if (dataUlangan.status === "akan" && !sudahSubmit) {
    const { data: sesiUjian } = await supabase
      .from("exam_sessions")
      .select("id")
      .eq("exam_id", id)
      .eq("siswa_id", siswa.id)
      .maybeSingle();
    punyaSesiUjian = Boolean(sesiUjian);
  }

  // Saklar global "tutup akses soal" (Tahap 41). Nilai yang sudah ada tetap
  // ditampilkan; hanya tombol mengerjakan yang dinonaktifkan.
  const soalDitutupGlobal = pengaturanSoal.tutupUlangan;
  const bolehKerjakan =
    dibukaUlangan && (!soalDitutupGlobal || punyaSesiUjian);
  const aksesSoal = statusAksesSoal({
    status: dataUlangan.status,
    dibuka: dibukaUlangan,
    bolehSoal: dibukaUlangan && !soalDitutupGlobal,
    deadlineLewat,
    belumWaktunya,
  });

  // Nama kelas untuk subtitle: gabung kolom lama + relasi baru.
  // [] berarti "Semua kelas".
  const daftarKelasId = ambilKelasUlangan(dataUlangan);
  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });
  const mapIdKeNama = new Map(
    ((kelasData ?? []) as { id: string; nama_kelas: string }[]).map(
      (k) => [k.id, k.nama_kelas],
    ),
  );
  const teksKelas =
    daftarKelasId.length === 0
      ? "Semua kelas"
      : namaKelasDariIds(daftarKelasId, mapIdKeNama).join(", ");

  // Nilai siswa ini untuk ulangan ini.
  const { data: nilaiData } = await supabase
    .from("exam_scores")
    .select("nilai")
    .eq("exam_id", id)
    .eq("siswa_id", siswa.id)
    .maybeSingle();

  const nilaiSaya = (nilaiData as { nilai: number } | null)?.nilai ?? null;

  // Jenis soal yang ada di ulangan ini. Menentukan kartu nilai mana yang
  // ditampilkan (ulangan koding-saja tidak perlu kartu PG/Esai).
  const { data: soalJenis } = await supabase
    .from("exam_questions")
    .select("jenis")
    .eq("exam_id", id);
  const jenisSoal = jenisSoalTersedia(
    (soalJenis as { jenis: string }[] | null)?.map((s) => s.jenis),
  );

  // Ranking seluruh siswa. Hanya dimuat bila memang akan ditampilkan:
  //  - ulangan "akan" + sudah submit, atau
  //  - ulangan "sudah" + kode akses sudah benar.
  // Ranking hanya dimuat bila nilainya memang sudah dibagikan.
  const perluRanking =
    nilaiTerbuka &&
    ((dataUlangan.status === "akan" && sudahSubmit) ||
      (dataUlangan.status === "sudah" && kodeTerbuka));
  const ranking = perluRanking
    ? await ambilRankingUlangan(
        supabase,
        id,
        daftarKelasId,
        mapIdKeNama,
        siswa.id,
      )
    : null;

  // Badge status
  const badgeStatus =
    dataUlangan.status === "akan" ? (
      sudahSubmit ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          Sudah dikerjakan
        </span>
      ) : !bolehKerjakan ? (
        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
          Ditutup guru
        </span>
      ) : deadlineLewat ? (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          Ditutup
        </span>
      ) : punyaSesiUjian ? (
        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
          Sedang dikerjakan
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
          Buka
          {dataUlangan.tenggat
            ? ` · ${formatTanggalWib(dataUlangan.tenggat)}`
            : ""}
        </span>
      )
    ) : (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        Selesai
      </span>
    );

  const badgeStatusLengkap = (
    <>
      {badgeStatus}
      {aksesSoal ? (
        <Badge varian={aksesSoal.varian}>{aksesSoal.label}</Badge>
      ) : null}
    </>
  );

  // Header yang dipakai bersama oleh tampilan nilai dan status tertahan.
  const headerHalaman = (
    <div>
      <Link
        href="/siswa/nilai"
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        ← Kembali ke Daftar Nilai
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">
        {dataUlangan.judul}
      </h1>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-500">
          Kelas: {teksKelas}
          {dataUlangan.tanggal ? ` · Tanggal: ${dataUlangan.tanggal}` : ""}
        </p>
        {badgeStatusLengkap}
      </div>
    </div>
  );

  const kartuNilaiSiswa = (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        Nilai kamu
      </p>
      <p
        className={`mt-1 text-4xl font-semibold tabular-nums ${
          nilaiSaya === null
            ? "text-slate-400"
            : nilaiSaya >= 70
              ? "text-emerald-600"
              : nilaiSaya >= 50
                ? "text-amber-600"
                : "text-red-600"
        }`}
      >
        {nilaiSaya === null ? "Belum dinilai" : nilaiSaya}
      </p>
      {nilaiSaya === null ? (
        <p className="mt-1 text-sm text-slate-500">
          Nilai kamu untuk ulangan ini belum tersedia. Kamu belum mengerjakan
          ulangan atau guru belum menginput nilainya.
        </p>
      ) : null}
    </div>
  );

  const halamanNilaiTertahan = (
    <div className="space-y-6">
      {headerHalaman}
      <div className="rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-200">
        <p className="text-sm font-semibold text-violet-800">
          🔒 Nilai belum dibagikan
        </p>
        <p className="mt-1 text-xs text-violet-600">
          Guru belum membagikan nilai ulangan ini. Coba cek lagi nanti.
        </p>
      </div>
    </div>
  );

  // Bila siswa membuka khusus untuk melihat nilai, jangan tampilkan pesan
  // "ulangan ditutup" — tampilkan status nilai yang sebenarnya.
  if (mintaNilai && !nilaiTerbuka) {
    return halamanNilaiTertahan;
  }

  if (mintaNilai && dataUlangan.status === "akan" && !sudahSubmit) {
    return (
      <div className="space-y-6">
        {headerHalaman}
        {kartuNilaiSiswa}
      </div>
    );
  }

  // Kalau ulangan "akan" dan belum submit → tampilkan form jawaban
  // (hanya kalau ulangan dibuka oleh guru; kalau ditutup, tampilkan pesan)
  if (dataUlangan.status === "akan" && !sudahSubmit) {
    if (!bolehKerjakan) {
      return (
        <div className="space-y-6">
          <div>
            <Link
              href="/siswa/nilai"
              className="text-sm text-slate-500 transition hover:text-slate-900"
            >
              ← Kembali ke Daftar Nilai
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {dataUlangan.judul}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
              {badgeStatusLengkap}
            </div>
          </div>

          {soalDitutupGlobal && dibukaUlangan ? (
            <PemberitahuanSoalDitutup
              jenis="ulangan"
              pesan={pengaturanSoal.pesan}
            />
          ) : (
            <div className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-100">
              <p className="text-sm font-medium text-red-700">
                Ulangan ditutup oleh guru
              </p>
              <p className="mt-1 text-xs text-red-600">
                Ulangan ini sementara tidak bisa dikerjakan. Nanti guru akan
                membukanya kembali.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (deadlineLewat) {
      return (
        <div className="space-y-6">
          <div>
            <Link
              href="/siswa/nilai"
              className="text-sm text-slate-500 transition hover:text-slate-900"
            >
              ← Kembali ke Daftar Nilai
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {dataUlangan.judul}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
              {badgeStatusLengkap}
            </div>
          </div>

          <div className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-100">
            <p className="text-sm font-medium text-red-700">
              Ulangan sudah ditutup
            </p>
            <p className="mt-1 text-xs text-red-600">
              Tenggat waktu sudah lewat. Hubungi gurumu kalau ada masalah.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/siswa/nilai"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Kembali ke Daftar Nilai
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {dataUlangan.judul}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
            {badgeStatusLengkap}
          </div>
        </div>

        {soalDitutupGlobal && punyaSesiUjian ? (
          <PemberitahuanSoalDitutup
            jenis="ulangan"
            pesan={pengaturanSoal.pesan}
          />
        ) : null}

        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Mengerjakan Ulangan
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {dataUlangan.tenggat
              ? `Tenggat: ${formatWaktuWib(dataUlangan.tenggat)}`
              : "Tanpa tenggat waktu."}{" "}
            {belumWaktunya
              ? `Ulangan dijadwalkan mulai ${formatTanggalWib(
                  dataUlangan.tanggal,
                )}.`
              : "Buka halaman konfirmasi untuk melihat informasi sebelum mulai."}
          </p>
          <Link
            href={`/siswa/ulangan/${id}/konfirmasi`}
            className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {belumWaktunya
              ? "Lihat jadwal →"
              : punyaSesiUjian
                ? "Lanjutkan Pengerjaan →"
                : "Kerjakan Sekarang →"}
          </Link>
        </div>
      </div>
    );
  }

  // Kalau ulangan "akan" dan sudah submit → tampilkan hasil
  if (dataUlangan.status === "akan" && sudahSubmit && submitInfo) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/siswa/nilai"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Kembali ke Daftar Nilai
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {dataUlangan.judul}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
            {badgeStatusLengkap}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Hasil kamu
          </p>

          {nilaiTerbuka ? (
            <>
              {(() => {
                const nilaiKode =
                  submitInfo.nilai_kode_manual ?? submitInfo.nilai_kode;

                // Kartu hanya untuk jenis soal yang ada di ulangan.
                // "Total" selalu tampil paling akhir.
                const kartu: {
                  label: string;
                  nilai: number;
                  latar: string;
                  warnaLabel: string;
                  warnaAngka: string;
                  sub?: string;
                  warnaSub?: string;
                }[] = [];

                if (jenisSoal.pg) {
                  kartu.push({
                    label: "Nilai PG",
                    nilai: submitInfo.nilai_pg,
                    latar: "bg-blue-50",
                    warnaLabel: "text-blue-600",
                    warnaAngka: "text-blue-700",
                  });
                }
                if (jenisSoal.esai) {
                  kartu.push({
                    label: "Nilai Esai",
                    nilai: submitInfo.nilai_esai,
                    latar: "bg-amber-50",
                    warnaLabel: "text-amber-600",
                    warnaAngka: "text-amber-700",
                  });
                }
                if (jenisSoal.kode) {
                  kartu.push({
                    label: "Nilai Kode",
                    nilai: nilaiKode,
                    latar: "bg-emerald-50",
                    warnaLabel: "text-emerald-600",
                    warnaAngka: "text-emerald-700",
                    sub:
                      submitInfo.nilai_kode_manual !== null
                        ? "dinilai guru"
                        : undefined,
                    warnaSub: "text-emerald-500",
                  });
                }

                const jumlahKartu = kartu.length + 1; // + Total
                const kelasGrid =
                  jumlahKartu === 2
                    ? "grid-cols-2"
                    : jumlahKartu === 3
                      ? "grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-4";

                return (
                  <>
                    <div className={`mt-3 grid gap-3 ${kelasGrid}`}>
                      {kartu.map((k) => (
                        <div
                          key={k.label}
                          className={`rounded-xl p-3 text-center ${k.latar}`}
                        >
                          <p className={`text-xs ${k.warnaLabel}`}>{k.label}</p>
                          <p
                            className={`text-2xl font-semibold tabular-nums ${k.warnaAngka}`}
                          >
                            {k.nilai}
                          </p>
                          {k.sub ? (
                            <p className={`text-[10px] ${k.warnaSub}`}>
                              {k.sub}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      <div className="rounded-xl bg-slate-100 p-3 text-center">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-2xl font-semibold tabular-nums text-slate-900">
                          {submitInfo.nilai_total}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      {jenisSoal.esai && submitInfo.nilai_esai === 0
                        ? "Nilai esai masih menunggu penilaian guru."
                        : "Nilai sudah lengkap."}
                    </p>
                  </>
                );
              })()}
            </>
          ) : (
            <div className="mt-3 rounded-xl bg-violet-50 p-4 ring-1 ring-violet-200">
              <p className="text-sm font-medium text-violet-800">
                📋 Jawaban sudah dikumpulkan
              </p>
              <p className="mt-1 text-xs text-violet-600">
                Nilai kamu belum dibagikan oleh guru. Nilai akan muncul di sini
                setelah guru membagikannya.
              </p>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            Submit: {formatWaktuWib(submitInfo.disubmit_at)}
          </p>
        </div>

        {/* Ranking: penuh bila nilai terbuka, terkunci bila masih ditahan. */}
        {ranking ? (
          nilaiTerbuka ? (
            <>
              <KartuPosisiRanking
                posisi={ranking.posisiSaya}
                totalDinilai={ranking.totalDinilai}
              />
              <PapanPeringkatSiswa
                daftar={ranking.daftarDinilai}
                siswaId={siswa.id}
                totalSiswa={ranking.totalSiswa}
              />
            </>
          ) : ranking.posisiSaya || ranking.totalDinilai > 0 ? (
            <RankingTertahan />
          ) : null
        ) : null}
      </div>
    );
  }

  // Ulangan "sudah" tapi nilainya belum dibagikan guru → jangan tampilkan
  // form kode akses maupun angka nilai.
  if (!nilaiTerbuka) {
    return halamanNilaiTertahan;
  }

  // Ulangan "sudah" → alur kode akses yang sudah ada
  if (!kodeTerbuka) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/siswa/nilai"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Kembali ke Daftar Nilai
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {dataUlangan.judul}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">
              Kelas: {teksKelas}
              {dataUlangan.tanggal ? ` · Tanggal: ${dataUlangan.tanggal}` : ""}
            </p>
            {badgeStatusLengkap}
          </div>
        </div>

        <FormKode examId={id} />
      </div>
    );
  }

  // Sudah terbuka: tampilkan detail nilai.
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/siswa/nilai"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Daftar Nilai
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Nilai — {dataUlangan.judul}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-500">
            Kelas: {teksKelas}
            {dataUlangan.tanggal ? ` · Tanggal: ${dataUlangan.tanggal}` : ""}
          </p>
          {badgeStatusLengkap}
        </div>
      </div>

      {kartuNilaiSiswa}

      {ranking ? (
        <>
          <KartuPosisiRanking
            posisi={ranking.posisiSaya}
            totalDinilai={ranking.totalDinilai}
          />
          <PapanPeringkatSiswa
            daftar={ranking.daftarDinilai}
            siswaId={siswa.id}
            totalSiswa={ranking.totalSiswa}
          />
        </>
      ) : null}
    </div>
  );
}

