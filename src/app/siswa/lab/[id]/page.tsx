import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitungLevelTerkunci } from "@/lib/lab";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HeroSiswa, TombolHero } from "@/components/ui/hero-siswa";
import { ProgresBar } from "@/components/ui/progres";
import { IkonBuku } from "@/components/ui/ikon-siswa";
import { ambilPengaturanSoal } from "@/lib/pengaturan-soal";

export default async function ModulLabSiswaPage(
  props: PageProps<"/siswa/lab/[id]">,
) {
  const { id } = await props.params;
  const { siswa } = await requireSiswa();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Saklar global "tutup akses soal" (Tahap 41). Modul lab tidak bisa dibuka
  // selama guru menutup akses.
  const pengaturanSoal = await ambilPengaturanSoal(supabase);
  if (pengaturanSoal.tutupLab) {
    redirect("/siswa/lab");
  }

  const hasilLesson = await supabase
    .from("coding_lessons")
    .select("id, judul, isi, dibuka, coding_lesson_classes(kelas_id)")
    .eq("id", id)
    .maybeSingle();

  // Kolom `dibuka` baru ada setelah Tahap 42; kalau belum, fallback ke select
  // lama dan anggap modul terbuka.
  let dataLesson: unknown = hasilLesson.data;
  if (hasilLesson.error) {
    const fallback = await supabase
      .from("coding_lessons")
      .select("id, judul, isi, coding_lesson_classes(kelas_id)")
      .eq("id", id)
      .maybeSingle();
    dataLesson = fallback.data;
  }

  if (!dataLesson) {
    redirect("/siswa/lab");
  }

  const lesson = dataLesson as {
    id: string;
    judul: string;
    isi: string;
    dibuka?: boolean | null;
    coding_lesson_classes?: { kelas_id: string }[];
  };

  // Saklar tutup per modul (Tahap 42): modul yang ditutup guru tidak bisa
  // dibuka siswa, termasuk lewat URL langsung.
  if (lesson.dibuka === false) {
    redirect("/siswa/lab");
  }

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
    .select("id, level, judul, poin, urutan, aturan")
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
    aturan: { final_boss?: boolean; badge?: string } | null;
  }[];

  const levelSelesai = latihan
    .filter((l) => petaHasil.get(l.id)?.pernah_benar === true)
    .map((l) => l.level);
  const selesai = levelSelesai.length;
  const levelTerkunci = hitungLevelTerkunci(
    latihan.map((l) => l.level),
    new Set(levelSelesai),
  );
  const persen =
    latihan.length > 0 ? Math.round((selesai / latihan.length) * 100) : 0;

  // Level berikutnya yang bisa dikerjakan (belum selesai & tidak terkunci).
  const levelBerikut = latihan.find(
    (item) =>
      !levelSelesai.includes(item.level) &&
      !levelTerkunci.includes(item.level),
  );

  return (
    <div className="space-y-6">
      <HeroSiswa
        atas={
          <Link
            href="/siswa/lab"
            className="inline-flex items-center text-sm font-medium text-emerald-100 transition hover:text-white"
          >
            ← Kembali ke daftar modul
          </Link>
        }
        label="Modul Lab Coding"
        judul={lesson.judul}
        subjudul={`${selesai} dari ${latihan.length} level selesai`}
        ikon={<IkonBuku className="h-6 w-6" />}
        aksi={
          levelBerikut ? (
            <TombolHero href={`/siswa/lab/${id}/${levelBerikut.level}`}>
              Lanjut level {levelBerikut.level} →
            </TombolHero>
          ) : latihan.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25">
              🎉 Semua level tuntas
            </span>
          ) : null
        }
      >
        {latihan.length > 0 ? (
          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm text-emerald-50">
              <span>Progres modul</span>
              <span className="font-semibold text-white">{persen}%</span>
            </div>
            <ProgresBar
              nilai={persen}
              label={`Progres modul ${persen} persen`}
              warna="putih"
              className="mt-2"
            />
          </div>
        ) : null}
      </HeroSiswa>

      {lesson.isi ? (
        <details className="panel-lipat group overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition duration-200 open:ring-emerald-200">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-4 transition hover:bg-emerald-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <IkonBuku className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                Tentang modul ini
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 group-open:hidden">
                Klik untuk membaca deskripsi modul
              </span>
              <span className="mt-0.5 hidden text-xs text-slate-500 group-open:block">
                Deskripsi modul
              </span>
            </span>
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition duration-200 group-hover:bg-emerald-100 group-hover:text-emerald-700 group-open:rotate-180 group-open:bg-emerald-100 group-open:text-emerald-700"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </summary>

          <div className="border-t border-emerald-100/70 px-5 py-4">
            <p className="text-sm leading-7 whitespace-pre-wrap text-slate-700">
              {lesson.isi}
            </p>
          </div>
        </details>
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
                  className="flex cursor-not-allowed items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                      🔒
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-400">
                        {item.judul}
                      </span>
                      <span className="text-xs text-slate-400">
                        Selesaikan level sebelumnya dulu
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0">
                    <Badge varian="netral">Terkunci</Badge>
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                href={`/siswa/lab/${id}/${item.level}`}
                className={`group flex items-center justify-between gap-3 rounded-2xl p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-900/5 ${
                  sudah
                    ? "bg-emerald-50 ring-emerald-200 hover:ring-emerald-400"
                    : pernahCoba
                      ? "bg-amber-50/70 ring-amber-200 hover:ring-amber-400"
                      : "bg-white ring-slate-200 hover:ring-emerald-300"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      item.aturan?.final_boss
                        ? "bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900 shadow-sm shadow-amber-500/30"
                        : sudah
                          ? "bg-emerald-600 text-white"
                          : pernahCoba
                            ? "bg-amber-400 text-slate-900"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.aturan?.final_boss ? "⭐" : sudah ? "✓" : item.level}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {item.judul}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="rounded-md bg-slate-900/5 px-1.5 py-0.5 font-medium text-slate-600">
                        {item.poin} XP
                      </span>
                      {item.aturan?.final_boss ? (
                        <span className="font-medium text-amber-700">
                          Final Boss
                        </span>
                      ) : null}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {sudah ? (
                    <Badge varian="sukses" titik>
                      Selesai
                    </Badge>
                  ) : pernahCoba ? (
                    <Badge varian="peringatan">Sedang dikerjakan</Badge>
                  ) : item.aturan?.final_boss ? (
                    <Badge varian="peringatan">⭐ Final Boss</Badge>
                  ) : (
                    <Badge varian="info">Belum</Badge>
                  )}
                  <span
                    aria-hidden="true"
                    className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600"
                  >
                    →
                  </span>
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
