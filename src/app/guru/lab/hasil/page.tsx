import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";
import { KepalaUrut } from "@/components/kepala-urut";
import { formatWaktuWib } from "@/lib/waktu";
import { bacaArah, type Arah } from "@/lib/urutkan-siswa";
import {
  bacaUrutHasilLab,
  urutkanHasilLab,
  type UrutHasilLab,
} from "@/lib/urutkan-hasil-lab";

function tampilWaktu(iso: string | null): string {
  return formatWaktuWib(iso);
}

// Pilihan pengurutan untuk form filter (dipakai juga di layar kecil yang
// tidak punya judul kolom tabel).
const PILIHAN_URUT: { nilai: UrutHasilLab; label: string }[] = [
  { nilai: "selesai", label: "Level selesai" },
  { nilai: "nama", label: "Nama" },
  { nilai: "nis", label: "NIS" },
  { nilai: "kelas", label: "Kelas" },
  { nilai: "percobaan", label: "Total percobaan" },
];

// URL halaman ini dengan filter + pengurutan yang sedang aktif. Modul dan
// kelas harus selalu ikut, supaya mengurutkan tidak menghapus filter.
function buatUrl(
  lesson: string,
  kelas: string,
  urut: UrutHasilLab,
  arah: Arah,
) {
  const params = new URLSearchParams();
  params.set("lesson", lesson);
  if (kelas) params.set("kelas", kelas);
  params.set("urut", urut);
  params.set("arah", arah);
  return `/guru/lab/hasil?${params.toString()}`;
}

// Klik kolom yang sama membalik arah; kolom baru mulai dari naik.
function urlKlik(
  lesson: string,
  kelas: string,
  kolom: UrutHasilLab,
  urut: UrutHasilLab,
  arah: Arah,
) {
  const arahBaru: Arah = urut === kolom && arah === "asc" ? "desc" : "asc";
  return buatUrl(lesson, kelas, kolom, arahBaru);
}

type SubmissionRow = {
  id: string;
  exercise_id: string;
  siswa_id: string;
  kode: string;
  keluaran: string;
  benar: boolean;
  pernah_benar: boolean;
  percobaan: number;
  updated_at: string | null;
};

