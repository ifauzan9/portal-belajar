import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonKomputer } from "@/components/ui/ikon-siswa";

export default async function ModulKomputerSiswaPage(
  props: PageProps<"/siswa/komputer/[id]">,
) {
  const { id } = await props.params;
  const { siswa } = await requireSiswa();
  const supabase = await createClient();

  const { data: lessonData } = await supabase
    .from("komputer_lessons")
    .select("id, judul, isi, komputer_lesson_classes(kelas_id)")
    .eq("id", id)
    .maybeSingle();

  if (!lessonData) redirect("/siswa/komputer");

  const lesson = lessonData as {
    id: string;
    judul: string;
    isi: string;
    komputer_lesson_classes?: { kelas_id: string }[];
  };

  const daftarKelasId =
    lesson.komputer_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) redirect("/siswa/komputer");

  const { data: tantanganData } = await supabase
    .from("komputer_challenges")
    .select("id, level, judul, jenis, poin, urutan")
    .eq("lesson_id", id)
    .order("level", { ascending: true });

  const { data: submitData } = await supabase
    .from("komputer_hasil")
    .select("challenge_id, benar, pernah_benar, percobaan")
    .eq("siswa_id", siswa.id);

  const petaHasil = new Map(
    (submitData ?? []).map((baris) => {
      const data = baris as {
        challenge_id: string;
        benar: boolean;
        pernah_benar: boolean;
        percobaan: number;
      };
      return [data.challenge_id, data] as const;
    }),
  );

  const tantangan = (tantanganData ?? []) as {
    id: string;
    level: number;
    judul: string;
    jenis: string;
    poin: number;
  }[];

  const selesai = tantangan.filter(
    (t) => petaHasil.get(t.id)?.pernah_benar === true,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/siswa/komputer"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke daftar modul
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {lesson.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {selesai}/{tantangan.length} tantangan selesai
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
        {tantangan.length > 0 ? (
          tantangan.map((item) => {
            const hasil = petaHasil.get(item.id);
            const sudah = hasil?.pernah_benar === true;
            const pernahCoba = Boolean(hasil);
            return (
              <Link
                key={item.id}
                href={`/siswa/komputer/${id}/${item.level}`}
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
                    <Badge varian="peringatan">Dikerjakan</Badge>
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
              ikon={<IkonKomputer className="h-6 w-6" />}
              judul="Belum ada tantangan"
              keterangan="Tantangan untuk modul ini belum tersedia."
            />
          </Kartu>
        )}
      </div>
    </div>
  );
}
