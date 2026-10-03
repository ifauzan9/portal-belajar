import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  selesaiDinilai,
  batalkanSelesaiDinilai,
  toggleUlangan,
} from "@/app/guru/ulangan/actions";
import { FormSoal } from "./form-soal";
import { DaftarJawaban } from "./daftar-jawaban";
import { DaftarSoal } from "./daftar-soal";

// ============================================================================
// Halaman kelola soal ulangan (status "akan dilaksanakan").
// Dua bagian:
//   1. Daftar soal — tambah/hapus soal PG & esai.
//   2. Jawaban siswa — review submit, nilai esai manual, sinkron exam_scores.
// ============================================================================

// ============================================================================
// Jawaban siswa. Input nilai esai bersifat per soal esai (bukan total),
// jadi kita kirim daftar soal esai + map nilai esai yang sudah tersimpan.
// ============================================================================

type SoalEsaiView = { id: string; urutan: number; potongan: string };
type NilaiEsaiPerSoal = Record<string, number>; // soalId → nilai

type SubmitView = {
  id: string;
  siswa_id: string;
  nilai_pg: number;
  nilai_esai: number;
  nilai_total: number;
  disubmit_at: string;
  namaSiswa: string;
  nis: string | null;
  daftarJawaban: { soalId: string; jawaban: string }[];
  // Nilai esai yang sudah tersimpan per soal (soalId → nilai).
  // null = belum ada data penilaian per soal.
  nilaiEsaiPerSoal: NilaiEsaiPerSoal | null;
};

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

  // Detail ulangan
  // ---
  // Ambil jumlah "probe" per siswa: berapa kali siswa meninggalkan
  // halaman soal / pindah tab / minimize browser selama pengerjaan.
  // Dicatat real-time oleh server action `catatProbe` di sisi siswa.
  const { data: probeData, error: galatProbe } = await supabase
    .from("exam_probes")
    .select("siswa_id")
    .eq("exam_id", id);

  // GalatProbe tidak ditangani: kalau tabel belum dibuat (DDL belum
  // dijalankan), kembalikan null dan tampilkan tanpa data probe.
  let probeCounts: Record<string, number> | null = null;
  if (!galatProbe) {
    probeCounts = {};
    for (const p of probeData ?? []) {
      const row = p as { siswa_id: string };
      probeCounts[row.siswa_id] = (probeCounts[row.siswa_id] ?? 0) + 1;
    }
  }

  // Soal untuk ulangan ini
  const { data: soalData } = await supabase
    .from("exam_questions")
    .select("id, soal, jenis, pilihan, kunci, poin, urutan")
    .eq("exam_id", id)
    .order("urutan", { ascending: true });

  const daftarSoal = (soalData ?? []) as {
    id: string;
    soal: string;
    jenis: string;
    pilihan: string[] | null;
    kunci: string | null;
    poin: number;
    urutan: number;
  }[];

  // Daftar soal esai (urut) + potongan teks soal sebagai label input
  // nilai per soal. Urutan = posisi soal esai ke-n di antara semua soal.
  const daftarSoalEsai: SoalEsaiView[] = daftarSoal
    .filter((s) => s.jenis === "esai")
    .map((s, i) => ({
      id: s.id,
      urutan: i + 1,
      potongan: s.soal.length > 48 ? `${s.soal.slice(0, 48)}…` : s.soal,
    }));

  // Nilai esai per soal (tabel baru `exam_essay_scores`), di-
  // grupkan per (exam_id, siswa_id). Kalau DDL belum dijalankan
  // (tabel belum ada) → galat, tetap jalan dengan nilai lama.
  const { data: esaiPerSoal, error: galatEsaiPerSoal } = await supabase
    .from("exam_essay_scores")
    .select("siswa_id, soal_id, nilai")
    .eq("exam_id", id);

  const mapNilaiEsaiPerSoal: Record<string, NilaiEsaiPerSoal> = {};
  if (!galatEsaiPerSoal) {
    for (const r of esaiPerSoal ?? []) {
      const row = r as { siswa_id: string; soal_id: string; nilai: number };
      const kunci = `${row.siswa_id}`;
      if (!mapNilaiEsaiPerSoal[kunci]) mapNilaiEsaiPerSoal[kunci] = {};
      mapNilaiEsaiPerSoal[kunci][row.soal_id] = row.nilai;
    }
  }

  // Submit jawaban siswa (dengan nama siswa + jawaban detail)
  const { data: submitData } = await supabase
    .from("exam_submissions")
    .select(
      "id, siswa_id, nilai_pg, nilai_esai, nilai_total, disubmit_at, students(nis, nama_siswa), exam_answers(soal_id, jawaban)",
    )
    .eq("exam_id", id)
    .order("nilai_total", { ascending: false });

  // Ratakan: satu SubmitView per submit
  const daftarSubmit: SubmitView[] = (submitData ?? []).map((row) => {
    const r = row as {
      id: string;
      siswa_id: string;
      nilai_pg: number;
      nilai_esai: number;
      nilai_total: number;
      disubmit_at: string;
      students:
        | { nis: string | null; nama_siswa: string }
        | { nis: string | null; nama_siswa: string }[]
        | null;
      exam_answers?: { soal_id: string; jawaban: string }[] | null;
    };
    const siswa = Array.isArray(r.students)
      ? r.students[0]
      : r.students;
    return {
      id: r.id,
      siswa_id: r.siswa_id,
      nilai_pg: r.nilai_pg,
      nilai_esai: r.nilai_esai,
      nilai_total: r.nilai_total,
      disubmit_at: r.disubmit_at,
      namaSiswa: siswa?.nama_siswa ?? "Siswa",
      nis: siswa?.nis ?? null,
      daftarJawaban: (r.exam_answers ?? []).map((a) => ({
        soalId: a.soal_id,
        jawaban: a.jawaban,
      })),
      nilaiEsaiPerSoal: mapNilaiEsaiPerSoal[r.siswa_id] ?? null,
    };
  });

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
            ? `Tenggat: ${new Date(dataUlangan.tenggat).toLocaleString(
                "id-ID",
              )}`
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
          Tambahkan soal pilihan ganda (dinilai otomatis) atau esai (dinilai
          manual). Urutan tampil mengikuti urutan input.
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

      {/* ======================= JAWABAN SISWA ======================= */}
      <DaftarJawaban
        examId={id}
        daftarSubmit={daftarSubmit}
        soalCount={(soalData ?? []).length}
        probeCounts={probeCounts}
        daftarSoalEsai={daftarSoalEsai}
      />
    </div>
  );
}