export default async function HasilLabPage(
  props: PageProps<"/guru/lab/hasil">,
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
  // Tanpa parameter: tetap seperti sebelumnya (level selesai terbanyak dulu).
  const urut = bacaUrutHasilLab(searchParams.urut);
  const arah: Arah =
    searchParams.arah === undefined ? "desc" : bacaArah(searchParams.arah);

  const [hasilLesson, hasilKelas, hasilSiswa] = await Promise.all([
    supabase
      .from("coding_lessons")
      .select("id, judul, urutan, coding_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true }),
    supabase
      .from("classes")
      .select("id, nama_kelas")
      .order("nama_kelas", { ascending: true }),
    supabase.from("students").select("id, nama_siswa, nis, kelas_id"),
  ]);

  const lessons = (
    (hasilLesson.data ?? []) as {
      id: string;
      judul: string;
      coding_lesson_classes?: { kelas_id: string }[] | null;
    }[]
  ).map((lesson) => ({
    id: lesson.id,
    judul: lesson.judul,
    // Kosong = modul untuk semua kelas.
    kelasIds: (lesson.coding_lesson_classes ?? []).map((k) => k.kelas_id),
  }));
  if (lessons.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/guru/lab"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Lab Coding
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Hasil Lab Coding
          </h1>
        </div>
        <Kartu>
          <EmptyState
            ikon={<IkonBuku className="h-6 w-6" />}
            judul="Belum ada modul"
            keterangan="Jalankan schema.sql Tahap 17 untuk memuat Modul 1."
          />
        </Kartu>
      </div>
    );
  }

  const kelasList = (hasilKelas.data ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  const modulUntukKelas = (kelasId: string) =>
    lessons.find(
      (lesson) =>
        lesson.kelasIds.length === 0 || lesson.kelasIds.includes(kelasId),
    );

  // Tanpa parameter modul, pilih modul pertama yang relevan untuk kelas yang
  // sedang difilter. Kalau guru memilih modul secara eksplisit, hormati pilihan
  // itu (walaupun modul tersebut bukan untuk kelas yang difilter).
  const lessonTerpilih =
    lessons.find((l) => l.id === lessonParam) ??
    (kelasParam ? modulUntukKelas(kelasParam) : undefined) ??
    lessons[0];

  // Modul terpilih tidak ditujukan untuk kelas yang difilter. Tampilkan
  // peringatan supaya angka 0 tidak disalahartikan sebagai "tidak ada hasil".
  const modulTidakUntukKelas =
    kelasParam !== "" &&
    lessonTerpilih.kelasIds.length > 0 &&
    !lessonTerpilih.kelasIds.includes(kelasParam);

  const semuaSiswa = (hasilSiswa.data ?? []) as {
    id: string;
    nama_siswa: string;
    nis: string | null;
    kelas_id: string | null;
  }[];

  const { data: latihanData } = await supabase
    .from("coding_exercises")
    .select("id, level, judul, poin")
    .eq("lesson_id", lessonTerpilih.id)
    .order("level", { ascending: true });

  const latihan = (latihanData ?? []) as {
    id: string;
    level: number;
    judul: string;
    poin: number;
  }[];

  const exerciseIds = latihan.map((l) => l.id);

  // PostgREST membatasi satu respons (bawaan 1000 baris). Satu modul bisa
  // punya ribuan submission, jadi ambil bertahap. Tanpa ini, siswa yang
  // barisnya jatuh di luar 1000 pertama tampil seolah belum mengerjakan.
  let submissions: SubmissionRow[] = [];
  let galatSubmissions: string | null = null;
  if (exerciseIds.length > 0) {
    let dari = 0;
    while (true) {
      const { data, error } = await supabase
        .from("coding_submissions")
        .select(
          "id, exercise_id, siswa_id, kode, keluaran, benar, pernah_benar, percobaan, updated_at",
        )
        .in("exercise_id", exerciseIds)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(dari, dari + 999);
      if (error) {
        galatSubmissions = error.message;
        break;
      }

      const batch = (data ?? []) as unknown as SubmissionRow[];
      submissions.push(...batch);
      if (batch.length < 1000) break;
      dari += 1000;
    }
  }

  // Filter kelas (opsional). Relasi `students` di dalam select di atas bisa
  // tidak terbaca; nama/kelas siswa lalu diambil dari daftar `semuaSiswa`.
  const petaSiswa = new Map(semuaSiswa.map((s) => [s.id, s]));
  const siswaDariSub = (sub: SubmissionRow) =>
    petaSiswa.get(sub.siswa_id) ?? {
      nama_siswa: "Siswa",
      nis: null,
      kelas_id: null,
    };

  if (kelasParam) {
    submissions = submissions.filter(
      (sub) => siswaDariSub(sub).kelas_id === kelasParam,
    );
  }

  const namaKelasTerpilih = kelasParam
    ? (namaKelas.get(kelasParam) ?? "kelas ini")
    : null;

  // Hanya siswa dari kelas yang menjadi target modul. Tanpa filter ini, siswa
  // dari kelas lain ikut tampil dan seolah-olah "tidak punya progres".
  const siswaTampil = semuaSiswa.filter((s) => {
    if (kelasParam && s.kelas_id !== kelasParam) return false;
    if (lessonTerpilih.kelasIds.length === 0) return true;
    return s.kelas_id !== null && lessonTerpilih.kelasIds.includes(s.kelas_id);
  });

  // Ringkasan per siswa: berapa level pernah benar.
  const ringkasan = urutkanHasilLab(
    siswaTampil.map((siswa) => {
      const subsSiswa = submissions.filter((s) => s.siswa_id === siswa.id);
      const selesai = new Set(
        subsSiswa.filter((s) => s.pernah_benar).map((s) => s.exercise_id),
      );
      const totalPercobaan = subsSiswa.reduce(
        (akum, s) => akum + (s.percobaan ?? 0),
        0,
      );
      return {
        siswa,
        selesai: selesai.size,
        total: latihan.length,
        totalPercobaan,
      };
    }),
    namaKelas,
    urut,
    arah,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/lab"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Lab Coding
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Hasil Lab Coding
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kode, output, dan ringkasan pengerjaan siswa.
        </p>
      </div>

      {galatSubmissions ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Gagal memuat hasil pengerjaan: {galatSubmissions}
        </p>
      ) : null}

      {modulTidakUntukKelas ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Modul <strong>{lessonTerpilih.judul}</strong> tidak ditujukan untuk
          kelas {namaKelasTerpilih}. Pilih modul lain, atau kosongkan filter
          kelas untuk melihat semua siswa.
        </p>
      ) : null}

      <form
        method="get"
        action="/guru/lab/hasil"
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
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            Untuk:{" "}
            {lessonTerpilih.kelasIds.length === 0
              ? "semua kelas"
              : lessonTerpilih.kelasIds
                  .map((idK) => namaKelas.get(idK) ?? "-")
                  .sort((a, b) => a.localeCompare(b, "id", { numeric: true }))
                  .join(", ")}
          </p>
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
        <div>
          <label
            htmlFor="urut"
            className="block text-xs font-medium text-slate-500"
          >
            Urutkan
          </label>
          <select
            id="urut"
            name="urut"
            defaultValue={urut}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {PILIHAN_URUT.map((pilihan) => (
              <option key={pilihan.nilai} value={pilihan.nilai}>
                {pilihan.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="arah"
            className="block text-xs font-medium text-slate-500"
          >
            Arah
          </label>
          <select
            id="arah"
            name="arah"
            defaultValue={arah}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="asc">Naik</option>
            <option value="desc">Turun</option>
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
              {ringkasan.map((baris, index) => (
                <li
                  key={baris.siswa.id}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-sm font-medium text-slate-900">
                      <span className="mr-2 tabular-nums text-slate-400">
                        {index + 1}.
                      </span>
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
                  <th
                    scope="col"
                    className="w-12 px-3 py-2 text-left font-medium text-slate-500"
                  >
                    No
                  </th>
                  <KepalaUrut
                    label="Nama"
                    href={urlKlik(
                      lessonTerpilih.id,
                      kelasParam,
                      "nama",
                      urut,
                      arah,
                    )}
                    aktif={urut === "nama"}
                    arah={arah}
                    padat
                  />
                  <KepalaUrut
                    label="Kelas"
                    href={urlKlik(
                      lessonTerpilih.id,
                      kelasParam,
                      "kelas",
                      urut,
                      arah,
                    )}
                    aktif={urut === "kelas"}
                    arah={arah}
                    padat
                  />
                  <KepalaUrut
                    label="Level selesai"
                    href={urlKlik(
                      lessonTerpilih.id,
                      kelasParam,
                      "selesai",
                      urut,
                      arah,
                    )}
                    aktif={urut === "selesai"}
                    arah={arah}
                    padat
                  />
                  <KepalaUrut
                    label="Total percobaan"
                    href={urlKlik(
                      lessonTerpilih.id,
                      kelasParam,
                      "percobaan",
                      urut,
                      arah,
                    )}
                    aktif={urut === "percobaan"}
                    arah={arah}
                    align="right"
                    padat
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ringkasan.map((baris, index) => (
                  <tr key={baris.siswa.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 tabular-nums text-slate-400">
                      {index + 1}
                    </td>
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
                        ? namaKelas.get(baris.siswa.kelas_id) ?? "-"
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
          <EmptyState
            padat
            judul="Belum ada siswa"
            keterangan={
              modulTidakUntukKelas
                ? `Modul ini tidak ditujukan untuk kelas ${namaKelasTerpilih ?? "yang dipilih"}.`
                : "Tidak ada siswa yang cocok dengan filter saat ini."
            }
          />
        )}
      </Kartu>

      {/* Detail per level */}
      <div className="space-y-3">
        {latihan.map((soal) => {
          const subsSoal = submissions.filter((s) => {
            if (s.exercise_id !== soal.id) return false;
            // Samakan cakupan detail dengan ringkasan (target modul + filter).
            const kelasId = siswaDariSub(s).kelas_id;
            if (kelasParam && kelasId !== kelasParam) return false;
            if (lessonTerpilih.kelasIds.length === 0) return true;
            return kelasId !== null && lessonTerpilih.kelasIds.includes(kelasId);
          });
          const berhasil = subsSoal.filter((s) => s.pernah_benar).length;
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

              <div className="space-y-3 border-t border-slate-100 px-5 py-4">
                {subsSoal.length > 0 ? (
                  subsSoal.map((sub) => {
                    const siswaSub = siswaDariSub(sub);
                    return (
                      <div
                        key={sub.id}
                        className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
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
                              {sub.percobaan} percobaan ·{" "}
                              {tampilWaktu(sub.updated_at)}
                            </span>
                          </span>
                        </div>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-medium text-slate-600">
                            Lihat kode &amp; output
                          </summary>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                                Kode
                              </p>
                              <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
                                {sub.kode || "(kosong)"}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                                Output
                              </p>
                              <pre className="max-h-64 overflow-auto rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700">
                                {sub.keluaran || "(tidak ada output)"}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">
                    Belum ada siswa yang mengerjakan level ini.
                  </p>
                )}
              </div>
            </details>
          );
        })}

        {latihan.length === 0 ? (
          <Kartu>
            <EmptyState
              ikon={<IkonBuku className="h-6 w-6" />}
              judul="Modul ini belum punya level"
            />
          </Kartu>
        ) : null}
      </div>
    </div>
  );
}
