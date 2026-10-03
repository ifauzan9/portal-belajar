import Link from "next/link";
import { redirect } from "next/navigation";
import { BarisPengumpulan } from "@/components/baris-pengumpulan";
import { createClient } from "@/lib/supabase/server";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";
import {
  LABEL_METODE,
  ambilKelasTugas,
  bacaMetode,
} from "@/lib/tugas";

function formatWaktu(iso: string | null): string {
  if (!iso) return "Tanpa tenggat";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(t);
}

type BerkasRow = {
  id: string;
  tipe: "foto" | "dokumen";
  nama_file: string;
  path: string;
  ukuran: number;
};

type SubmissionRow = {
  id: string;
  siswa_id: string;
  tautan: string | null;
  catatan: string | null;
  nilai: number | null;
  umpan_balik: string | null;
  updated_at: string | null;
  students?:
    | { nama_siswa: string; nis: string | null }
    | { nama_siswa: string; nis: string | null }[]
    | null;
  assignment_files?: BerkasRow[];
};

// Supabase bisa mengembalikan relasi to-one sebagai objek atau array.
function bacaSiswa(sub: SubmissionRow): { nama_siswa: string; nis: string | null } {
  const data = sub.students;
  if (!data) return { nama_siswa: "Siswa", nis: null };
  if (Array.isArray(data)) {
    return data[0] ?? { nama_siswa: "Siswa", nis: null };
  }
  return data;
}

export default async function DetailTugasPage(
  props: PageProps<"/guru/tugas/[id]">,
) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [hasilTugas, hasilSubmissions, hasilSiswa, hasilKelas] =
    await Promise.all([
      supabase
        .from("assignments")
        .select(
          "id, judul, deskripsi, tenggat, metode, file_diizinkan, assignment_classes(kelas_id)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("assignment_submissions")
        .select(
          "id, siswa_id, tautan, catatan, nilai, umpan_balik, updated_at, students(nama_siswa, nis), assignment_files(id, tipe, nama_file, path, ukuran)",
        )
        .eq("tugas_id", id)
        .order("updated_at", { ascending: false }),
      supabase.from("students").select("id, nama_siswa, nis, kelas_id"),
      supabase.from("classes").select("id, nama_kelas"),
    ]);

  const tugas = hasilTugas.data as
    | {
        id: string;
        judul: string;
        deskripsi: string | null;
        tenggat: string | null;
        metode: string;
        file_diizinkan: string[] | null;
        assignment_classes?: { kelas_id: string }[];
      }
    | null;

  if (!tugas) {
    redirect("/guru/tugas");
  }

  const kelasList = (hasilKelas.data ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));
  const daftarKelasId = ambilKelasTugas(tugas);
  const metode = bacaMetode(tugas.metode);

  const semuaSiswa = (hasilSiswa.data ?? []) as {
    id: string;
    nama_siswa: string;
    nis: string | null;
    kelas_id: string | null;
  }[];

  const submissions = (hasilSubmissions.data ?? []) as unknown as SubmissionRow[];
  const sudahKumpul = new Set(submissions.map((s) => s.siswa_id));

  const siswaTarget = semuaSiswa.filter((siswa) =>
    daftarKelasId.length === 0
      ? true
      : siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id),
  );
  const belumKumpul = siswaTarget.filter((siswa) => !sudahKumpul.has(siswa.id));

  const galat =
    hasilTugas.error?.message ??
    hasilSubmissions.error?.message ??
    hasilSiswa.error?.message ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/tugas"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke daftar tugas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {tugas.judul}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge varian="netral">{LABEL_METODE[metode]}</Badge>
          <span>
            {daftarKelasId.length === 0
              ? "Semua kelas"
              : daftarKelasId
                  .map((idKelas) => namaKelas.get(idKelas) ?? "Kelas tak ditemukan")
                  .join(", ")}
          </span>
          <span>· Tenggat: {formatWaktu(tugas.tenggat)}</span>
        </div>
        {tugas.deskripsi ? (
          <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600">
            {tugas.deskripsi}
          </p>
        ) : null}
      </div>

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat data: {galat}</p>
      ) : null}

      <Kartu>
        <KartuJudul
          judul="Pengumpulan"
          subjudul={`${submissions.length} dari ${siswaTarget.length} siswa sudah mengumpulkan`}
        />

        {submissions.length > 0 ? (
          <div className="mt-4 space-y-3">
            {submissions.map((submission) => {
              const siswaSub = bacaSiswa(submission);
              return (
                <BarisPengumpulan
                  key={submission.id}
                  tugasId={id}
                  submissionId={submission.id}
                  namaSiswa={siswaSub.nama_siswa}
                  nis={siswaSub.nis}
                  tautan={submission.tautan}
                  catatan={submission.catatan}
                  nilai={submission.nilai}
                  umpanBalik={submission.umpan_balik}
                  updatedAt={submission.updated_at}
                  berkas={submission.assignment_files ?? []}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            padat
            ikon={<IkonBuku className="h-5 w-5" />}
            judul="Belum ada yang mengumpulkan"
            keterangan="Pengumpulan siswa akan muncul di sini."
          />
        )}
      </Kartu>

      {belumKumpul.length > 0 ? (
        <Kartu>
          <KartuJudul
            judul="Belum mengumpulkan"
            subjudul={`${belumKumpul.length} siswa`}
          />
          <ul className="mt-3 flex flex-wrap gap-2">
            {belumKumpul.map((siswa) => (
              <li
                key={siswa.id}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
              >
                {siswa.nama_siswa}
                {siswa.nis ? ` · ${siswa.nis}` : ""}
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
    </div>
  );
}
