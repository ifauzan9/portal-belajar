import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createSiswaClient } from "@/lib/supabase/siswa";
import { createAdminClient } from "@/lib/supabase/admin";
import { LabRunner } from "@/components/lab-runner";
import { PetaLevel } from "@/components/peta-level";
import { HeroSiswa } from "@/components/ui/hero-siswa";
import { ProgresBar } from "@/components/ui/progres";
import { IkonLab } from "@/components/ui/ikon-siswa";
import { TeksSoalTerlindungi } from "@/components/teks-soal-terlindungi";
import { hitungLevelTerkunci, infoGarisKeluaran } from "@/lib/lab";
import { ambilPengaturanSoal } from "@/lib/pengaturan-soal";

type LatihanRow = {
  id: string;
  level: number;
  judul: string;
  penjelasan: string;
  contoh_kode: string | null;
  instruksi: string;
  kode_awal: string | null;
  keluaran_diharapkan: string;
  poin: number;
  jenis: string;
  masukan: string | null;
  masukan_uji: string | null;
  aturan: {
    variabel_wajib?: string[];
    variabel_tetap?: Record<string, string>;
    final_boss?: boolean;
    badge?: string;
  } | null;
};

type HasilRow = {
  exercise_id: string;
  kode: string;
  benar: boolean;
  pernah_benar: boolean;
  percobaan: number;
};

// Input wajib disimpan satu baris per input(). Baris kosong di akhir dibuang.
function pecahMasukan(teks: string | null): string[] {
  if (!teks) return [];
  const baris = teks.replace(/\r\n/g, "\n").split("\n");
  while (baris.length > 0 && baris[baris.length - 1].trim() === "") baris.pop();
  return baris;
}

