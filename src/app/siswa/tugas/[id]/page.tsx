import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { tenggatSudahLewat } from "@/lib/deadline";
import { FormKumpulTugas } from "@/components/form-kumpul-tugas";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { Notifikasi } from "@/components/ui/notifikasi";
import {
  LABEL_METODE,
  ambilKelasTugas,
  bacaMetode,
  formatUkuran,
  urlPublikBerkas,
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

export default async function DetailTugasSiswaPage(
  props: PageProps<"/siswa/tugas/[id]">,
) {
  const { id } = await props.params;
  const { siswa } = await requireSiswa();
  const supabase = await createClient();

  const { data: tugasData } = await supabase
    .from("assignments")
    .select(
      "id, judul, deskripsi, tenggat, metode, file_diizinkan, assignment_classes(kelas_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!tugasData) {
    redirect("/siswa/tugas");
  }

  const tugas = tugasData as {
    id: string;
    judul: string;
    deskripsi: string | null;
    tenggat: string | null;
    metode: string;
    file_diizinkan: string[] | null;
    assignment_classes?: { kelas_id: string }[];
  };

  const daftarKelasId = ambilKelasTugas(tugas);
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) {
    redirect("/siswa/tugas");
  }

  const metode = bacaMetode(tugas.metode);

  const { data: submissionData } = await supabase
    .from("assignment_submissions")
    .select(
      "id, tautan, catatan, nilai, umpan_balik, updated_at, assignment_files(id, tipe, nama_file, path, ukuran)",
    )
    .eq("tugas_id", id)
    .eq("siswa_id", siswa.id)
    .maybeSingle();

  const submission = submissionData as
    | {
        id: string;
        tautan: string | null;
        catatan: string | null;
        nilai: number | null;
        umpan_balik: string | null;
        updated_at: string | null;
        assignment_files?: BerkasRow[];
      }
    | null;

  const berkas = submission?.assignment_files ?? [];
  const foto = berkas.filter((b) => b.tipe === "foto");
  const dokumen = berkas.filter((b) => b.tipe === "dokumen");

  const lewat = tenggatSudahLewat(tugas.tenggat);
  const bolehKumpul = !lewat;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/siswa/tugas"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke daftar tugas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {tugas.judul}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge varian="netral">{LABEL_METODE[metode]}</Badge>
          <span>Tenggat: {formatWaktu(tugas.tenggat)}</span>
          {submission ? (
            <Badge varian="sukses" titik>
              Sudah dikumpulkan
            </Badge>
          ) : lewat ? (
            <Badge varian="bahaya">Lewat tenggat</Badge>
          ) : (
            <Badge varian="peringatan">Belum dikumpulkan</Badge>
          )}
        </div>
        {tugas.deskripsi ? (
          <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600">
            {tugas.deskripsi}
          </p>
        ) : null}
      </div>

      {submission ? (
        <Kartu>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Pengumpulanmu
            </h2>
            {submission.nilai !== null ? (
              <Badge varian="sukses">Nilai: {submission.nilai}</Badge>
            ) : (
              <Badge varian="peringatan">Menunggu penilaian</Badge>
            )}
          </div>

          <div className="mt-3 space-y-3">
            {submission.tautan ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Tautan
                </p>
                <a
                  href={submission.tautan}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-sm font-medium text-blue-600 underline hover:no-underline"
                >
                  {submission.tautan}
                </a>
              </div>
            ) : null}

            {submission.catatan ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Catatanmu
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                  {submission.catatan}
                </p>
              </div>
            ) : null}

            {foto.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Foto ({foto.length})
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {foto.map((berkasFoto) => {
                    const url = urlPublikBerkas(berkasFoto.path);
                    return (
                      <a
                        key={berkasFoto.id}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={berkasFoto.nama_file}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={berkasFoto.nama_file}
                          className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                        />
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {dokumen.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Dokumen ({dokumen.length})
                </p>
                <ul className="mt-1 space-y-1">
                  {dokumen.map((berkasDok) => (
                    <li key={berkasDok.id}>
                      <a
                        href={urlPublikBerkas(berkasDok.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 underline hover:no-underline"
                      >
                        📄 {berkasDok.nama_file}
                        <span className="text-xs font-normal text-slate-400 no-underline">
                          ({formatUkuran(berkasDok.ukuran)})
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {submission.umpan_balik ? (
              <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                <p className="text-xs font-semibold text-emerald-700">
                  Umpan balik guru
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-emerald-900">
                  {submission.umpan_balik}
                </p>
              </div>
            ) : null}
          </div>

          {!bolehKumpul ? (
            <p className="mt-3 text-xs text-slate-400">
              Tenggat sudah lewat, pengumpulan tidak bisa diubah lagi.
            </p>
          ) : null}
        </Kartu>
      ) : null}

      {bolehKumpul ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {submission ? "Perbarui pengumpulan" : "Kumpulkan tugas"}
          </h2>
          <FormKumpulTugas
            tugasId={id}
            metode={metode}
            fileDiizinkan={tugas.file_diizinkan ?? []}
            tautanAwal={submission?.tautan ?? null}
            catatanAwal={submission?.catatan ?? null}
            adaBerkasLama={berkas.length > 0}
          />
        </div>
      ) : !submission ? (
        <Notifikasi varian="gagal" judul="Tenggat sudah lewat">
          Kamu belum mengumpulkan tugas ini dan waktunya sudah habis. Hubungi
          gurumu kalau ada masalah.
        </Notifikasi>
      ) : null}
    </div>
  );
}
