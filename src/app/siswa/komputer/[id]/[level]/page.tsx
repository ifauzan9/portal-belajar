import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { TantanganKomputer, type Konfigurasi } from "@/components/tantangan-komputer";
import { PetaLevel } from "@/components/peta-level";

type TantanganRow = {
  id: string;
  level: number;
  judul: string;
  jenis: string;
  penjelasan: string;
  contoh: string | null;
  instruksi: string;
  konfigurasi: Record<string, unknown>;
  poin: number;
};

export default async function LevelKomputerSiswaPage(
  props: PageProps<"/siswa/komputer/[id]/[level]">,
) {
  const { id, level } = await props.params;
  const levelNum = Number(level);
  if (!Number.isInteger(levelNum) || levelNum < 1) notFound();

  const { siswa } = await requireSiswa();
  const supabase = await createClient();

  const { data: lessonData } = await supabase
    .from("komputer_lessons")
    .select("id, judul, komputer_lesson_classes(kelas_id)")
    .eq("id", id)
    .maybeSingle();

  if (!lessonData) redirect("/siswa/komputer");

  const lesson = lessonData as {
    id: string;
    judul: string;
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
    .select("id, level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin")
    .eq("lesson_id", id)
    .order("level", { ascending: true });

  const tantangan = (tantanganData ?? []) as TantanganRow[];
  const aktif = tantangan.find((t) => t.level === levelNum);
  if (!aktif) notFound();

  const challengeIds = tantangan.map((t) => t.id);
  let hasil: {
    challenge_id: string;
    benar: boolean;
    pernah_benar: boolean;
    percobaan: number;
  }[] = [];
  if (challengeIds.length > 0) {
    const { data } = await supabase
      .from("komputer_hasil")
      .select("challenge_id, benar, pernah_benar, percobaan")
      .eq("siswa_id", siswa.id)
      .in("challenge_id", challengeIds);
    hasil = (data ?? []) as typeof hasil;
  }

  const petaHasil = new Map(hasil.map((h) => [h.challenge_id, h]));
  const hasilAktif = petaHasil.get(aktif.id) ?? null;

  const selesai = tantangan
    .filter((t) => petaHasil.get(t.id)?.pernah_benar === true)
    .map((t) => t.level);
  const dikerjakan = tantangan
    .filter((t) => petaHasil.has(t.id))
    .map((t) => t.level);

  const total = tantangan.length;
  const berikutLevel = levelNum < total ? levelNum + 1 : null;
  const sebelumLevel = levelNum > 1 ? levelNum - 1 : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/siswa/komputer/${id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← {lesson.judul}
        </Link>
      </div>

      <PetaLevel
        lessonId={id}
        basePath="/siswa/komputer"
        levels={tantangan.map((t) => ({ level: t.level, judul: t.judul }))}
        selesai={selesai}
        dikerjakan={dikerjakan}
        aktif={levelNum}
      />

      <TantanganKomputer
        challengeId={aktif.id}
        jenis={aktif.jenis}
        konfigurasi={aktif.konfigurasi as unknown as Konfigurasi}
        judul={aktif.judul}
        level={aktif.level}
        penjelasan={aktif.penjelasan}
        contoh={aktif.contoh}
        instruksi={aktif.instruksi}
        poin={aktif.poin}
        lessonId={id}
        berikutLevel={berikutLevel}
        pernahBenarAwal={hasilAktif?.pernah_benar ?? false}
        percobaanAwal={hasilAktif?.percobaan ?? 0}
      />

      <div className="flex items-center justify-between gap-3">
        {sebelumLevel ? (
          <Link
            href={`/siswa/komputer/${id}/${sebelumLevel}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← Level {sebelumLevel}
          </Link>
        ) : (
          <span />
        )}
        {berikutLevel ? (
          <Link
            href={`/siswa/komputer/${id}/${berikutLevel}`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Level {berikutLevel} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