export default async function LevelLabSiswaPage(
  props: PageProps<"/siswa/lab/[id]/[level]">,
) {
  const { id, level } = await props.params;
  const levelNum = Number(level);
  if (!Number.isInteger(levelNum) || levelNum < 1) notFound();

  const { siswa } = await requireSiswa();
  const supabase = await createSiswaClient();
  const admin = createAdminClient();

  // Saklar global "tutup akses soal" (Tahap 41). Level lab tidak bisa dibuka
  // selama guru menutup akses.
  const pengaturanSoal = await ambilPengaturanSoal(supabase);
  if (pengaturanSoal.tutupLab) {
    redirect("/siswa/lab");
  }

  // Kolom `blokir_tempel` (Tahap 39) & `dibuka` (Tahap 42) baru ada setelah
  // DDL dijalankan; turun bertahap supaya modul yang kolomnya sudah ada tetap
  // bisa dibuka/ditutup walau tahap lainnya belum.
  const kolomLessonDasar = "id, judul, isi, coding_lesson_classes(kelas_id)";

  const hasilLessonLengkap = await supabase
    .from("coding_lessons")
    .select(`${kolomLessonDasar}, blokir_tempel, dibuka`)
    .eq("id", id)
    .maybeSingle();

  let lessonData: unknown = hasilLessonLengkap.data;

  if (hasilLessonLengkap.error) {
    // Coba tanpa `blokir_tempel` (Tahap 39 belum jalan).
    const tanpaBlokir = await supabase
      .from("coding_lessons")
      .select(`${kolomLessonDasar}, dibuka`)
      .eq("id", id)
      .maybeSingle();

    if (!tanpaBlokir.error) {
      lessonData = tanpaBlokir.data;
    } else {
      const fallback = await supabase
        .from("coding_lessons")
        .select(kolomLessonDasar)
        .eq("id", id)
        .maybeSingle();
      lessonData = fallback.data;
    }
  }

  if (!lessonData) redirect("/siswa/lab");

  const lesson = lessonData as {
    id: string;
    judul: string;
    isi: string | null;
    coding_lesson_classes?: { kelas_id: string }[];
    blokir_tempel?: boolean | null;
    dibuka?: boolean | null;
  };
  const lindungiSoal = lesson.blokir_tempel === true;

  // Saklar tutup per modul (Tahap 42): semua level modul ini ikut ditutup.
  if (lesson.dibuka === false) redirect("/siswa/lab");

  const daftarKelasId =
    lesson.coding_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) redirect("/siswa/lab");

  // Kolom masukan baru ada setelah SQL Tahap 29 dijalankan. Kalau belum ada,
  // halaman tetap jalan tanpa panel input supaya modul lama tidak ikut rusak.
  const KOLOM_LATIHAN =
    "id, level, judul, penjelasan, contoh_kode, instruksi, kode_awal, keluaran_diharapkan, poin, jenis, aturan";

  const lengkap = await supabase
    .from("coding_exercises")
    .select(`${KOLOM_LATIHAN}, masukan, masukan_uji`)
    .eq("lesson_id", id)
    .order("level", { ascending: true });

  const latihanData = lengkap.error
    ? (
        await supabase
          .from("coding_exercises")
          .select(KOLOM_LATIHAN)
          .eq("lesson_id", id)
          .order("level", { ascending: true })
      ).data
    : lengkap.data;

  const latihan = (latihanData ?? []) as LatihanRow[];
  const exercise = latihan.find((item) => item.level === levelNum);
  if (!exercise) notFound();

  // Ambil hasil siswa untuk semua level (untuk warna menu & status).
  const exerciseIds = latihan.map((item) => item.id);
  let hasil: HasilRow[] = [];
  if (exerciseIds.length > 0) {
    const { data } = await admin
      .from("coding_submissions")
      .select("exercise_id, kode, benar, pernah_benar, percobaan")
      .eq("siswa_id", siswa.id)
      .in("exercise_id", exerciseIds);
    hasil = (data ?? []) as HasilRow[];
  }

  const petaHasil = new Map(hasil.map((item) => [item.exercise_id, item]));
  const submission = petaHasil.get(exercise.id) ?? null;

  const selesai = latihan
    .filter((item) => petaHasil.get(item.id)?.pernah_benar === true)
    .map((item) => item.level);
  const dikerjakan = latihan
    .filter((item) => petaHasil.has(item.id))
    .map((item) => item.level);

  // Kunci berurutan ditentukan server: level N terkunci sampai N-1 benar.
  const levelTerkunci = hitungLevelTerkunci(
    latihan.map((item) => item.level),
    new Set(selesai),
  );

  // Kunci ketat: level terkunci tidak bisa dibuka walau lewat URL langsung.
  if (levelTerkunci.includes(levelNum)) {
    redirect(`/siswa/lab/${id}`);
  }

  const total = latihan.length;
  const adaSebelum = levelNum > 1;
  const adaSesudah = levelNum < total;
  const barisMasukan = pecahMasukan(exercise.masukan);
  const infoGaris = infoGarisKeluaran(exercise.keluaran_diharapkan);

  // Nama variabel yang dinilai pada tantangan ini. Untuk karya bebas
  // (level 15) daftar wajib kosong, jadi nama diambil dari instruksi lewat
  // pola "variabel bernama x" / "Simpan menggunakan variabel x".
  const variabelDiminta: string[] = (() => {
    const wajib = exercise.aturan?.variabel_wajib ?? [];
    if (wajib.length > 0) return wajib;
    if (exercise.jenis !== "bebas") return [];
    const cocok = [
      ...exercise.instruksi.matchAll(
        /variabel\s+(?:bernama\s+)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
      ),
    ].map((m) => m[1]);
    return [...new Set(cocok)];
  })();

  // Variabel tetap adalah variabel yang nilainya ditulis langsung di kode,
  // bukan diambil dari input(). Tampilkan bedanya supaya siswa tidak bingung.
  const variabelTetap = exercise.aturan?.variabel_tetap ?? {};
  const namaVariabelTetap = new Set(Object.keys(variabelTetap));
  const variabelDariInput = variabelDiminta.filter(
    (nama) => !namaVariabelTetap.has(nama),
  );
  const variabelLangsung = variabelDiminta.filter((nama) =>
    namaVariabelTetap.has(nama),
  );

  return (
    <div className="space-y-6">
      <HeroSiswa
        atas={
          <Link
            href={`/siswa/lab/${id}`}
            className="inline-flex items-center text-sm font-medium text-emerald-100 transition hover:text-white"
          >
            ← {lesson.judul}
          </Link>
        }
        label={`Tantangan ${exercise.level}`}
        judul={exercise.judul}
        subjudul="Tulis programmu sendiri. Jalankan untuk melihat hasil, lalu cocokkan dengan target."
        ikon={
          exercise.aturan?.final_boss ? (
            <span className="text-xl" aria-hidden="true">
              ⭐
            </span>
          ) : (
            <span className="text-lg font-bold tabular-nums">
              {exercise.level}
            </span>
          )
        }
        aksi={
          <>
            {exercise.aturan?.final_boss ? (
              <span className="inline-flex items-center rounded-full bg-amber-300 px-3 py-1.5 text-xs font-bold text-amber-950 ring-1 ring-amber-200">
                ⭐ FINAL BOSS
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25">
              {exercise.poin} XP
            </span>
            {submission?.pernah_benar ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
                ✓ Sudah benar
              </span>
            ) : null}
          </>
        }
      >
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm text-emerald-50">
            <span>
              Level {exercise.level} dari {total}
            </span>
            <span className="font-semibold text-white">
              {selesai.length}/{total} benar
            </span>
          </div>
          <ProgresBar
            nilai={total > 0 ? Math.round((selesai.length / total) * 100) : 0}
            label={`Progres modul ${selesai.length} dari ${total} level`}
            warna="putih"
            ukuran="sm"
            className="mt-2"
          />
        </div>
      </HeroSiswa>

      <PetaLevel
        lessonId={id}
        levels={latihan.map((item) => ({
          level: item.level,
          judul: item.judul,
        }))}
        selesai={selesai}
        dikerjakan={dikerjakan}
        aktif={levelNum}
        terkunci={levelTerkunci}
      />

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-emerald-100 bg-emerald-50/70 px-5 py-4 sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <IkonLab className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">
              Tantangan {exercise.level}
            </p>
            <h2 className="text-lg font-semibold text-slate-950">
              Apa yang perlu dibuat?
            </h2>
          </div>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <TeksSoalTerlindungi
            aktif={lindungiSoal}
            className="max-w-3xl whitespace-pre-wrap text-base leading-7 text-slate-800"
          >
            {exercise.instruksi}
          </TeksSoalTerlindungi>
          {lindungiSoal ? (
            <p className="text-xs font-medium text-amber-700">
              🔒 Teks soal tidak dapat disalin.
            </p>
          ) : null}

          {barisMasukan.length > 0 ? (
            <TeksSoalTerlindungi
              aktif={lindungiSoal}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {exercise.jenis === "bebas" ? "Contoh input" : "Input wajib"}
                </h3>
                <p className="text-xs text-slate-500">
                  {exercise.jenis === "bebas"
                    ? "Pakai minimal 5 baris pertama saat modal input muncul."
                    : "Tulis saat modal input muncul, satu per satu."}
                </p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {barisMasukan.map((isi, urutan) => (
                  <li key={urutan} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-200 text-[11px] font-semibold text-slate-600">
                      {urutan + 1}
                    </span>
                    <code className="font-mono text-sm break-words text-slate-900">
                      {isi === "" ? "(kosong)" : isi}
                    </code>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                {exercise.jenis === "bebas" ? (
                  <>
                    Pakai minimal 5 baris pertama. Baris sisanya cadangan kalau
                    programmu meminta lebih banyak masukan.
                  </>
                ) : (
                  <>
                    Saat menekan Run Python, muncul jendela input satu per
                    satu. Ketik nilainya persis seperti daftar ini dengan
                    urutan yang sama. Kamu boleh menulis{" "}
                    <code className="font-mono">input(&quot;Nama: &quot;)</code>{" "}
                    — teks pertanyaannya hanya tampil di jendela input, tidak
                    ikut menjadi output.
                  </>
                )}
              </p>
            </TeksSoalTerlindungi>
          ) : null}

          {exercise.jenis !== "bebas" ? (
            <TeksSoalTerlindungi
              aktif={lindungiSoal}
              className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-emerald-900">
                  Target output
                </h3>
                <p className="text-xs text-emerald-700/80">
                  Gunakan sebagai acuan, jangan disalin.
                </p>
              </div>
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-100 select-none whitespace-pre-wrap">
                {exercise.keluaran_diharapkan}
              </pre>
              {infoGaris.length > 0 ? (
                <p className="mt-2 text-xs leading-5 text-emerald-800/80">
                  Garis pembatas:{" "}
                  {infoGaris
                    .map(
                      (garis) =>
                        `${garis.panjang.join("/")} karakter "${garis.simbol}"`,
                    )
                    .join(" dan ")}
                </p>
              ) : null}
            </TeksSoalTerlindungi>
          ) : null}

          {variabelDiminta.length > 0 ? (
            <TeksSoalTerlindungi
              aktif={lindungiSoal}
              className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-indigo-950">
                  Variabel yang diminta
                </h3>
                <p className="text-xs text-indigo-800/70">
                  Nama harus sama persis
                </p>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {variabelDiminta.map((nama, urutan) => (
                  <li
                    key={nama}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 shadow-sm"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                      {urutan + 1}
                    </span>
                    <code className="font-mono text-sm font-semibold text-indigo-950">
                      {nama}
                    </code>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        namaVariabelTetap.has(nama)
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {namaVariabelTetap.has(nama) ? "nilai tetap" : "input"}
                    </span>
                  </li>
                ))}
              </ul>
              {variabelDariInput.length > 0 ? (
                <p className="mt-3 text-xs leading-5 text-indigo-900/80">
                  Isi variabel{" "}
                  <strong>{variabelDariInput.join(", ")}</strong> dari{" "}
                  <code className="font-mono">input()</code>.
                </p>
              ) : null}
              {variabelLangsung.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <p className="font-semibold">
                    Tulis langsung di kode (bukan dari input())
                  </p>
                  <ul className="mt-1 space-y-1">
                    {variabelLangsung.map((nama) => (
                      <li key={nama}>
                        <code className="font-mono">
                          {`${nama} = "${variabelTetap[nama]}"`}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-indigo-900/80">
                Tampilkan semua variabel di atas dengan{" "}
                <code className="font-mono">print()</code>. Penilaian mengecek
                nama variabel, asal nilainya, dan urutannya.
              </p>
            </TeksSoalTerlindungi>
          ) : null}
        </div>
      </section>

      <LabRunner
        exerciseId={exercise.id}
        kodeAwal={exercise.kode_awal}
        keluaranDiharapkan={exercise.keluaran_diharapkan}
        kodeTersimpan={submission?.kode ?? null}
        percobaanAwal={submission?.percobaan ?? 0}
        pernahBenarAwal={submission?.pernah_benar ?? false}
        judul={exercise.judul}
        levelNumber={exercise.level}
        instruksi={exercise.instruksi}
        jenis={exercise.jenis}
        bantuan={lesson.isi}
        variabelDiminta={variabelDiminta}
        variabelTetap={variabelTetap}
        finalBoss={exercise.aturan?.final_boss ?? false}
        badge={exercise.aturan?.badge ?? null}
        contoh={exercise.contoh_kode}
        masukan={exercise.masukan ?? ""}
        punyaUji={Boolean(exercise.masukan_uji?.trim())}
        blokirTempel={lesson.blokir_tempel === true}
      />

      <div className="flex items-center justify-between gap-3">
        {adaSebelum ? (
          <Link
            href={`/siswa/lab/${id}/${levelNum - 1}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← Level {levelNum - 1}
          </Link>
        ) : (
          <span />
        )}
        {adaSesudah && submission?.pernah_benar ? (
          <Link
            href={`/siswa/lab/${id}/${levelNum + 1}`}
            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            Level {levelNum + 1} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
