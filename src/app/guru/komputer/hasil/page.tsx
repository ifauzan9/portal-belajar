import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonKomputer } from "@/components/ui/ikon-siswa";

function tampilWaktu(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(t);
}

type HasilRow = {
  id: string;
  challenge_id: string;
  siswa_id: string;
  benar: boolean;
  pernah_benar: boolean;
  percobaan: number;
  skor: number | null;
  waktu_ms: number | null;
  updated_at: string | null;
  students?:
    | { nama_siswa: string; nis: string | null; kelas_id: string | null }
    | { nama_siswa: string; nis: string | null; kelas_id: string | null }[]
    | null;
};

function bacaSiswa(row: HasilRow): {
  nama_siswa: string;
  nis: string | null;
  kelas_id: string | null;
} {
  const data = row.students;
  if (!data) return { nama_siswa: "Siswa", nis: null, kelas_id: null };
  if (Array.isArray(data)) {
    return data[0] ?? { nama_siswa: "Siswa", nis: null, kelas_id: null };
  }
  return data;
}

export default async function HasilKomputerPage(
  props: PageProps<"/guru/komputer/hasil">,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const searchParams = await props.searchParams;
  const lessonParam =
    typeof searchParams.lesson === "string" ? searchParams.lesson : "";
  const kelasParam =
    typeof searchParams.kelas === "string" ? searchParams.kelas : "";

  const [hasilLesson, hasilKelas, hasilSiswa] = await Promise.all([
    supabase
      .from("komputer_lessons")
      .select("id, judul, urutan")
      .order("urutan", { ascending: true }),
    supabase
      .from("classes")
      .select("id, nama_kelas")
      .order("nama_kelas", { ascending: true }),
    supabase.from("students").select("id, nama_siswa, nis, kelas_id"),
  ]);

  const lessons = (hasilLesson.data ?? []) as { id: string; judul: string }[];

  if (lessons.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/guru/komputer"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Lab Komputer
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Hasil Lab Komputer
          </h1>
        </div>
        <Kartu>
          <EmptyState
            ikon={<IkonKomputer className="h-6 w-6" />}
            judul="Belum ada modul"
            keterangan="Jalankan schema.sql Tahap 19 untuk memuat Bagian 0–2."
          />
        </Kartu>
      </div>
    );
  }

  const lessonTerpilih =
    lessons.find((l) => l.id === lessonParam) ?? lessons[0];

  const kelasList = (hasilKelas.data ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  const semuaSiswa = (hasilSiswa.data ?? []) as {
    id: string;
    nama_siswa: string;
    nis: string | null;
    kelas_id: string | null;
  }[];

  const { data: tantanganData } = await supabase
    .from("komputer_challenges")
    .select("id, level, judul, poin")
    .eq("lesson_id", lessonTerpilih.id)
    .order("level", { ascending: true });

  const tantangan = (tantanganData ?? []) as {
    id: string;
    level: number;
    judul: string;
    poin: number;
  }[];

  const challengeIds = tantangan.map((t) => t.id);

  let hasil: HasilRow[] = [];
  if (challengeIds.length > 0) {
    const { data } = await supabase
      .from("komputer_hasil")
      .select(
        "id, challenge_id, siswa_id, benar, pernah_benar, percobaan, skor, waktu_ms, updated_at, students(nama_siswa, nis, kelas_id)",
      )
      .in("challenge_id", challengeIds)
      .order("updated_at", { ascending: false });
    hasil = (data ?? []) as unknown as HasilRow[];
  }

  if (kelasParam) {
    hasil = hasil.filter((h) => bacaSiswa(h).kelas_id === kelasParam);
  }

  const siswaTampil = semuaSiswa.filter(
    (s) => !kelasParam || s.kelas_id === kelasParam,
  );

  const ringkasan = siswaTampil
    .map((siswa) => {
      const subs = hasil.filter((h) => h.siswa_id === siswa.id);
      const selesai = new Set(
        subs.filter((h) => h.pernah_benar).map((h) => h.challenge_id),
      );
      const totalPercobaan = subs.reduce(
        (akum, h) => akum + (h.percobaan ?? 0),
        0,
      );
      return {
        siswa,
        selesai: selesai.size,
        total: tantangan.length,
        totalPercobaan,
      };
    })
    .sort((a, b) => b.selesai - a.selesai);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/komputer"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Lab Komputer
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Hasil Lab Komputer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Progres dan hasil tantangan praktik dasar komputer.
        </p>
      </div>

      <form
        method="get"
        action="/guru/komputer/hasil"
        className="flex flex-wrap items-end gap-2"
      >
        <div>
          <label
            htmlFor="lesson"
            className="block text-xs font-medium text-slate-500"
          >
            Modul
          </label>
          <select
            id="lesson"
            name="lesson"
            defaultValue={lessonTerpilih.id}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.judul}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="kelas"
            className="block text-xs font-medium text-slate-500"
          >
            Kelas
          </label>
          <select
            id="kelas"
            name="kelas"
            defaultValue={kelasParam}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua kelas</option>
            {kelasList.map((kelas) => (
              <option key={kelas.id} value={kelas.id}>
                {kelas.nama_kelas}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Tampilkan
        </button>
      </form>

      {/* Ringkasan per siswa */}
      <Kartu>
        <KartuJudul
          judul="Ringkasan per Siswa"
          subjudul={`${lessonTerpilih.judul} · ${siswaTampil.length} siswa`}
        />
        {ringkasan.length > 0 ? (
          <>
            <ul className="mt-3 space-y-2 lg:hidden">
              {ringkasan.map((baris) => (
                <li
                  key={baris.siswa.id}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-sm font-medium text-slate-900">
                      {baris.siswa.nama_siswa}
                      {baris.siswa.nis ? (
                        <span className="ml-1 text-xs text-slate-400">
                          ({baris.siswa.nis})
                        </span>
                      ) : null}
                    </span>
                    <Badge
                      varian={
                        baris.selesai === baris.total && baris.total > 0
                          ? "sukses"
                          : baris.selesai > 0
                            ? "info"
                            : "netral"
                      }
                    >
                      {baris.selesai}/{baris.total}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {baris.siswa.kelas_id
                      ? (namaKelas.get(baris.siswa.kelas_id) ?? "-")
                      : "-"}{" "}
                    · {baris.totalPercobaan} percobaan
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">
                      Nama
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">
                      Kelas
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">
                      Selesai
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">
                      Total percobaan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ringkasan.map((baris) => (
                    <tr key={baris.siswa.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-900">
                        {baris.siswa.nama_siswa}
                        {baris.siswa.nis ? (
                          <span className="ml-1 text-xs text-slate-400">
                            ({baris.siswa.nis})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {baris.siswa.kelas_id
                          ? (namaKelas.get(baris.siswa.kelas_id) ?? "-")
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          varian={
                            baris.selesai === baris.total && baris.total > 0
                              ? "sukses"
                              : baris.selesai > 0
                                ? "info"
                                : "netral"
                          }
                        >
                          {baris.selesai}/{baris.total}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {baris.totalPercobaan}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState padat judul="Belum ada siswa" />
        )}
      </Kartu>

      {/* Detail per tantangan */}
      <div className="space-y-3">
        {tantangan.map((soal) => {
          const subsSoal = hasil.filter((h) => h.challenge_id === soal.id);
          const berhasil = subsSoal.filter((h) => h.pernah_benar).length;
          return (
            <details
              key={soal.id}
              className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                    {soal.level}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      {soal.judul}
                    </span>
                    <span className="text-xs text-slate-400">
                      {subsSoal.length} siswa mengerjakan · {berhasil} berhasil
                    </span>
                  </span>
                </span>
                <Badge varian={berhasil > 0 ? "sukses" : "netral"}>
                  {berhasil > 0 ? `${berhasil} berhasil` : "belum ada"}
                </Badge>
              </summary>

              <div className="space-y-2 border-t border-slate-100 px-5 py-4">
                {subsSoal.length > 0 ? (
                  subsSoal.map((sub) => {
                    const siswaSub = bacaSiswa(sub);
                    return (
                      <div
                        key={sub.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                      >
                        <span className="text-sm font-medium text-slate-900">
                          {siswaSub.nama_siswa}
                          {siswaSub.nis ? (
                            <span className="ml-1 text-xs text-slate-400">
                              ({siswaSub.nis})
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {sub.pernah_benar ? (
                            <Badge varian="sukses">Pernah benar</Badge>
                          ) : (
                            <Badge varian="bahaya">Belum benar</Badge>
                          )}
                          <span>
                            {sub.percobaan} percobaan
                            {sub.waktu_ms != null
                              ? ` · ${(sub.waktu_ms / 1000).toFixed(1)}s`
                              : ""}
                            {sub.skor != null ? ` · skor ${sub.skor}` : ""} ·{" "}
                            {tampilWaktu(sub.updated_at)}
                          </span>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">
                    Belum ada siswa yang mengerjakan tantangan ini.
                  </p>
                )}
              </div>
            </details>
          );
        })}

        {tantangan.length === 0 ? (
          <Kartu>
            <EmptyState
              ikon={<IkonKomputer className="h-6 w-6" />}
              judul="Modul ini belum punya tantangan"
            />
          </Kartu>
        ) : null}
      </div>
    </div>
  );
}
