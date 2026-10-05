import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LabRunner } from "@/components/lab-runner";
import { BantuanLab } from "@/components/bantuan-lab";
import { PetaLevel } from "@/components/peta-level";
import { Badge } from "@/components/ui/badge";
import { hitungLevelTerkunci } from "@/lib/lab";

type LatihanRow = {
  id: string;
  level: number;
  judul: string;
  penjelasan: string;
  contoh_kode: string | null;
  instruksi: string;
  kode_awal: string | null;
  keluaran_diharapkan: string;
  poin: number;
  jenis: string;
  aturan: { variabel_wajib?: string[] } | null;
};

type HasilRow = {
  exercise_id: string;
  kode: string;
  benar: boolean;
  pernah_benar: boolean;
  percobaan: number;
};

export default async function LevelLabSiswaPage(
  props: PageProps<"/siswa/lab/[id]/[level]">,
) {
  const { id, level } = await props.params;
  const levelNum = Number(level);
  if (!Number.isInteger(levelNum) || levelNum < 1) notFound();

  const { siswa } = await requireSiswa();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: lessonData } = await supabase
    .from("coding_lessons")
    .select("id, judul, isi, coding_lesson_classes(kelas_id)")
    .eq("id", id)
    .maybeSingle();

  if (!lessonData) redirect("/siswa/lab");

  const lesson = lessonData as {
    id: string;
    judul: string;
    isi: string | null;
    coding_lesson_classes?: { kelas_id: string }[];
  };

  const daftarKelasId =
    lesson.coding_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) redirect("/siswa/lab");

  // Ambil semua level modul sekaligus (untuk navigasi + cari level aktif).
  const { data: latihanData } = await supabase
    .from("coding_exercises")
    .select(
      "id, level, judul, penjelasan, contoh_kode, instruksi, kode_awal, keluaran_diharapkan, poin, jenis, aturan",
    )
    .eq("lesson_id", id)
    .order("level", { ascending: true });

  const latihan = (latihanData ?? []) as LatihanRow[];
  const exercise = latihan.find((item) => item.level === levelNum);
  if (!exercise) notFound();

  // Ambil hasil siswa untuk semua level (untuk warna menu & status).
  const exerciseIds = latihan.map((item) => item.id);
  let hasil: HasilRow[] = [];
  if (exerciseIds.length > 0) {
    const { data } = await admin
      .from("coding_submissions")
      .select("exercise_id, kode, benar, pernah_benar, percobaan")
      .eq("siswa_id", siswa.id)
      .in("exercise_id", exerciseIds);
    hasil = (data ?? []) as HasilRow[];
  }

  const petaHasil = new Map(hasil.map((item) => [item.exercise_id, item]));
  const submission = petaHasil.get(exercise.id) ?? null;

  const selesai = latihan
    .filter((item) => petaHasil.get(item.id)?.pernah_benar === true)
    .map((item) => item.level);
  const dikerjakan = latihan
    .filter((item) => petaHasil.has(item.id))
    .map((item) => item.level);

  // Kunci berurutan ditentukan server: level N terkunci sampai N-1 benar.
  const levelTerkunci = hitungLevelTerkunci(
    latihan.map((item) => item.level),
    new Set(selesai),
  );

  // Kunci ketat: level terkunci tidak bisa dibuka walau lewat URL langsung.
  if (levelTerkunci.includes(levelNum)) {
    redirect(`/siswa/lab/${id}`);
  }

  const total = latihan.length;
  const adaSebelum = levelNum > 1;
  const adaSesudah = levelNum < total;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href={`/siswa/lab/${id}`}
          className="inline-flex min-h-10 items-center text-sm font-medium text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          ← {lesson.judul}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-700">{lesson.judul}</p>
            <h1 className="mt-1 text-balance text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
              Tantangan {exercise.level}: {exercise.judul}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge varian="netral">{exercise.poin} poin</Badge>
            {submission?.pernah_benar ? <Badge varian="sukses" titik>Sudah benar</Badge> : null}
          </div>
        </div>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          Tulis programmu sendiri. Jalankan untuk melihat hasil, lalu cocokkan dengan target.
        </p>
      </header>

      <PetaLevel
        lessonId={id}
        levels={latihan.map((item) => ({
          level: item.level,
          judul: item.judul,
        }))}
        selesai={selesai}
        dikerjakan={dikerjakan}
        aktif={levelNum}
        terkunci={levelTerkunci}
      />

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">Tantangan {exercise.level}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Apa yang perlu dibuat?</h2>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="max-w-3xl whitespace-pre-wrap text-base leading-7 text-slate-800">
            {exercise.instruksi}
          </div>

          {exercise.jenis !== "bebas" ? (
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Target output</h3>
                <p className="text-xs text-slate-500">Gunakan sebagai acuan, jangan disalin.</p>
              </div>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-100 select-none">
                {exercise.keluaran_diharapkan}
              </pre>
            </div>
          ) : null}
        </div>
      </section>

      <BantuanLab
        penjelasan={exercise.penjelasan}
        materi={lesson.isi}
        contoh={exercise.contoh_kode}
      />

      <LabRunner
        exerciseId={exercise.id}
        kodeAwal={exercise.kode_awal}
        keluaranDiharapkan={exercise.keluaran_diharapkan}
        kodeTersimpan={submission?.kode ?? null}
        percobaanAwal={submission?.percobaan ?? 0}
        pernahBenarAwal={submission?.pernah_benar ?? false}
        judul={exercise.judul}
        levelNumber={exercise.level}
        instruksi={exercise.instruksi}
        jenis={exercise.jenis}
        bantuan={lesson.isi}
        wajibVariabel={exercise.aturan?.variabel_wajib ?? []}
      />

      <div className="flex items-center justify-between gap-3">
        {adaSebelum ? (
          <Link
            href={`/siswa/lab/${id}/${levelNum - 1}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← Level {levelNum - 1}
          </Link>
        ) : (
          <span />
        )}
        {adaSesudah && submission?.pernah_benar ? (
          <Link
            href={`/siswa/lab/${id}/${levelNum + 1}`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Level {levelNum + 1} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
