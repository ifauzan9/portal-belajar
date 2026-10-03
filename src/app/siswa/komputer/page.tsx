import Link from "next/link";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonKomputer } from "@/components/ui/ikon-siswa";

type LessonRow = {
  id: string;
  judul: string;
  isi: string;
  urutan: number;
  komputer_lesson_classes?: { kelas_id: string }[];
};

export default async function KomputerSiswaPage() {
  const { siswa, kelas } = await requireSiswa();
  const supabase = await createClient();

  const [hasilLesson, hasilTantangan, hasilHasil] = await Promise.all([
    supabase
      .from("komputer_lessons")
      .select("id, judul, isi, urutan, komputer_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true }),
    supabase.from("komputer_challenges").select("id, lesson_id, poin"),
    supabase
      .from("komputer_hasil")
      .select("challenge_id, pernah_benar")
      .eq("siswa_id", siswa.id)
      .eq("pernah_benar", true),
  ]);

  const lessons = (hasilLesson.data ?? []) as LessonRow[];
  const tantangan = (hasilTantangan.data ?? []) as {
    id: string;
    lesson_id: string;
    poin: number;
  }[];
  const selesaiIds = new Set(
    (hasilHasil.data ?? []).map(
      (baris) => (baris as { challenge_id: string }).challenge_id,
    ),
  );

  const relevan = lessons.filter((lesson) => {
    const daftarKelasId =
      lesson.komputer_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
    if (daftarKelasId.length === 0) return true;
    return siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id);
  });

  const daftar = relevan.map((lesson) => {
    const item = tantangan.filter((t) => t.lesson_id === lesson.id);
    const total = item.length;
    const selesai = item.filter((t) => selesaiIds.has(t.id)).length;
    const totalPoin = item.reduce((akum, t) => akum + t.poin, 0);
    const selesaiPoin = item
      .filter((t) => selesaiIds.has(t.id))
      .reduce((akum, t) => akum + t.poin, 0);
    return { ...lesson, total, selesai, totalPoin, selesaiPoin };
  });

  const totalTantangan = daftar.reduce((a, d) => a + d.total, 0);
  const selesaiTantangan = daftar.reduce((a, d) => a + d.selesai, 0);
  const totalPoin = daftar.reduce((a, d) => a + d.totalPoin, 0);
  const poinDidapat = daftar.reduce((a, d) => a + d.selesaiPoin, 0);
  const semuaSelesai = totalTantangan > 0 && selesaiTantangan === totalTantangan;

  const galat = hasilLesson.error?.message ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lab Komputer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Praktik dasar komputer: mouse, klik, drag &amp; scroll. Setiap
          tantangan dinilai otomatis.
        </p>
      </div>

      {totalTantangan > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Poin: {poinDidapat} / {totalPoin}
              </p>
              <p className="text-xs text-slate-500">
                {selesaiTantangan}/{totalTantangan} tantangan selesai
              </p>
            </div>
          </div>
          {semuaSelesai ? (
            <Badge varian="sukses" titik>
              🏆 Mouse Mahir
            </Badge>
          ) : null}
        </div>
      ) : null}

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
                href={`/siswa/komputer/${lesson.id}`}
                className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 hover:ring-emerald-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <IkonKomputer className="h-5 w-5" />
                  </span>
                  <Badge varian={persen === 100 ? "sukses" : "netral"}>
                    {lesson.selesai}/{lesson.total} selesai
                  </Badge>
                </div>
                <h2 className="mt-4 font-semibold text-slate-900">
                  {lesson.judul}
                </h2>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${persen}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Kartu>
          <EmptyState
            ikon={<IkonKomputer className="h-6 w-6" />}
            judul="Belum ada materi untuk kelasmu"
            keterangan={`${
              kelas?.nama_kelas ?? "Kelasmu"
            } belum punya modul Lab Komputer. Nanti akan muncul di sini.`}
          />
        </Kartu>
      )}
    </div>
  );
}
