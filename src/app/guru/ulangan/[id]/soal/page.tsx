import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  selesaiDinilai,
  batalkanSelesaiDinilai,
  toggleUlangan,
} from "@/app/guru/ulangan/actions";
import { FormSoal } from "./form-soal";
import { FormJawabanAsli } from "./form-jawaban-asli";
import { DaftarJawaban } from "./daftar-jawaban";
import { DaftarSoal } from "./daftar-soal";
import { ambilDataJawabanUlangan } from "@/lib/ulangan-jawaban";
import { formatWaktuWib } from "@/lib/waktu";

// ============================================================================
// Halaman kelola soal ulangan (status "akan dilaksanakan").
// Dua bagian:
//   1. Daftar soal — tambah/hapus soal PG & esai.
//   2. Jawaban siswa — review submit, nilai esai manual, sinkron exam_scores.
// ============================================================================

export default async function SoalUlanganPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  // Detail ulangan
  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select("id, judul, status, tenggat, tanggal, durasi, nilai_ditampilkan, nilai_selesai, dibuka")
    .eq("id", id)
    .maybeSingle();

  if (galatUlangan || !ulangan) {
    notFound();
  }

  const dataUlangan = ulangan as {
    id: string;
    judul: string;
    status: "akan" | "sudah";
    tenggat: string | null;
    tanggal: string | null;
    durasi: number | null;
    nilai_ditampilkan: boolean;
    nilai_selesai: boolean;
    dibuka: boolean | null;
  };

  // Soal untuk ulangan ini
  const kolomSoalDasar = "id, soal, jenis, pilihan, kunci, poin, urutan";
  const kolomSoalKode =
    "id, soal, jenis, pilihan, kunci, poin, urutan, kode_awal, keluaran_diharapkan, masukan, masukan_uji, keluaran_uji, aturan";
  const kolomSoalLengkap = `${kolomSoalKode}, jawaban_asli`;

  const hasilSoal = await supabase
    .from("exam_questions")
    .select(kolomSoalLengkap)
    .eq("exam_id", id)
    .order("urutan", { ascending: true });

  let soalData: unknown[] | null = hasilSoal.data;

  // Kalau kolom `jawaban_asli` (Tahap 36) belum ada, tetap ambil kolom
  // soal kode (Tahap 33) supaya target output dan aturan tidak hilang.
  if (!soalData) {
    const tanpaJawabanAsli = await supabase
      .from("exam_questions")
      .select(kolomSoalKode)
      .eq("exam_id", id)
      .order("urutan", { ascending: true });
    soalData = tanpaJawabanAsli.data;
  }

  if (!soalData) {
    const fallback = await supabase
      .from("exam_questions")
      .select(kolomSoalDasar)
      .eq("exam_id", id)
      .order("urutan", { ascending: true });
    soalData = fallback.data;
  }

  const daftarSoal = (soalData ?? []) as {
    id: string;
    soal: string;
    jenis: string;
    pilihan: string[] | null;
    kunci: string | null;
    poin: number;
    urutan: number;
    keluaran_diharapkan?: string | null;
    kode_awal?: string | null;
    masukan?: string | null;
    masukan_uji?: string | null;
    keluaran_uji?: string | null;
    jawaban_asli?: string | null;
    aturan?: {
      variabel_wajib?: string[];
      dari_input?: boolean;
      min_input?: number;
      min_print?: number;
      izinkan_prompt?: boolean;
    } | null;
  }[];

  const soalKode = daftarSoal.filter((s) => s.jenis === "kode");

  const { daftarSubmit, daftarSesi, soalCount, probeCounts, daftarSoalEsai } =
    await ambilDataJawabanUlangan(supabase, id, daftarSoal);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/ulangan"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Ulangan
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Soal — {dataUlangan.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {dataUlangan.tanggal ? `Tanggal: ${dataUlangan.tanggal} · ` : ""}
          {dataUlangan.tenggat
            ? `Tenggat: ${formatWaktuWib(dataUlangan.tenggat)}`
            : "Tanpa tenggat"}
          {dataUlangan.durasi ? ` · Durasi: ${dataUlangan.durasi} menit` : ""}
        </p>
      </div>

      {/* ======================= STATUS & NILAI ======================= */}
      {dataUlangan.status === "akan" ? (
        <section
          className={`rounded-2xl p-5 ring-1 ${
            !dataUlangan.nilai_selesai
              ? "bg-emerald-50 ring-emerald-200"
              : dataUlangan.nilai_ditampilkan
                ? "bg-blue-50 ring-blue-200"
                : "bg-violet-50 ring-violet-200"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p
                className={`text-sm font-semibold ${
                  !dataUlangan.nilai_selesai
                    ? "text-emerald-800"
                    : dataUlangan.nilai_ditampilkan
                      ? "text-blue-800"
                      : "text-violet-800"
                }`}
              >
                {!dataUlangan.nilai_selesai
                  ? "✅ Selesai dinilai — nilai terbuka untuk semua siswa"
                  : dataUlangan.nilai_ditampilkan
                    ? "📊 Nilai langsung tampak setelah siswa submit"
                    : "🔒 Nilai ditahan — siswa tidak melihat angka"}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  !dataUlangan.nilai_selesai
                    ? "text-emerald-600"
                    : dataUlangan.nilai_ditampilkan
                      ? "text-blue-600"
                      : "text-violet-600"
                }`}
              >
                {!dataUlangan.nilai_selesai
                  ? "Semua siswa dapat melihat hasil di halaman mereka."
                  : dataUlangan.nilai_ditampilkan
                    ? "Nilai PG otomatis terlihat; esai masih menunggu penilaian."
                    : "Nilai baru terbuka setelah kamu tekan tombol &ldquo;Selesai dinilai&rdquo;."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!dataUlangan.nilai_selesai ? (
                <form action={selesaiDinilai}>
                  <input type="hidden" name="exam_id" value={id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                  >
                    ✓ Tandai Selesai Dinilai
                  </button>
                </form>
              ) : (
                <form action={batalkanSelesaiDinilai}>
                  <input type="hidden" name="exam_id" value={id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Batalkan
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ======================= BUKA / TUTUP ULANGAN ======================= */}
      {/* Kolom `dibuka` baru (Tahap 12): kalau DDL belum dijalankan,
          nilai null dianggap dibuka (true) supaya tidak mengunci. */}
      <section
        className={`rounded-2xl p-5 ring-1 ${
          dataUlangan.dibuka === false
            ? "bg-red-50 ring-red-200"
            : "bg-slate-50 ring-slate-200"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p
              className={`text-sm font-semibold ${
                dataUlangan.dibuka === false ? "text-red-800" : "text-slate-800"
              }`}
            >
              {dataUlangan.dibuka === false
                ? "🚪 Ulangan ditutup — siswa tidak bisa mengakses"
                : "🔓 Ulangan terbuka untuk siswa"}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                dataUlangan.dibuka === false ? "text-red-600" : "text-slate-500"
              }`}
            >
              {dataUlangan.dibuka === false
                ? dataUlangan.status === "akan"
                  ? "Siswa tidak bisa membuka form soal. Yang sudah submit tetap bisa lihat hasil."
                  : "Halaman detail nilai ditutup untuk siswa sampai dibuka lagi."
                : "Siswa bisa mengakses ulangan ini seperti biasa."}
            </p>
          </div>
          <div className="shrink-0">
            <form action={toggleUlangan}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  dataUlangan.dibuka === false
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {dataUlangan.dibuka === false ? "Buka Ulangan" : "Tutup Ulangan"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ======================= DAFTAR SOAL ======================= */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Daftar Soal</h2>
        <p className="mt-1 text-xs text-slate-500">
          Tambahkan soal pilihan ganda (dinilai otomatis), esai (dinilai
          manual), atau kode (nilai parsial otomatis + bisa ditimpa guru).
          Urutan tampil mengikuti urutan input.
        </p>

        {/* Form tambah soal */}
        <div className="mt-4">
          <FormSoal examId={id} jumlahSoal={(soalData ?? []).length} />
        </div>

        {/* Daftar soal yang sudah ada */}
        <DaftarSoal
          examId={id}
          soalList={(soalData ?? []) as unknown as {
            id: string;
            soal: string;
            jenis: string;
            pilihan: string[] | null;
            kunci: string | null;
            poin: number;
            urutan: number;
          }[]}
        />
      </section>

      {/* ======================= KUNCI JAWABAN KODE ======================= */}
      {soalKode.length > 0 ? (
        <section
          id="kunci-jawaban-kode"
          className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
        >
          <h2 className="text-sm font-semibold text-slate-900">
            Kunci Jawaban Kode
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Simpan kode jawaban asli/referensi. Kode ini hanya terlihat oleh
            guru dan ditampilkan di review jawaban siswa.
          </p>

          <div className="mt-4 space-y-3">
            {soalKode.map((q) => (
              <div
                key={q.id}
                className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
              >
                <p className="text-xs font-semibold text-slate-700">
                  Soal #{q.urutan} — Kode
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                  {q.soal}
                </p>
                <FormJawabanAsli
                  examId={id}
                  soalId={q.id}
                  defaultValue={q.jawaban_asli ?? ""}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ======================= JAWABAN SISWA ======================= */}
      <DaftarJawaban
        examId={id}
        daftarSubmit={daftarSubmit}
        daftarSesi={daftarSesi}
        soalCount={soalCount}
        probeCounts={probeCounts}
        daftarSoalEsai={daftarSoalEsai}
        daftarSoal={daftarSoal}
      />
    </div>
  );
}
