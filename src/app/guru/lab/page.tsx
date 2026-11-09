import Link from "next/link";
import { redirect } from "next/navigation";
import { FormKelasLab } from "@/components/form-kelas-lab";
import { toggleBlokirTempelLab } from "@/app/guru/lab/actions";
import { createClient } from "@/lib/supabase/server";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";

export default async function GuruLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [hasilKelas, hasilLessonAwal, hasilLatihan] = await Promise.all([
    supabase
      .from("classes")
      .select("id, nama_kelas")
      .order("nama_kelas", { ascending: true }),
    supabase
      .from("coding_lessons")
      .select("id, judul, urutan, blokir_tempel, coding_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true }),
    supabase.from("coding_exercises").select("id, lesson_id"),
  ]);

  // Kolom `blokir_tempel` baru ada setelah Tahap 39. Kalau belum,
  // fallback ke select lama dan matikan saklar.
  let hasilLesson: {
    data: unknown;
    error: { message: string } | null;
  } = hasilLessonAwal;
  let siapBlokir = !hasilLessonAwal.error;

  if (hasilLessonAwal.error) {
    hasilLesson = await supabase
      .from("coding_lessons")
      .select("id, judul, urutan, coding_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true });
    siapBlokir = false;
  }

  const kelasList = (hasilKelas.data ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  const lessons = (hasilLesson.data ?? []) as {
    id: string;
    judul: string;
    blokir_tempel?: boolean | null;
    coding_lesson_classes?: { kelas_id: string }[];
  }[];
  const latihan = (hasilLatihan.data ?? []) as {
    id: string;
    lesson_id: string;
  }[];

  const galat = hasilLesson.error?.message ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lab Coding</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atur target kelas modul, lalu lihat hasil pengerjaan siswa.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/guru/lab/hasil"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Lihat Hasil Siswa →
        </Link>
      </div>

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat modul: {galat}</p>
      ) : null}

      {!siapBlokir ? (
        <p className="text-sm text-amber-700">
          Jalankan <code>schema.sql</code> Tahap 39 untuk mengaktifkan saklar
          blokir copy-paste.
        </p>
      ) : null}

      {lessons.length > 0 ? (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const daftarKelasId =
              lesson.coding_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
            const jumlahLatihan = latihan.filter(
              (l) => l.lesson_id === lesson.id,
            ).length;
            return (
              <Kartu key={lesson.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <IkonBuku className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        {lesson.judul}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {jumlahLatihan} level ·{" "}
                        {daftarKelasId.length === 0
                          ? "Semua kelas"
                          : daftarKelasId
                              .map(
                                (idK) =>
                                  namaKelas.get(idK) ?? "Kelas tak ditemukan",
                              )
                              .join(", ")}
                      </p>
                    </div>
                  </div>
                  <Badge varian="netral">{jumlahLatihan} level</Badge>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <FormKelasLab
                    lessonId={lesson.id}
                    kelasList={kelasList}
                    awalTerpilih={daftarKelasId}
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Copy-paste editor & teks soal
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          lesson.blokir_tempel === true
                            ? "text-amber-700"
                            : "text-slate-700"
                        }`}
                      >
                        {lesson.blokir_tempel === true
                          ? "🔒 Diblokir"
                          : "🔓 Diizinkan"}
                      </p>
                    </div>
                    <form action={toggleBlokirTempelLab}>
                      <input
                        type="hidden"
                        name="lesson_id"
                        value={lesson.id}
                      />
                      <button
                        type="submit"
                        disabled={!siapBlokir}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          lesson.blokir_tempel === true
                            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            : "bg-amber-600 text-white hover:bg-amber-500"
                        }`}
                      >
                        {lesson.blokir_tempel === true
                          ? "Izinkan Copy-Paste"
                          : "Blokir Copy-Paste"}
                      </button>
                    </form>
                  </div>
                </div>
              </Kartu>
            );
          })}
        </div>
      ) : (
        <Kartu>
          <EmptyState
            ikon={<IkonBuku className="h-6 w-6" />}
            judul="Belum ada modul"
            keterangan="Jalankan schema.sql Tahap 17 untuk memuat Modul 1."
          />
        </Kartu>
      )}
    </div>
  );
}
