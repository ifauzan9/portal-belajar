import Link from "next/link";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createSiswaClient } from "@/lib/supabase/siswa";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitungProgresLab } from "@/lib/progres-lab";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HeroSiswa } from "@/components/ui/hero-siswa";
import { ProgresBar } from "@/components/ui/progres";
import { IkonBuku, IkonLab } from "@/components/ui/ikon-siswa";
import { ambilPengaturanSoal, labBolehDiakses } from "@/lib/pengaturan-soal";
import { PemberitahuanSoalDitutup } from "@/components/pemberitahuan-soal";

export default async function LabSiswaPage() {
  const { siswa, kelas } = await requireSiswa();
  const supabase = await createSiswaClient();
  const admin = createAdminClient();

  const [hasilLesson, hasilLatihan, hasilHasil, pengaturanSoal] =
    await Promise.all([
      supabase
        .from("coding_lessons")
        .select("id, judul, isi, urutan, dibuka, coding_lesson_classes(kelas_id)")
        .order("urutan", { ascending: true }),
      supabase.from("coding_exercises").select("id, lesson_id"),
      admin
        .from("coding_submissions")
        .select("exercise_id, pernah_benar")
        .eq("siswa_id", siswa.id)
        .eq("pernah_benar", true),
      ambilPengaturanSoal(supabase),
    ]);

  // Kolom `dibuka` baru ada setelah Tahap 42. Kalau belum, fallback ke select
  // lama dan anggap semua modul terbuka.
  let dataLesson: unknown = hasilLesson.data;
  let galatLesson = hasilLesson.error;

  if (hasilLesson.error) {
    const fallback = await supabase
      .from("coding_lessons")
      .select("id, judul, isi, urutan, coding_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true });
    dataLesson = fallback.data;
    galatLesson = fallback.error;
  }

  const modulDitutup = new Set(
    ((dataLesson ?? []) as { id: string; dibuka?: boolean | null }[])
      .filter((lesson) => lesson.dibuka === false)
      .map((lesson) => lesson.id),
  );

  const selesaiIds = new Set(
    (hasilHasil.data ?? []).map(
      (baris) => (baris as { exercise_id: string }).exercise_id,
    ),
  );

  const progres = hitungProgresLab(
    (dataLesson ?? []) as {
      id: string;
      judul: string;
      urutan: number;
      coding_lesson_classes?: { kelas_id: string }[];
    }[],
    (hasilLatihan.data ?? []) as { id: string; lesson_id: string }[],
    selesaiIds,
    siswa.kelas_id,
  );

  const daftar = progres.modul;
  const galat = galatLesson?.message ?? null;

  return (
    <div className="space-y-6">
      <HeroSiswa
        label="Ruang Praktik"
        judul="Lab Coding"
        subjudul="Belajar Python dengan latihan bertingkat. Kode dijalankan langsung di browser dan dinilai otomatis."
        ikon={<IkonLab className="h-6 w-6" />}
        aksi={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/25">
            {kelas?.nama_kelas ?? "Belum ada kelas"}
          </span>
        }
      >
        {daftar.length > 0 ? (
          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm text-emerald-50">
              <span>
                <b className="text-base font-bold text-white">
                  {progres.totalSelesai}
                </b>{" "}
                dari {progres.totalTantangan} tantangan benar
              </span>
              <span className="font-semibold text-white">{progres.persen}%</span>
            </div>
            <ProgresBar
              nilai={progres.persen}
              label={`Progres keseluruhan lab coding ${progres.persen} persen`}
              warna="putih"
              className="mt-2"
            />
          </div>
        ) : null}
      </HeroSiswa>

      {pengaturanSoal.tutupLab ? (
        <PemberitahuanSoalDitutup jenis="lab" pesan={pengaturanSoal.pesan} />
      ) : null}

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat modul: {galat}</p>
      ) : null}

      {daftar.length > 0 ? (
        <>
          {/* Ringkasan angka */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Modul
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {daftar.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Selesai
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
                {daftar.filter((m) => m.total > 0 && m.selesai === m.total).length}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Progres
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
                {progres.persen}%
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {daftar.map((lesson) => {
              const persen = lesson.persen;
              const tuntas = lesson.total > 0 && lesson.selesai === lesson.total;
              const berjalan = lesson.selesai > 0 && !tuntas;
              const ditutupModul = modulDitutup.has(lesson.id);
              const terkunci = !labBolehDiakses(
                pengaturanSoal,
                !ditutupModul,
              );
              const alasanKunci = pengaturanSoal.tutupLab
                ? "Akses Lab Coding ditutup oleh guru."
                : "Modul ini ditutup oleh guru.";

              const labelStatus = terkunci
                ? "Ditutup guru"
                : tuntas
                  ? "Selesai"
                  : berjalan
                    ? "Sedang berjalan"
                    : "Belum dimulai";

              const cta = terkunci
                ? "Ditutup sementara"
                : tuntas
                  ? "Ulangi"
                  : berjalan
                    ? "Lanjutkan"
                    : "Mulai";

              const isi = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/20">
                      <IkonBuku className="h-5 w-5" />
                    </span>
                    <Badge
                      varian={
                        terkunci
                          ? "bahaya"
                          : tuntas
                            ? "sukses"
                            : berjalan
                              ? "info"
                              : "netral"
                      }
                    >
                      {tuntas && !terkunci ? "✓ " : ""}
                      {labelStatus}
                    </Badge>
                  </div>

                  <h2 className="mt-4 font-semibold text-slate-900">
                    {lesson.judul}
                  </h2>

                  <div className="mt-4">
                    <ProgresBar
                      nilai={persen}
                      label={`Progres ${lesson.judul}`}
                      ukuran="sm"
                    />
                    <p className="mt-2 text-sm text-slate-600">
                      {lesson.selesai} dari {lesson.total} tantangan benar
                    </p>
                  </div>

                  <div
                    className={`mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-sm font-semibold ${
                      terkunci ? "text-slate-400" : "text-emerald-700"
                    }`}
                  >
                    <span>{cta}</span>
                    <span
                      aria-hidden="true"
                      className={
                        terkunci ? "" : "transition group-hover:translate-x-0.5"
                      }
                    >
                      {terkunci ? "🔒" : "→"}
                    </span>
                  </div>
                </>
              );

              if (terkunci) {
                return (
                  <div
                    key={lesson.id}
                    aria-disabled="true"
                    title={alasanKunci}
                    className="flex cursor-not-allowed flex-col rounded-2xl bg-slate-50 p-5 opacity-80 ring-1 ring-slate-200"
                  >
                    {isi}
                  </div>
                );
              }

              return (
                <Link
                  key={lesson.id}
                  href={`/siswa/lab/${lesson.id}`}
                  className={`group flex flex-col rounded-2xl p-5 ring-1 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-900/5 hover:ring-emerald-300 ${
                    tuntas
                      ? "bg-emerald-50 ring-emerald-200"
                      : "bg-white ring-slate-200"
                  }`}
                >
                  {isi}
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <Kartu>
          <EmptyState
            ikon={<IkonBuku className="h-6 w-6" />}
            judul="Belum ada materi untuk kelasmu"
            keterangan={`${
              kelas?.nama_kelas ?? "Kelasmu"
            } belum punya modul lab. Nanti akan muncul di sini.`}
          />
        </Kartu>
      )}
    </div>
  );
}
