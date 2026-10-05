import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitungLevelTerkunci } from "@/lib/lab";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";

export default async function ModulLabSiswaPage(
  props: PageProps<"/siswa/lab/[id]">,
) {
  const { id } = await props.params;
  const { siswa } = await requireSiswa();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: lessonData } = await supabase
    .from("coding_lessons")
    .select("id, judul, isi, coding_lesson_classes(kelas_id)")
    .eq("id", id)
    .maybeSingle();

  if (!lessonData) {
    redirect("/siswa/lab");
  }

  const lesson = lessonData as {
    id: string;
    judul: string;
    isi: string;
    coding_lesson_classes?: { kelas_id: string }[];
  };

  const daftarKelasId =
    lesson.coding_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) {
    redirect("/siswa/lab");
  }

  const { data: latihanData } = await supabase
    .from("coding_exercises")
    .select("id, level, judul, poin, urutan")
    .eq("lesson_id", id)
    .order("level", { ascending: true });

  const { data: submitData } = await admin
    .from("coding_submissions")
    .select("exercise_id, benar, pernah_benar, percobaan")
    .eq("siswa_id", siswa.id);

  const petaHasil = new Map(
    (submitData ?? []).map((baris) => {
      const data = baris as {
        exercise_id: string;
        benar: boolean;
        pernah_benar: boolean;
        percobaan: number;
      };
      return [data.exercise_id, data] as const;
    }),
  );

  const latihan = (latihanData ?? []) as {
    id: string;
    level: number;
    judul: string;
    poin: number;
  }[];

  const levelSelesai = latihan
    .filter((l) => petaHasil.get(l.id)?.pernah_benar === true)
    .map((l) => l.level);
  const selesai = levelSelesai.length;
  const levelTerkunci = hitungLevelTerkunci(
    latihan.map((l) => l.level),
    new Set(levelSelesai),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/siswa/lab"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke daftar modul
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {lesson.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {selesai}/{latihan.length} level selesai
        </p>
      </div>

      {lesson.isi ? (
        <Kartu>
          <p className="text-sm whitespace-pre-wrap text-slate-700">
            {lesson.isi}
          </p>
        </Kartu>
      ) : null}

      <div className="space-y-3">
        {latihan.length > 0 ? (
          latihan.map((item) => {
            const hasil = petaHasil.get(item.id);
            const sudah = hasil?.pernah_benar === true;
            const pernahCoba = Boolean(hasil);
            const kunci = levelTerkunci.includes(item.level);

            if (kunci) {
              return (
                <div
                  key={item.id}
                  aria-disabled="true"
                  title={`Level ${item.level} terkunci. Selesaikan level sebelumnya dulu.`}
                  className="flex cursor-not-allowed items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-sm font-semibold text-slate-400">
                      🔒
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-400">
                        {item.judul}
                      </span>
                      <span className="text-xs text-slate-400">Terkunci</span>
                    </span>
                  </span>
                  <span className="shrink-0">
                    <Badge varian="netral">🔒 Terkunci</Badge>
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                href={`/siswa/lab/${id}/${item.level}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-emerald-300"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                      sudah
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.level}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {item.judul}
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.poin} poin
                    </span>
                  </span>
                </span>
                <span className="shrink-0">
                  {sudah ? (
                    <Badge varian="sukses" titik>
                      Selesai
                    </Badge>
                  ) : pernahCoba ? (
                    <Badge varian="peringatan">Sedang dikerjakan</Badge>
                  ) : (
                    <Badge varian="netral">Belum</Badge>
                  )}
                </span>
              </Link>
            );
          })
        ) : (
          <Kartu>
            <EmptyState
              ikon={<IkonBuku className="h-6 w-6" />}
              judul="Belum ada latihan"
              keterangan="Latihan untuk modul ini belum tersedia."
            />
          </Kartu>
        )}
      </div>
    </div>
  );
}
