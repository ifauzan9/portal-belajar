import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { EmptyState } from "@/components/ui/empty-state";
import { TombolReset } from "@/components/tombol-reset";
import { createClient } from "@/lib/supabase/server";
import { ambilKelasTugas } from "@/lib/tugas";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { relevansiKelas } from "@/lib/rekap";

// ============================================================================
// Detail rekap satu siswa — empat seksi kegiatan + tombol reset per kegiatan.
// ============================================================================

function formatWaktu(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(t);
}

function BarisKegiatan({
  judul,
  keterangan,
  badge,
  reset,
}: {
  judul: string;
  keterangan: string;
  badge: ReactNode;
  reset?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{judul}</p>
        <p className="text-xs text-slate-400">{keterangan}</p>
      </div>
      <div className="flex items-center gap-3">
        {badge}
        {reset}
      </div>
    </div>
  );
}

const badgeBelum = <Badge varian="netral">Belum</Badge>;

export default async function DetailRekapPage({
  params,
}: {
  params: Promise<{ siswaId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { siswaId } = await params;

  const [hasilSiswa, hasilKelas] = await Promise.all([
    supabase
      .from("students")
      .select("id, nis, nama_siswa, kelas_id")
      .eq("id", siswaId)
      .maybeSingle(),
    supabase.from("classes").select("id, nama_kelas"),
  ]);

  const siswa = hasilSiswa.data as {
    id: string;
    nis: string | null;
    nama_siswa: string;
    kelas_id: string | null;
  } | null;

  if (!siswa) {
    notFound();
  }

  const namaKelas = new Map(
    (hasilKelas.data ?? []).map((k) => [
      (k as { id: string }).id,
      (k as { nama_kelas: string }).nama_kelas,
    ]),
  );
  const kelasSiswa = siswa.kelas_id
    ? (namaKelas.get(siswa.kelas_id) ?? "Kelas tak ditemukan")
    : "Belum ada kelas";

  const [
    hasilTugas,
    hasilKumpul,
    hasilUlangan,
    hasilNilai,
    hasilSubmitUlangan,
    hasilLessonLab,
    hasilLatihanLab,
    hasilSubLab,
    hasilLessonKom,
    hasilTantanganKom,
    hasilHasilKom,
  ] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, judul, tenggat, assignment_classes(kelas_id)"),
    supabase
      .from("assignment_submissions")
      .select("tugas_id, nilai, updated_at")
      .eq("siswa_id", siswaId),
    supabase
      .from("exams")
      .select("id, judul, tanggal, status, kelas_id, exam_classes(kelas_id)"),
    supabase.from("exam_scores").select("exam_id, nilai").eq("siswa_id", siswaId),
    supabase
      .from("exam_submissions")
      .select("exam_id, nilai_total")
      .eq("siswa_id", siswaId),
    supabase
      .from("coding_lessons")
      .select("id, judul, urutan, coding_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true }),
    supabase
      .from("coding_exercises")
      .select("id, lesson_id, level, judul")
      .order("level", { ascending: true }),
    supabase
      .from("coding_submissions")
      .select("exercise_id, pernah_benar, percobaan, updated_at")
      .eq("siswa_id", siswaId),
    supabase
      .from("komputer_lessons")
      .select("id, judul, urutan, komputer_lesson_classes(kelas_id)")
      .order("urutan", { ascending: true }),
    supabase
      .from("komputer_challenges")
      .select("id, lesson_id, level, judul")
      .order("level", { ascending: true }),
    supabase
      .from("komputer_hasil")
      .select("challenge_id, pernah_benar, percobaan, skor, updated_at")
      .eq("siswa_id", siswaId),
  ]);

  // ---------- Tugas ----------
  const mapKumpul = new Map(
    (hasilKumpul.data ?? []).map((s) => [
      (s as { tugas_id: string }).tugas_id,
      s as { nilai: number | null; updated_at: string | null },
    ]),
  );
  const tugasRelevan = (
    (hasilTugas.data ?? []) as {
      id: string;
      judul: string;
      tenggat: string | null;
      assignment_classes?: { kelas_id: string }[] | null;
    }[]
  )
    .filter((t) => relevansiKelas(ambilKelasTugas(t), siswa.kelas_id))
    .sort((a, b) => a.judul.localeCompare(b.judul, "id"));

  // ---------- Ulangan ----------
  const mapNilai = new Map(
    (hasilNilai.data ?? []).map((n) => [
      (n as { exam_id: string }).exam_id,
      (n as { nilai: number }).nilai,
    ]),
  );
  const mapSubmit = new Map(
    (hasilSubmitUlangan.data ?? []).map((s) => [
      (s as { exam_id: string }).exam_id,
      s as { nilai_total: number },
    ]),
  );
  const ulanganRelevan = (
    (hasilUlangan.data ?? []) as {
      id: string;
      judul: string;
      tanggal: string | null;
      status: "akan" | "sudah";
      kelas_id: string | null;
      exam_classes?: { kelas_id: string }[] | null;
    }[]
  )
    .filter((u) => relevansiKelas(ambilKelasUlangan(u), siswa.kelas_id))
    .sort((a, b) => a.judul.localeCompare(b.judul, "id"));

  // ---------- Lab Coding ----------
  const lessonLab = (hasilLessonLab.data ?? []) as {
    id: string;
    judul: string;
    urutan: number;
    coding_lesson_classes?: { kelas_id: string }[] | null;
  }[];
  const mapLessonLab = new Map(lessonLab.map((l) => [l.id, l]));
  const mapSubLab = new Map(
    (hasilSubLab.data ?? []).map((s) => [
      (s as { exercise_id: string }).exercise_id,
      s as {
        pernah_benar: boolean;
        percobaan: number;
        updated_at: string | null;
      },
    ]),
  );
  const latihanRelevan = (
    (hasilLatihanLab.data ?? []) as {
      id: string;
      lesson_id: string;
      level: number;
      judul: string;
    }[]
  )
    .filter((l) => {
      const lesson = mapLessonLab.get(l.lesson_id);
      if (!lesson) return false;
      return relevansiKelas(
        (lesson.coding_lesson_classes ?? []).map((k) => k.kelas_id),
        siswa.kelas_id,
      );
    })
    .sort((a, b) => {
      const ua = mapLessonLab.get(a.lesson_id)?.urutan ?? 0;
      const ub = mapLessonLab.get(b.lesson_id)?.urutan ?? 0;
      if (ua !== ub) return ua - ub;
      return a.level - b.level;
    });

  // ---------- Lab Komputer ----------
  const lessonKom = (hasilLessonKom.data ?? []) as {
    id: string;
    judul: string;
    urutan: number;
    komputer_lesson_classes?: { kelas_id: string }[] | null;
  }[];
  const mapLessonKom = new Map(lessonKom.map((l) => [l.id, l]));
  const mapHasilKom = new Map(
    (hasilHasilKom.data ?? []).map((h) => [
      (h as { challenge_id: string }).challenge_id,
      h as {
        pernah_benar: boolean;
        percobaan: number;
        skor: number | null;
        updated_at: string | null;
      },
    ]),
  );
  const tantanganRelevan = (
    (hasilTantanganKom.data ?? []) as {
      id: string;
      lesson_id: string;
      level: number;
      judul: string;
    }[]
  )
    .filter((t) => {
      const lesson = mapLessonKom.get(t.lesson_id);
      if (!lesson) return false;
      return relevansiKelas(
        (lesson.komputer_lesson_classes ?? []).map((k) => k.kelas_id),
        siswa.kelas_id,
      );
    })
    .sort((a, b) => {
      const ua = mapLessonKom.get(a.lesson_id)?.urutan ?? 0;
      const ub = mapLessonKom.get(b.lesson_id)?.urutan ?? 0;
      if (ua !== ub) return ua - ub;
      return a.level - b.level;
    });

  // ---------- Ringkasan angka ----------
  const tugasSelesai = tugasRelevan.filter((t) => mapKumpul.has(t.id)).length;
  const ulanganSelesai = ulanganRelevan.filter(
    (u) => mapNilai.has(u.id) || mapSubmit.has(u.id),
  ).length;
  const labCodingSelesai = latihanRelevan.filter((l) =>
    mapSubLab.has(l.id),
  ).length;
  const labKomputerSelesai = tantanganRelevan.filter((t) =>
    mapHasilKom.has(t.id),
  ).length;

  const ringkasan = [
    { label: "Tugas", selesai: tugasSelesai, total: tugasRelevan.length },
    { label: "Ulangan", selesai: ulanganSelesai, total: ulanganRelevan.length },
    { label: "Lab Coding", selesai: labCodingSelesai, total: latihanRelevan.length },
    {
      label: "Lab Komputer",
      selesai: labKomputerSelesai,
      total: tantanganRelevan.length,
    },
  ];

  const galat =
    hasilTugas.error?.message ??
    hasilUlangan.error?.message ??
    hasilLessonLab.error?.message ??
    hasilLessonKom.error?.message ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/rekap"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Rekap Siswa
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {siswa.nama_siswa}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {siswa.nis ? `NIS ${siswa.nis} · ` : ""}
          {kelasSiswa}
        </p>
      </div>

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat data: {galat}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ringkasan.map((r) => (
          <div
            key={r.label}
            className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
          >
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              {r.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {r.selesai}/{r.total}
            </p>
          </div>
        ))}
      </div>

      {/* ---------- Tugas ---------- */}
      <Kartu>
        <KartuJudul
          judul="Tugas"
          subjudul={`${tugasSelesai} dari ${tugasRelevan.length} tugas dikumpulkan`}
        />
        {tugasRelevan.length > 0 ? (
          <div className="mt-4 space-y-2">
            {tugasRelevan.map((t) => {
              const sub = mapKumpul.get(t.id);
              return (
                <BarisKegiatan
                  key={t.id}
                  judul={t.judul}
                  keterangan={`Tenggat: ${formatWaktu(t.tenggat)}`}
                  badge={
                    sub ? (
                      <Badge varian="sukses" titik>
                        {sub.nilai === null
                          ? "Dikumpulkan"
                          : `Nilai ${sub.nilai}`}
                      </Badge>
                    ) : (
                      badgeBelum
                    )
                  }
                  reset={
                    sub ? (
                      <TombolReset
                        jenis="tugas"
                        siswaId={siswa.id}
                        refId={t.id}
                        label={t.judul}
                      />
                    ) : null
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState padat judul="Belum ada tugas untuk kelas ini" />
        )}
      </Kartu>

      {/* ---------- Ulangan ---------- */}
      <Kartu>
        <KartuJudul
          judul="Ulangan"
          subjudul={`${ulanganSelesai} dari ${ulanganRelevan.length} ulangan dikerjakan`}
        />
        {ulanganRelevan.length > 0 ? (
          <div className="mt-4 space-y-2">
            {ulanganRelevan.map((u) => {
              const nilai = mapNilai.get(u.id);
              const sub = mapSubmit.get(u.id);
              const nilaiTampil = nilai ?? sub?.nilai_total ?? null;
              const dikerjakan = nilai !== undefined || sub !== undefined;
              return (
                <BarisKegiatan
                  key={u.id}
                  judul={u.judul}
                  keterangan={`${formatWaktu(u.tanggal)} · ${
                    u.status === "akan" ? "Online" : "Manual"
                  }`}
                  badge={
                    dikerjakan ? (
                      <Badge varian="sukses" titik>
                        {nilaiTampil === null
                          ? "Dikerjakan"
                          : `Nilai ${nilaiTampil}`}
                      </Badge>
                    ) : (
                      badgeBelum
                    )
                  }
                  reset={
                    dikerjakan ? (
                      <TombolReset
                        jenis="ulangan"
                        siswaId={siswa.id}
                        refId={u.id}
                        label={u.judul}
                      />
                    ) : null
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState padat judul="Belum ada ulangan untuk kelas ini" />
        )}
      </Kartu>

      {/* ---------- Lab Coding ---------- */}
      <Kartu>
        <KartuJudul
          judul="Lab Coding"
          subjudul={`${labCodingSelesai} dari ${latihanRelevan.length} level dikerjakan`}
        />
        {latihanRelevan.length > 0 ? (
          <div className="mt-4 space-y-2">
            {latihanRelevan.map((l) => {
              const sub = mapSubLab.get(l.id);
              const lesson = mapLessonLab.get(l.lesson_id);
              return (
                <BarisKegiatan
                  key={l.id}
                  judul={`${lesson?.judul ?? "Modul"} — Level ${l.level}: ${l.judul}`}
                  keterangan={
                    sub
                      ? `${sub.percobaan} percobaan · ${formatWaktu(sub.updated_at)}`
                      : "Belum dikerjakan"
                  }
                  badge={
                    sub ? (
                      <Badge varian={sub.pernah_benar ? "sukses" : "bahaya"}>
                        {sub.pernah_benar ? "Pernah benar" : "Belum benar"}
                      </Badge>
                    ) : (
                      badgeBelum
                    )
                  }
                  reset={
                    sub ? (
                      <TombolReset
                        jenis="lab_coding"
                        siswaId={siswa.id}
                        refId={l.id}
                        label={l.judul}
                      />
                    ) : null
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState padat judul="Belum ada latihan untuk kelas ini" />
        )}
      </Kartu>

      {/* ---------- Lab Komputer ---------- */}
      <Kartu>
        <KartuJudul
          judul="Lab Komputer"
          subjudul={`${labKomputerSelesai} dari ${tantanganRelevan.length} tantangan dikerjakan`}
        />
        {tantanganRelevan.length > 0 ? (
          <div className="mt-4 space-y-2">
            {tantanganRelevan.map((t) => {
              const hasil = mapHasilKom.get(t.id);
              const lesson = mapLessonKom.get(t.lesson_id);
              return (
                <BarisKegiatan
                  key={t.id}
                  judul={`${lesson?.judul ?? "Modul"} — Level ${t.level}: ${t.judul}`}
                  keterangan={
                    hasil
                      ? `${hasil.percobaan} percobaan${
                          hasil.skor != null ? ` · skor ${hasil.skor}` : ""
                        } · ${formatWaktu(hasil.updated_at)}`
                      : "Belum dikerjakan"
                  }
                  badge={
                    hasil ? (
                      <Badge varian={hasil.pernah_benar ? "sukses" : "bahaya"}>
                        {hasil.pernah_benar ? "Pernah benar" : "Belum benar"}
                      </Badge>
                    ) : (
                      badgeBelum
                    )
                  }
                  reset={
                    hasil ? (
                      <TombolReset
                        jenis="lab_komputer"
                        siswaId={siswa.id}
                        refId={t.id}
                        label={t.judul}
                      />
                    ) : null
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState padat judul="Belum ada tantangan untuk kelas ini" />
        )}
      </Kartu>
    </div>
  );
}
