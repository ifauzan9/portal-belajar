import Link from "next/link";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";

type LessonRow = {
  id: string;
  judul: string;
  isi: string;
  urutan: number;
  coding_lesson_classes?: { kelas_id: string }[];
};

export default async function LabSiswaPage() {
  const { siswa, kelas } = await requireSiswa();
  const supabase = await createClient();
  const admin = createAdminClient();

  const [hasilLesson, hasilLatihan, hasilHasil] = await Promise.all([
    supabase
      .from("coding_lessons")
      .select("id, judul, isi, urutan, coding_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true }),
    supabase.from("coding_exercises").select("id, lesson_id"),
    admin
      .from("coding_submissions")
      .select("exercise_id, pernah_benar")
      .eq("siswa_id", siswa.id)
      .eq("pernah_benar", true),
  ]);

  const lessons = (hasilLesson.data ?? []) as LessonRow[];
  const latihan = (hasilLatihan.data ?? []) as {
    id: string;
    lesson_id: string;
  }[];
  const selesaiIds = new Set(
    (hasilHasil.data ?? []).map(
      (baris) => (baris as { exercise_id: string }).exercise_id,
    ),
  );

  const relevan = lessons.filter((lesson) => {
    const daftarKelasId =
      lesson.coding_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
    if (daftarKelasId.length === 0) return true;
    return siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id);
  });

  const daftar = relevan.map((lesson) => {
    const latihanLesson = latihan.filter((l) => l.lesson_id === lesson.id);
    const total = latihanLesson.length;
    const selesai = latihanLesson.filter((l) => selesaiIds.has(l.id)).length;
    return { ...lesson, total, selesai };
  });

  const galat = hasilLesson.error?.message ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lab Coding</h1>
        <p className="mt-1 text-sm text-slate-500">
          Belajar Python dengan latihan bertingkat. Kode dijalankan langsung di
          browser dan dinilai otomatis.
        </p>
      </div>

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat modul: {galat}</p>
      ) : null}

      {daftar.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {daftar.map((lesson) => {
            const persen =
              lesson.total > 0
                ? Math.round((lesson.selesai / lesson.total) * 100)
                : 0;
            return (
              <Link
                key={lesson.id}
                href={`/siswa/lab/${lesson.id}`}
                className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 hover:ring-emerald-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <IkonBuku className="h-5 w-5" />
                  </span>
                  <Badge varian={persen === 100 ? "sukses" : "netral"}>
                    {lesson.selesai}/{lesson.total} selesai
                  </Badge>
                </div>
                <h2 className="mt-4 font-semibold text-slate-900">
                  {lesson.judul}
                </h2>
                <div
                  role="progressbar"
                  aria-label={`Progres ${lesson.judul}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={persen}
                  className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${persen}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {lesson.selesai} dari {lesson.total} tantangan benar
                </p>
              </Link>
            );
          })}
        </div>
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
