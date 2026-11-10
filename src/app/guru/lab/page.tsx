import Link from "next/link";
import { redirect } from "next/navigation";
import { FormKelasLab } from "@/components/form-kelas-lab";
import { SaklarModulLab } from "@/components/saklar-modul-lab";
import { toggleBlokirTempelLab } from "@/app/guru/lab/actions";
import { createClient } from "@/lib/supabase/server";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";
import { Notifikasi } from "@/components/ui/notifikasi";
import { ambilPengaturanSoal } from "@/lib/pengaturan-soal";

export default async function GuruLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [hasilKelas, hasilLessonAwal, hasilLatihan, pengaturanSoal] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id, nama_kelas")
        .order("nama_kelas", { ascending: true }),
      supabase
        .from("coding_lessons")
        .select(
          "id, judul, urutan, dibuka, blokir_tempel, coding_lesson_classes(kelas_id)",
        )
        .order("urutan", { ascending: true }),
      supabase.from("coding_exercises").select("id, lesson_id"),
      ambilPengaturanSoal(supabase),
    ]);

  // Kolom `blokir_tempel` (Tahap 39) & `dibuka` (Tahap 42) baru ada setelah
  // DDL dijalankan. Turun bertahap supaya saklar yang kolomnya sudah ada tetap
  // bisa dipakai walau tahap lainnya belum dijalankan.
  const KOLOM_DASAR = "id, judul, urutan, coding_lesson_classes(kelas_id)";

  type HasilLesson = {
    data: unknown;
    error: { message: string } | null;
  };

  let hasilLesson: HasilLesson = hasilLessonAwal;
  let siapBlokir = true;
  let siapTutupModul = true;

  if (hasilLessonAwal.error) {
    // Coba tanpa `dibuka` (Tahap 42 belum jalan).
    const tanpaTutup: HasilLesson = await supabase
      .from("coding_lessons")
      .select(`${KOLOM_DASAR}, blokir_tempel`)
      .order("urutan", { ascending: true });

    if (!tanpaTutup.error) {
      hasilLesson = tanpaTutup;
      siapTutupModul = false;
    } else {
      // Coba tanpa `blokir_tempel` (Tahap 39 belum jalan, Tahap 42 sudah).
      const tanpaBlokir: HasilLesson = await supabase
        .from("coding_lessons")
        .select(`${KOLOM_DASAR}, dibuka`)
        .order("urutan", { ascending: true });

      if (!tanpaBlokir.error) {
        hasilLesson = tanpaBlokir;
        siapBlokir = false;
      } else {
        // Kedua tahap belum jalan.
        hasilLesson = await supabase
          .from("coding_lessons")
          .select(KOLOM_DASAR)
          .order("urutan", { ascending: true });
        siapBlokir = false;
        siapTutupModul = false;
      }
    }
  }

  const kelasList = (hasilKelas.data ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  const lessons = (hasilLesson.data ?? []) as {
    id: string;
    judul: string;
    dibuka?: boolean | null;
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

      {pengaturanSoal.tutupLab ? (
        <Notifikasi varian="peringatan" judul="Akses Lab Coding sedang ditutup">
          <p>
            Saklar global di{" "}
            <Link
              href="/guru/pengaturan"
              className="font-medium underline hover:no-underline"
            >
              Pengaturan
            </Link>{" "}
            menyala, jadi siswa tidak bisa membuka modul maupun level. Hasil
            yang sudah tersimpan tetap aman.
          </p>
        </Notifikasi>
      ) : null}

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat modul: {galat}</p>
      ) : null}

      {!siapBlokir ? (
        <p className="text-sm text-amber-700">
          Jalankan <code>schema.sql</code> Tahap 39 untuk mengaktifkan saklar
          blokir copy-paste.
        </p>
      ) : null}

      {!siapTutupModul ? (
        <p className="text-sm text-amber-700">
          Jalankan <code>schema.sql</code> Tahap 42 untuk mengaktifkan tombol
          tutup/buka per modul.
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
            const dibukaModul = lesson.dibuka !== false;
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge varian="netral">{jumlahLatihan} level</Badge>
                    {dibukaModul ? null : (
                      <Badge varian="bahaya">Ditutup guru</Badge>
                    )}
                    <SaklarModulLab
                      lessonId={lesson.id}
                      judul={lesson.judul}
                      dibuka={dibukaModul}
                      siap={siapTutupModul}
                    />
                  </div>
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
