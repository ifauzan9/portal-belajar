import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { FormJawaban } from "./form-jawaban";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Notifikasi } from "@/components/ui/notifikasi";
import { IkonBuku } from "@/components/ui/ikon-siswa";

// ============================================================================
// Halaman mengerjakan soal ulangan (status "akan dilaksanakan").
// Siswa menjawab soal PG (radio) & esai (textarea), lalu submit.
// Setelah submit: PG dihitung otomatis, esai menunggu penilaian guru.
// ============================================================================

// Header halaman kerjakan ulangan: tautan kembali + judul.
function Kepala({ judul }: { judul: string }) {
  return (
    <div>
      <Link
        href="/siswa/nilai"
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        ← Kembali ke Nilai
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{judul}</h1>
    </div>
  );
}

export default async function KerjakanUlanganPage(
  props: PageProps<"/siswa/ulangan/[id]">,
) {
  const { id } = await props.params;
  const { siswa } = await requireSiswa();
  const supabase = await createClient();

  // Ambil detail ulangan
  const { data: ulangan } = await supabase
    .from("exams")
    .select(
      "id, judul, status, tenggat, durasi, nilai_ditampilkan, nilai_selesai, dibuka, kelas_id, exam_classes(kelas_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!ulangan) {
    redirect("/siswa/nilai");
  }

  const dataUlangan = ulangan as {
    id: string;
    judul: string;
    status: "akan" | "sudah";
    tenggat: string | null;
    durasi: number | null;
    nilai_ditampilkan: boolean;
    nilai_selesai: boolean;
    dibuka: boolean | null;
    kelas_id: string | null;
    exam_classes?: { kelas_id: string }[];
  };

  // Ambil soal terpisah (tanpa kunci jawaban — siswa tidak boleh lihat kunci)
  const { data: soalData } = await supabase
    .from("exam_questions")
    .select("id, soal, jenis, pilihan, poin, urutan")
    .eq("exam_id", id)
    .order("urutan", { ascending: true });

  // Cek relevansi kelas
  const daftarKelasId = ambilKelasUlangan(dataUlangan);
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) {
    redirect("/siswa/nilai");
  }

  // Cek status
  if (dataUlangan.status !== "akan") {
    redirect(`/siswa/nilai/${id}`);
  }

  // Cek apakah ulangan ditutup oleh guru (dibuka=false → siswa tidak
  // bisa mengerjakan; yang sudah submit tetap bisa lihat hasilnya).
  const dibukaUlangan = dataUlangan.dibuka !== false;

  // Cek tenggat
  const deadlineLewat = tenggatSudahLewat(dataUlangan.tenggat);

  // Cek apakah siswa sudah submit
  const { data: submitLama } = await supabase
    .from("exam_submissions")
    .select("id, nilai_pg, nilai_esai, nilai_total, disubmit_at")
    .eq("exam_id", id)
    .eq("siswa_id", siswa.id)
    .maybeSingle();

  // Cek apakah nilai boleh ditampilkan (guru menahan / sudah selesai dinilai)
  const nilaiDitampilkan =
    dataUlangan.nilai_ditampilkan === true || dataUlangan.nilai_selesai === true;

  const soalList = (soalData ?? []) as {
    id: string;
    soal: string;
    jenis: string;
    pilihan: string[] | null;
    kunci: string | null;
    poin: number;
    urutan: number;
  }[];

  // Jika sudah submit → tampilkan hasil
  if (submitLama) {
    const submit = submitLama as {
      nilai_pg: number;
      nilai_esai: number;
      nilai_total: number;
      disubmit_at: string;
    };
    return (
      <div className="space-y-6">
        <Kepala judul={dataUlangan.judul} />

        <Kartu>
          <div className="flex flex-wrap items-center gap-3">
            <Badge varian="sukses" titik>
              Sudah submit
            </Badge>
            <span className="text-xs text-slate-400">
              {new Date(submit.disubmit_at).toLocaleString("id-ID")}
            </span>
          </div>

          {nilaiDitampilkan ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-center ring-1 ring-blue-100">
                  <p className="text-xs text-blue-600">Nilai PG</p>
                  <p className="text-2xl font-semibold tabular-nums text-blue-700">
                    {submit.nilai_pg}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-center ring-1 ring-amber-100">
                  <p className="text-xs text-amber-600">Nilai Esai</p>
                  <p className="text-2xl font-semibold tabular-nums text-amber-700">
                    {submit.nilai_esai}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3 text-center ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">
                    {submit.nilai_total}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {submit.nilai_esai === 0
                  ? "Nilai esai masih menunggu penilaian guru."
                  : "Nilai sudah lengkap."}
              </p>
            </>
          ) : (
            <div className="mt-4">
              <Notifikasi varian="info" judul="Jawaban sudah dikumpulkan">
                Nilai kamu ditahan oleh guru dan akan ditampilkan setelah selesai
                dinilai. Nanti kamu bisa lihat di halaman{" "}
                <Link
                  href={`/siswa/nilai/${id}`}
                  className="font-medium underline hover:no-underline"
                >
                  Detail Nilai
                </Link>
                .
              </Notifikasi>
            </div>
          )}
        </Kartu>

        <Link
          href={`/siswa/nilai/${id}`}
          className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Lihat Detail Nilai →
        </Link>
      </div>
    );
  }

  // Jika ulangan ditutup guru + belum submit → tampilkan pesan
  if (!dibukaUlangan && !submitLama) {
    return (
      <div className="space-y-6">
        <Kepala judul={dataUlangan.judul} />

        <Notifikasi varian="gagal" judul="Ulangan ditutup oleh guru">
          Ulangan ini sementara tidak bisa dikerjakan. Nanti guru akan
          membukanya kembali.
        </Notifikasi>
      </div>
    );
  }

  // Jika deadline lewat → tampilkan pesan
  if (deadlineLewat) {
    return (
      <div className="space-y-6">
        <Kepala judul={dataUlangan.judul} />

        <Notifikasi varian="gagal" judul="Ulangan sudah ditutup">
          Tenggat waktu sudah lewat. Hubungi gurumu kalau ada masalah.
        </Notifikasi>
      </div>
    );
  }

  // Belum submit + masih terbuka → tampilkan form
  return (
    <div className="space-y-6">
      <Kepala judul={dataUlangan.judul} />
      <div className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
        <span>{soalList.length} soal</span>
        {dataUlangan.durasi !== null ? (
          <span>· Durasi {dataUlangan.durasi} menit</span>
        ) : null}
        {dataUlangan.tenggat ? (
          <span>
            · Tenggat:{" "}
            {new Date(dataUlangan.tenggat).toLocaleString("id-ID")}
          </span>
        ) : null}
      </div>

      {soalList.length === 0 ? (
        <Kartu>
          <EmptyState
            ikon={<IkonBuku className="h-6 w-6" />}
            judul="Soal belum tersedia"
            keterangan="Guru belum menambahkan soal untuk ulangan ini. Coba muat ulang nanti atau hubungi gurumu."
          />
        </Kartu>
      ) : (
        <FormJawaban
          examId={id}
          soalList={soalList}
          tenggat={dataUlangan.tenggat}
          durasi={dataUlangan.durasi}
          nilaiDitampilkan={nilaiDitampilkan}
        />
      )}
    </div>
  );
}
