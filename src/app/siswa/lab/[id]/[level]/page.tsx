import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { LabRunner } from "@/components/lab-runner";
import { PetaLevel } from "@/components/peta-level";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";

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

  const { data: lessonData } = await supabase
    .from("coding_lessons")
    .select("id, judul, coding_lesson_classes(kelas_id)")
    .eq("id", id)
    .maybeSingle();

  if (!lessonData) redirect("/siswa/lab");

  const lesson = lessonData as {
    id: string;
    judul: string;
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
      "id, level, judul, penjelasan, contoh_kode, instruksi, kode_awal, keluaran_diharapkan, poin",
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
    const { data } = await supabase
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

  const total = latihan.length;
  const adaSebelum = levelNum > 1;
  const adaSesudah = levelNum < total;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/siswa/lab/${id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← {lesson.judul}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            Level {exercise.level} — {exercise.judul}
          </h1>
          <Badge varian="netral">{exercise.poin} poin</Badge>
          {submission?.pernah_benar ? (
            <Badge varian="sukses" titik>
              Selesai
            </Badge>
          ) : null}
        </div>
      </div>

      <PetaLevel
        lessonId={id}
        levels={latihan.map((item) => ({
          level: item.level,
          judul: item.judul,
        }))}
        selesai={selesai}
        dikerjakan={dikerjakan}
        aktif={levelNum}
      />

      <Kartu>
        <h2 className="text-sm font-semibold text-slate-900">📖 Penjelasan</h2>
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">
          {exercise.penjelasan}
        </p>

        {exercise.contoh_kode ? (
          <details className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Lihat contoh kode
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
              {exercise.contoh_kode}
            </pre>
          </details>
        ) : null}
      </Kartu>

      <Kartu>
        <h2 className="text-sm font-semibold text-slate-900">🎯 Tantangan</h2>
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">
          {exercise.instruksi}
        </p>

        <div className="mt-3">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Output yang diharapkan
          </p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs whitespace-pre-wrap text-slate-100">
            {exercise.keluaran_diharapkan}
          </pre>
        </div>
      </Kartu>

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
        {adaSesudah ? (
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
