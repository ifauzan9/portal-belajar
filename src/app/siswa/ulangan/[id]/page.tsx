import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { formatWaktuWib } from "@/lib/waktu";
import { ambilPengaturanSoal } from "@/lib/pengaturan-soal";
import { PemberitahuanSoalDitutup } from "@/components/pemberitahuan-soal";
import { FormJawaban } from "./form-jawaban";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Notifikasi } from "@/components/ui/notifikasi";
import { IkonBuku } from "@/components/ui/ikon-siswa";
import { jenisSoalTersedia } from "@/lib/jenis-soal-ulangan";

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

  // Ambil detail ulangan. Kolom `blokir_tempel` baru ada setelah Tahap 39;
  // kalau belum, fallback ke select lama dan anggap nonaktif.
  const kolomUlanganDasar =
    "id, judul, status, tenggat, durasi, nilai_ditampilkan, nilai_selesai, dibuka, kelas_id, exam_classes(kelas_id)";

  const hasilUlanganLengkap = await supabase
    .from("exams")
    .select(`${kolomUlanganDasar}, blokir_tempel`)
    .eq("id", id)
    .maybeSingle();

  let ulangan: unknown = hasilUlanganLengkap.data;

  if (hasilUlanganLengkap.error) {
    const fallback = await supabase
      .from("exams")
      .select(kolomUlanganDasar)
      .eq("id", id)
      .maybeSingle();
    ulangan = fallback.data;
  }

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
    blokir_tempel?: boolean | null;
  };

  // Ambil soal terpisah (tanpa kunci jawaban — siswa tidak boleh lihat kunci).
  // Kolom kode baru ada setelah DDL Tahap 33; sediakan fallback.
  const kolomDasar = "id, soal, jenis, pilihan, poin, urutan";
  const kolomLengkap =
    "id, soal, jenis, pilihan, poin, urutan, kode_awal, keluaran_diharapkan, masukan, aturan";

  const hasilSoal = await supabase
    .from("exam_questions")
    .select(kolomLengkap)
    .eq("exam_id", id)
    .order("urutan", { ascending: true });

  let soalData: unknown[] | null = hasilSoal.data;

  if (!soalData) {
    const fallback = await supabase
      .from("exam_questions")
      .select(kolomDasar)
      .eq("exam_id", id)
      .order("urutan", { ascending: true });
    soalData = fallback.data;
  }

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
  const [hasilSubmitLama, hasilSesiAwal] = await Promise.all([
    supabase
      .from("exam_submissions")
      .select("id, nilai_pg, nilai_esai, nilai_kode, nilai_total, disubmit_at")
      .eq("exam_id", id)
      .eq("siswa_id", siswa.id)
      .maybeSingle(),
    supabase
      .from("exam_sessions")
      .select("mulai_at")
      .eq("exam_id", id)
      .eq("siswa_id", siswa.id)
      .maybeSingle(),
  ]);

  let submitLama: unknown = hasilSubmitLama.data;

  if (!submitLama) {
    const fallbackSubmit = await supabase
      .from("exam_submissions")
      .select("id, nilai_pg, nilai_esai, nilai_total, disubmit_at")
      .eq("exam_id", id)
      .eq("siswa_id", siswa.id)
      .maybeSingle();
    submitLama = fallbackSubmit.data;
  }

  const sesiRow = hasilSesiAwal.data as { mulai_at: string } | null;
  const punyaSesi = Boolean(sesiRow?.mulai_at);

  // Saklar global dari guru (Tahap 41). Siswa yang sudah memulai tetap
  // dilanjutkan agar jawabannya tidak hilang.
  const pengaturanSoal = await ambilPengaturanSoal(supabase);
  const soalDitutupGlobal = pengaturanSoal.tutupUlangan && !punyaSesi;

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
    kode_awal?: string | null;
    keluaran_diharapkan?: string | null;
    masukan?: string | null;
    aturan?: {
      variabel_wajib?: string[];
      dari_input?: boolean;
      min_input?: number;
      min_print?: number;
    } | null;
  }[];

  // Jika sudah submit → tampilkan hasil
  if (submitLama) {
    const submit = submitLama as {
      nilai_pg: number;
      nilai_esai: number;
      nilai_kode?: number;
      nilai_total: number;
      disubmit_at: string;
    };
    const nilaiKode = submit.nilai_kode ?? 0;

    // Kartu nilai mengikuti jenis soal yang ada di ulangan ini.
    // "Total" selalu tampil paling akhir.
    const jenisSoal = jenisSoalTersedia(soalList.map((s) => s.jenis));
    const kartu: {
      label: string;
      nilai: number;
      latar: string;
      warnaLabel: string;
      warnaAngka: string;
      ring: string;
    }[] = [];

    if (jenisSoal.pg) {
      kartu.push({
        label: "Nilai PG",
        nilai: submit.nilai_pg,
        latar: "bg-blue-50",
        warnaLabel: "text-blue-600",
        warnaAngka: "text-blue-700",
        ring: "ring-blue-100",
      });
    }
    if (jenisSoal.esai) {
      kartu.push({
        label: "Nilai Esai",
        nilai: submit.nilai_esai,
        latar: "bg-amber-50",
        warnaLabel: "text-amber-600",
        warnaAngka: "text-amber-700",
        ring: "ring-amber-100",
      });
    }
    if (jenisSoal.kode) {
      kartu.push({
        label: "Nilai Kode",
        nilai: nilaiKode,
        latar: "bg-emerald-50",
        warnaLabel: "text-emerald-600",
        warnaAngka: "text-emerald-700",
        ring: "ring-emerald-100",
      });
    }

    const jumlahKartu = kartu.length + 1; // + Total
    const kelasGrid =
      jumlahKartu === 2
        ? "grid-cols-2"
        : jumlahKartu === 3
          ? "grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

    return (
      <div className="space-y-6">
        <Kepala judul={dataUlangan.judul} />

        <Kartu>
          <div className="flex flex-wrap items-center gap-3">
            <Badge varian="sukses" titik>
              Sudah submit
            </Badge>
            <span className="text-xs text-slate-400">
              {formatWaktuWib(submit.disubmit_at)}
            </span>
          </div>

          {nilaiDitampilkan ? (
            <>
              <div className={`mt-4 grid gap-3 ${kelasGrid}`}>
                {kartu.map((k) => (
                  <div
                    key={k.label}
                    className={`rounded-xl p-3 text-center ring-1 ${k.latar} ${k.ring}`}
                  >
                    <p className={`text-xs ${k.warnaLabel}`}>{k.label}</p>
                    <p
                      className={`text-2xl font-semibold tabular-nums ${k.warnaAngka}`}
                    >
                      {k.nilai}
                    </p>
                  </div>
                ))}
                <div className="rounded-xl bg-slate-100 p-3 text-center ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">
                    {submit.nilai_total}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {jenisSoal.esai && submit.nilai_esai === 0
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

  // Jika ulangan ditutup guru (per ulangan atau saklar global) + belum submit
  // → tampilkan pesan.
  if ((!dibukaUlangan || soalDitutupGlobal) && !submitLama) {
    return (
      <div className="space-y-6">
        <Kepala judul={dataUlangan.judul} />

        {soalDitutupGlobal ? (
          <PemberitahuanSoalDitutup
            jenis="ulangan"
            pesan={pengaturanSoal.pesan}
          />
        ) : (
          <Notifikasi varian="gagal" judul="Ulangan ditutup oleh guru">
            Ulangan ini sementara tidak bisa dikerjakan. Nanti guru akan
            membukanya kembali.
          </Notifikasi>
        )}
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

  // Belum submit + masih terbuka → tampilkan form.
  // Timer baru dimulai setelah siswa mengonfirmasi di halaman konfirmasi.
  // Kalau belum ada sesi, kembalikan ke halaman konfirmasi (jangan buat sesi
  // di sini) supaya membuka URL langsung tidak memulai timer.
  if (!sesiRow?.mulai_at) {
    redirect(`/siswa/ulangan/${id}/konfirmasi`);
  }

  const mulaiAt = sesiRow.mulai_at;

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
            {formatWaktuWib(dataUlangan.tenggat)}
          </span>
        ) : null}
      </div>

      {pengaturanSoal.tutupUlangan && punyaSesi ? (
        <Notifikasi varian="info" judul="Akses soal baru sedang ditutup">
          Kamu sudah memulai ulangan ini, jadi tetap bisa menyelesaikan dan
          mengumpulkan jawaban. Setelah dikumpulkan, kamu tidak bisa memulai
          ulangan lain sampai guru membuka aksesnya kembali.
        </Notifikasi>
      ) : null}

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
          blokirTempel={dataUlangan.blokir_tempel === true}
          mulaiAt={mulaiAt}
        />
      )}
    </div>
  );
}
