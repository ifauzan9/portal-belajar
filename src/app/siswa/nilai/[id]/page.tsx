import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import {
  ambilKelasUlangan,
  namaKelasDariIds,
} from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { belumWaktunyaMulai } from "@/lib/jadwal-ulangan";
import { formatTanggalWib, formatWaktuWib } from "@/lib/waktu";
import { ambilPengaturanSoal } from "@/lib/pengaturan-soal";
import { PemberitahuanSoalDitutup } from "@/components/pemberitahuan-soal";

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
  const supabase = await createClient();

  const searchParams = await props.searchParams;
  const kodeTerbuka = searchParams.kode === "1";

  const [{ data: ulangan, error: galatUlangan }, pengaturanSoal] =
    await Promise.all([
      supabase
        .from("exams")
        .select(
          "id, judul, tanggal, kelas_id, access_code, status, tenggat, durasi, nilai_ditampilkan, nilai_selesai, dibuka, exam_classes(kelas_id)",
        )
        .eq("id", id)
        .maybeSingle(),
      ambilPengaturanSoal(supabase),
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
    nilai_ditampilkan: boolean;
    nilai_selesai: boolean;
    dibuka: boolean | null;
    exam_classes?: { kelas_id: string }[];
  };

  const belumWaktunya =
    dataUlangan.status === "akan" &&
    belumWaktunyaMulai(dataUlangan.tanggal);

  // Apakah nilai boleh dilihat siswa?
  const nilaiTerbuka =
    dataUlangan.nilai_ditampilkan === true || dataUlangan.nilai_selesai === true;

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

  // Badge status
  const badgeStatus =
    dataUlangan.status === "akan" ? (
      !bolehKerjakan ? (
        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
          Ditutup guru
        </span>
      ) : deadlineLewat ? (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          Ditutup
        </span>
      ) : sudahSubmit ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          Sudah dijawab
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
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
              {badgeStatus}
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
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
              {badgeStatus}
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
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
            {badgeStatus}
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
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-slate-500">Kelas: {teksKelas}</p>
            {badgeStatus}
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
                const adaKode =
                  nilaiKode > 0 || submitInfo.nilai_kode_manual !== null;
                return (
                  <>
                    <div
                      className={`mt-3 grid gap-3 ${
                        adaKode ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
                      }`}
                    >
                      <div className="rounded-xl bg-blue-50 p-3 text-center">
                        <p className="text-xs text-blue-600">Nilai PG</p>
                        <p className="text-2xl font-semibold tabular-nums text-blue-700">
                          {submitInfo.nilai_pg}
                        </p>
                      </div>
                      <div className="rounded-xl bg-amber-50 p-3 text-center">
                        <p className="text-xs text-amber-600">Nilai Esai</p>
                        <p className="text-2xl font-semibold tabular-nums text-amber-700">
                          {submitInfo.nilai_esai}
                        </p>
                      </div>
                      {adaKode ? (
                        <div className="rounded-xl bg-emerald-50 p-3 text-center">
                          <p className="text-xs text-emerald-600">Nilai Kode</p>
                          <p className="text-2xl font-semibold tabular-nums text-emerald-700">
                            {nilaiKode}
                          </p>
                          {submitInfo.nilai_kode_manual !== null ? (
                            <p className="text-[10px] text-emerald-500">
                              dinilai guru
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-slate-100 p-3 text-center">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-2xl font-semibold tabular-nums text-slate-900">
                          {submitInfo.nilai_total}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      {submitInfo.nilai_esai === 0 && !adaKode
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
                Nilai kamu ditahan oleh guru dan akan ditampilkan setelah
                selesai dinilai.
              </p>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            Submit: {formatWaktuWib(submitInfo.disubmit_at)}
          </p>
        </div>
      </div>
    );
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
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-slate-500">
              Kelas: {teksKelas}
              {dataUlangan.tanggal ? ` · Tanggal: ${dataUlangan.tanggal}` : ""}
            </p>
            {badgeStatus}
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
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-slate-500">
            Kelas: {teksKelas}
            {dataUlangan.tanggal ? ` · Tanggal: ${dataUlangan.tanggal}` : ""}
          </p>
          {badgeStatus}
        </div>
      </div>

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
            Nilai kamu untuk ulangan ini belum diinput oleh guru.
          </p>
        ) : null}
      </div>
    </div>
  );
}

