import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createSiswaClient } from "@/lib/supabase/siswa";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { belumWaktunyaMulai, sisaMenitUjian } from "@/lib/jadwal-ulangan";
import { formatTanggalWib, formatWaktuWib } from "@/lib/waktu";
import { ambilPengaturanSoal } from "@/lib/pengaturan-soal";
import { statusAksesSoal } from "@/lib/status-soal";
import { PemberitahuanSoalDitutup } from "@/components/pemberitahuan-soal";
import { Badge } from "@/components/ui/badge";
import { Kartu } from "@/components/ui/kartu";
import { Notifikasi } from "@/components/ui/notifikasi";
import { TombolMulaiUjian } from "./tombol-mulai-ujian";

// ============================================================================
// Halaman konfirmasi sebelum mengerjakan ulangan.
//
// Tujuan:
//  - Menampilkan informasi ulangan (jumlah soal, durasi, tenggat, jadwal).
//  - Timer TIDAK berjalan sampai siswa mencentang pernyataan dan menekan
//    "Mulai Sekarang" (diproses server action `mulaiUjianSiswa`).
//  - Jika tanggal mulai belum tiba, tampilkan info "belum waktunya mulai".
// ============================================================================

function InfoItem({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{nilai}</p>
    </div>
  );
}

export default async function KonfirmasiUlanganPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { siswa } = await requireSiswa();
  const supabase = await createSiswaClient();

  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select(
      "id, judul, kelas_id, tanggal, access_code, status, tenggat, durasi, dibuka, exam_classes(kelas_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (galatUlangan || !ulangan) {
    redirect("/siswa/ulangan");
  }

  const dataUlangan = ulangan as {
    id: string;
    judul: string;
    kelas_id: string | null;
    tanggal: string | null;
    access_code: string | null;
    status: "akan" | "sudah";
    tenggat: string | null;
    durasi: number | null;
    dibuka: boolean | null;
    exam_classes?: { kelas_id: string }[] | null;
  };

  const butuhKode = Boolean((dataUlangan.access_code ?? "").trim());

  // Pastikan ulangan memang untuk kelas siswa.
  const daftarKelasId = ambilKelasUlangan(dataUlangan);
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) {
    redirect("/siswa/ulangan");
  }

  const [hasilSoal, hasilSubmit, hasilSesi, pengaturanSoal] = await Promise.all([
    supabase
      .from("exam_questions")
      .select("*", { count: "exact", head: true })
      .eq("exam_id", id),
    supabase
      .from("exam_submissions")
      .select("id, disubmit_at")
      .eq("exam_id", id)
      .eq("siswa_id", siswa.id)
      .maybeSingle(),
    supabase
      .from("exam_sessions")
      .select("mulai_at")
      .eq("exam_id", id)
      .eq("siswa_id", siswa.id)
      .maybeSingle(),
    ambilPengaturanSoal(supabase),
  ]);

  const jumlahSoal = hasilSoal.count ?? 0;
  const submit = hasilSubmit.data as {
    id: string;
    disubmit_at: string | null;
  } | null;
  const sesi = hasilSesi.data as { mulai_at: string } | null;

  const status = dataUlangan.status ?? "sudah";
  const dibuka = dataUlangan.dibuka !== false;
  const deadlineLewat =
    status === "akan" && tenggatSudahLewat(dataUlangan.tenggat);
  const belumMulai =
    status === "akan" && belumWaktunyaMulai(dataUlangan.tanggal);
  const aksesSoal = statusAksesSoal({
    status,
    dibuka,
    bolehSoal: dibuka && !pengaturanSoal.tutupUlangan,
    deadlineLewat,
    belumWaktunya: belumMulai,
  });
  const sudahSubmit = Boolean(submit);
  const sedangMengerjakan = Boolean(sesi) && !sudahSubmit;
  // Saklar global (Tahap 41): menutup untuk siswa yang BELUM memulai.
  // Siswa yang sudah memulai tetap boleh melanjutkan agar tidak kehilangan
  // jawaban yang sudah ditulis.
  const ditutupGlobal = pengaturanSoal.tutupUlangan && !sesi;
  const bisaMulai =
    status === "akan" &&
    dibuka &&
    !ditutupGlobal &&
    !deadlineLewat &&
    !belumMulai &&
    !sudahSubmit &&
    !sesi &&
    jumlahSoal > 0;

  // Sisa waktu hanya untuk ditampilkan; timer yang sebenarnya ada di halaman
  // soal dan dihitung dari `mulai_at` server.
  const sisaMenit = sesi
    ? sisaMenitUjian(sesi.mulai_at, dataUlangan.durasi)
    : null;

  const statusTampil = (() => {
    if (sudahSubmit) {
      return { label: "Sudah dikerjakan", varian: "sukses" as const };
    }
    if (status !== "akan") {
      return { label: "Selesai", varian: "sukses" as const };
    }
    if (!dibuka) {
      return { label: "Ditutup guru", varian: "bahaya" as const };
    }
    if (ditutupGlobal) {
      return { label: "Ditutup guru", varian: "bahaya" as const };
    }
    if (deadlineLewat) {
      return { label: "Lewat tenggat", varian: "netral" as const };
    }
    if (sedangMengerjakan) {
      return { label: "Sedang dikerjakan", varian: "info" as const };
    }
    if (belumMulai) {
      return { label: "Dijadwalkan", varian: "peringatan" as const };
    }
    return { label: "Siap dimulai", varian: "info" as const };
  })();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/siswa/ulangan"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Ulangan
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            {dataUlangan.judul}
          </h1>
          <Badge varian={statusTampil.varian} titik>
            {statusTampil.label}
          </Badge>
          {aksesSoal ? (
            <Badge varian={aksesSoal.varian}>{aksesSoal.label}</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Konfirmasi pengerjaan · {jumlahSoal} soal
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoItem label="Jumlah soal" nilai={`${jumlahSoal} soal`} />
        <InfoItem
          label="Durasi"
          nilai={
            dataUlangan.durasi
              ? `${dataUlangan.durasi} menit`
              : "Tanpa timer"
          }
        />
        <InfoItem
          label="Tenggat"
          nilai={
            dataUlangan.tenggat
              ? formatWaktuWib(dataUlangan.tenggat)
              : "Tanpa tenggat"
          }
        />
        <InfoItem
          label="Jadwal mulai"
          nilai={
            dataUlangan.tanggal
              ? formatTanggalWib(dataUlangan.tanggal)
              : "Tanpa jadwal"
          }
        />
      </div>

      {sudahSubmit ? (
        <Kartu>
          <div className="flex flex-wrap items-center gap-3">
            <Badge varian="sukses" titik>
              Sudah dikerjakan
            </Badge>
            {submit?.disubmit_at ? (
              <span className="text-xs text-slate-400">
                Dikumpulkan {formatWaktuWib(submit.disubmit_at)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Jawabanmu sudah tersimpan. Nilai bisa dilihat di halaman detail
            nilai.
          </p>
          <Link
            href={`/siswa/nilai/${id}?nilai=1`}
            className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Lihat Detail Nilai →
          </Link>
        </Kartu>
      ) : status !== "akan" ? (
        <Notifikasi varian="info" judul="Ulangan sudah dilaksanakan">
          Ulangan ini bukan ulangan bersoal yang bisa dikerjakan sekarang.
          Kalau kamu belum mengerjakannya, hubungi gurumu.
        </Notifikasi>
      ) : !dibuka ? (
        <Notifikasi varian="gagal" judul="Ulangan ditutup oleh guru">
          Ulangan ini sementara tidak bisa dikerjakan. Nanti guru akan
          membukanya kembali.
        </Notifikasi>
      ) : ditutupGlobal ? (
        <PemberitahuanSoalDitutup
          jenis="ulangan"
          pesan={pengaturanSoal.pesan}
        />
      ) : deadlineLewat ? (
        <Notifikasi varian="gagal" judul="Tenggat sudah lewat">
          Waktu pengumpulan sudah habis. Hubungi gurumu kalau ada masalah.
        </Notifikasi>
      ) : sedangMengerjakan && sesi ? (
        <Kartu>
          <div className="flex flex-wrap items-center gap-3">
            <Badge varian="info" titik>
              Sedang dikerjakan
            </Badge>
            <span className="text-xs text-slate-400">
              Dimulai {formatWaktuWib(sesi.mulai_at)}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Kamu sudah memulai ulangan ini. Timer tidak berhenti saat halaman
            ditutup atau di-refresh.
          </p>
          {dataUlangan.durasi ? (
            <p
              className={`mt-1 text-sm font-medium ${
                sisaMenit === 0 ? "text-red-600" : "text-slate-700"
              }`}
            >
              {sisaMenit === null
                ? "Sisa waktu tidak tersedia."
                : sisaMenit === 0
                  ? "Waktu pengerjaan sudah habis."
                  : `Sisa waktu ± ${sisaMenit} menit.`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              Tanpa batas durasi; ikuti tenggat waktu.
            </p>
          )}
          <Link
            href={`/siswa/ulangan/${id}`}
            className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Lanjutkan Pengerjaan →
          </Link>
        </Kartu>
      ) : belumMulai ? (
        <Notifikasi varian="peringatan" judul="Belum waktunya mulai">
          Ulangan dijadwalkan mulai{" "}
          <strong>{formatTanggalWib(dataUlangan.tanggal)}</strong>. Tombol mulai
          akan aktif pada tanggal tersebut.
        </Notifikasi>
      ) : jumlahSoal === 0 ? (
        <Notifikasi varian="info" judul="Soal belum tersedia">
          Guru belum menambahkan soal untuk ulangan ini. Coba muat ulang nanti
          atau hubungi gurumu.
        </Notifikasi>
      ) : null}

      {!sudahSubmit ? (
        <Kartu>
          <h2 className="text-sm font-semibold text-slate-900">
            Informasi Pengerjaan
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {butuhKode ? (
              <li>
                Ulangan ini memerlukan <strong>kode akses</strong> dari guru.
                Masukkan kode sebelum menekan <strong>Mulai Sekarang</strong>.
              </li>
            ) : null}
            <li>
              Timer mulai berjalan setelah kamu menekan{" "}
              <strong>Mulai Sekarang</strong> dan tidak bisa dijeda.
            </li>
            <li>
              Refresh, menutup browser, atau logout tidak mengulang waktu. Timer
              tetap berjalan di server.
            </li>
            <li>
              Jawaban hanya bisa dikirim satu kali. Setelah submit, jawaban tidak
              dapat diubah.
            </li>
            <li>
              Soal kode bisa dijalankan berkali-kali selama waktu tersedia. Hasil
              Run hanya menampilkan output/error, bukan penilaian.
            </li>
            <li>Berpindah tab atau meninggalkan halaman akan dicatat.</li>
            {dataUlangan.durasi ? (
              <li>
                Durasi pengerjaan: {dataUlangan.durasi} menit sejak tombol mulai
                ditekan.
              </li>
            ) : null}
            {dataUlangan.tenggat ? (
              <li>
                Batas akhir submit: {formatWaktuWib(dataUlangan.tenggat)}.
              </li>
            ) : null}
          </ul>

          {bisaMulai ? (
            <TombolMulaiUjian examId={id} butuhKode={butuhKode} />
          ) : null}
        </Kartu>
      ) : null}
    </div>
  );
}