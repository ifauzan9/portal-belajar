import Link from "next/link";
import { redirect } from "next/navigation";
import { FormKelasKomputer } from "@/components/form-kelas-komputer";
import { createClient } from "@/lib/supabase/server";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonKomputer } from "@/components/ui/ikon-siswa";

export default async function GuruKomputerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [hasilKelas, hasilLesson, hasilTantangan] = await Promise.all([
    supabase
      .from("classes")
      .select("id, nama_kelas")
      .order("nama_kelas", { ascending: true }),
    supabase
      .from("komputer_lessons")
      .select("id, judul, urutan, komputer_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true }),
    supabase.from("komputer_challenges").select("id, lesson_id"),
  ]);

  const kelasList = (hasilKelas.data ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  const lessons = (hasilLesson.data ?? []) as {
    id: string;
    judul: string;
    komputer_lesson_classes?: { kelas_id: string }[];
  }[];
  const tantangan = (hasilTantangan.data ?? []) as {
    id: string;
    lesson_id: string;
  }[];

  const galat = hasilLesson.error?.message ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lab Komputer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atur target kelas modul praktik dasar komputer, lalu lihat hasilnya.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/guru/komputer/hasil"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Lihat Hasil Siswa →
        </Link>
      </div>

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat modul: {galat}</p>
      ) : null}

      {lessons.length > 0 ? (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const daftarKelasId =
              lesson.komputer_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
            const jumlah = tantangan.filter(
              (t) => t.lesson_id === lesson.id,
            ).length;
            return (
              <Kartu key={lesson.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <IkonKomputer className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        {lesson.judul}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {jumlah} tantangan ·{" "}
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
                  <Badge varian="netral">{jumlah} tantangan</Badge>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <FormKelasKomputer
                    lessonId={lesson.id}
                    kelasList={kelasList}
                    awalTerpilih={daftarKelasId}
                  />
                </div>
              </Kartu>
            );
          })}
        </div>
      ) : (
        <Kartu>
          <EmptyState
            ikon={<IkonKomputer className="h-6 w-6" />}
            judul="Belum ada modul"
            keterangan="Jalankan schema.sql Tahap 19 untuk memuat Bagian 0–2."
          />
        </Kartu>
      )}
    </div>
  );
}
