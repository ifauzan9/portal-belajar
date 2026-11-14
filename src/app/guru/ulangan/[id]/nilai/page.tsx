import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AreaInputNilai } from "@/components/area-input-nilai";
import { FilterKelasNilai } from "@/components/filter-kelas-nilai";
import { KartuRanking } from "@/components/kartu-ranking";
import {
  DaftarJawaban,
  type SoalReview,
} from "@/app/guru/ulangan/[id]/soal/daftar-jawaban";
import { createClient } from "@/lib/supabase/server";
import {
  ambilKelasUlangan,
  namaKelasDariIds,
} from "@/lib/ambil-kelas-ulangan";
import { gabungNilaiUlangan } from "@/lib/nilai-ulangan";
import { hitungRanking } from "@/lib/ranking";
import { ambilDataJawabanUlangan } from "@/lib/ulangan-jawaban";
import { toggleBagikanNilai, toggleUlangan } from "@/app/guru/ulangan/actions";
import { jenisSoalTersedia } from "@/lib/jenis-soal-ulangan";

type SiswaRow = {
  id: string;
  nis: string | null;
  nama_siswa: string;
  // Kelas asal siswa (untuk penanda di tabel input nilai)
  kelasId: string | null;
  // Nilai yang sudah terinput untuk ulangan ini, atau null
  nilai: number | null;
};

export default async function InputNilaiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kelas?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const { kelas: kelasDimintaRaw } = await searchParams;
  const kelasDiminta =
    typeof kelasDimintaRaw === "string" ? kelasDimintaRaw : "";

  // Ambil detail ulangan + semua kelasnya (gabungan legacy + relasi)
  // `bagikan_nilai` baru ada setelah Tahap 48; kalau belum, fallback ke
  // query lama dan anggap nilai belum dibagikan.
  const kolomUlangan =
    "id, judul, kelas_id, tanggal, status, tenggat, dibuka, exam_classes(kelas_id)";

  let hasilUlangan = await supabase
    .from("exams")
    .select(`${kolomUlangan}, bagikan_nilai`)
    .eq("id", id)
    .maybeSingle();

  let siapBagikan = !hasilUlangan.error;

  if (hasilUlangan.error) {
    hasilUlangan = await supabase
      .from("exams")
      .select(kolomUlangan)
      .eq("id", id)
      .maybeSingle();
    siapBagikan = false;
  }

  const { data: ulangan, error: galatUlangan } = hasilUlangan;

  if (galatUlangan || !ulangan) {
    notFound();
  }

  const dataUlangan = ulangan as {
    id: string;
    judul: string;
    kelas_id: string | null;
    tanggal: string | null;
    status: "akan" | "sudah";
    tenggat: string | null;
    dibuka: boolean | null;
    bagikan_nilai?: boolean | null;
    exam_classes: { kelas_id: string }[];
  };

  // Daftar id kelas: gabung kolom lama (mungkin ada) + relasi baru.
  // [] berarti "semua kelas".
  const daftarKelasId = ambilKelasUlangan(dataUlangan);

  // Nama kelas untuk subtitle (pakai list semua kelas, fallback "Semua kelas")
  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  const semuaKelas: { id: string; nama_kelas: string }[] =
    kelasData ?? [];
  const mapIdKeNama = new Map(
    semuaKelas.map((k) => [k.id, k.nama_kelas]),
  );

  const namaKelasTeks =
    daftarKelasId.length === 0
      ? "Semua kelas"
      : namaKelasDariIds(daftarKelasId, mapIdKeNama).join(", ");

  // Nama kelas per id (untuk kolom "Kelas" di tabel input nilai)
  const mapKelasIdKeNama = mapIdKeNama;

  // Kelas yang boleh dipilih di filter: hanya kelas sasaran ulangan.
  // Kalau ulangan berlaku untuk semua kelas, semua kelas ditampilkan.
  const kelasTersedia =
    daftarKelasId.length > 0
      ? semuaKelas.filter((kelas) => daftarKelasId.includes(kelas.id))
      : semuaKelas;
  const izinkanTanpaKelas = daftarKelasId.length === 0;

  // Validasi query `?kelas=` supaya tidak bisa memfilter kelas lain.
  let kelasFilter = "";
  if (kelasDiminta === "tanpa" && izinkanTanpaKelas) {
    kelasFilter = "tanpa";
  } else if (
    kelasDiminta &&
    kelasTersedia.some((kelas) => kelas.id === kelasDiminta)
  ) {
    kelasFilter = kelasDiminta;
  }

  const labelKelasFilter =
    kelasFilter === "tanpa"
      ? "Belum ada kelas"
      : kelasFilter
        ? (mapKelasIdKeNama.get(kelasFilter) ?? "Kelas")
        : "Semua kelas";

  // Soal untuk review jawaban + penilaian sistem. Ambil kolom lengkap
  // supaya teks soal, kunci, dan kode jawaban asli bisa ditampilkan di
  // samping jawaban siswa. Fallback bertahap kalau Tahap 36/33 belum ada.
  const kolomSoalDasar = "id, jenis, soal, urutan, pilihan, kunci, poin";
  const kolomSoalKode =
    "id, jenis, soal, urutan, pilihan, kunci, poin, keluaran_diharapkan, kode_awal, masukan, masukan_uji, keluaran_uji, aturan";
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

  const daftarSoal = (soalData ?? []) as SoalReview[];

  // Jenis soal yang ada → dipakai untuk teks info yang sesuai.
  const jenisSoal = jenisSoalTersedia(daftarSoal.map((s) => s.jenis));
  const teksInfoNilai =
    jenisSoal.esai && jenisSoal.kode
      ? "Nilai PG & kode dihitung otomatis saat siswa submit; nilai esai dinilai manual melalui halaman "
      : jenisSoal.esai
        ? "Nilai PG dihitung otomatis saat siswa submit; nilai esai dinilai manual melalui halaman "
        : jenisSoal.kode && jenisSoal.pg
          ? "Nilai PG & kode dihitung otomatis saat siswa submit; rincian soal ada di halaman "
          : jenisSoal.kode
            ? "Nilai kode dihitung otomatis saat siswa submit; rincian soal ada di halaman "
            : "Nilai PG dihitung otomatis saat siswa submit; rincian soal ada di halaman ";

  // Nilai resmi yang sudah diinput guru + nilai otomatis dari submission.
  // Submission dipakai sebagai cadangan supaya nilai ulangan online tetap
  // terlihat walau baris `exam_scores` belum tersinkron. Data submission
  // yang sama juga dipakai bagian review jawaban di bawah.
  const [hasilNilaiLama, dataJawaban] = await Promise.all([
    supabase
      .from("exam_scores")
      .select("siswa_id, nilai")
      .eq("exam_id", id),
    ambilDataJawabanUlangan(supabase, id, daftarSoal),
  ]);

  const { daftarSubmit, daftarSesi, soalCount, probeCounts, daftarSoalEsai } =
    dataJawaban;

  const nilaiPerSiswa = gabungNilaiUlangan(
    hasilNilaiLama.data as
      | { siswa_id: string; nilai: number }[]
      | null,
    daftarSubmit,
  );

  // Daftar siswa yang akan dinilai.
  // - Filter kelas aktif → hanya siswa kelas itu (atau tanpa kelas).
  // - Tanpa filter + kelas sasaran → siswa di kelas-kelas tersebut.
  // - Tanpa filter + "semua kelas" → semua siswa.
  let daftarSiswa: SiswaRow[] = [];

  let siswaQuery = supabase
    .from("students")
    .select("id, nis, nama_siswa, kelas_id");

  if (kelasFilter === "tanpa") {
    siswaQuery = siswaQuery.is("kelas_id", null);
  } else if (kelasFilter) {
    siswaQuery = siswaQuery.eq("kelas_id", kelasFilter);
  } else if (daftarKelasId.length > 0) {
    siswaQuery = siswaQuery.in("kelas_id", daftarKelasId);
  }

  const { data: siswaData, error: galatSiswa } = await siswaQuery;

  if (!galatSiswa) {
    daftarSiswa = (siswaData ?? []).map((row) => ({
      id: row.id,
      nis: row.nis,
      nama_siswa: row.nama_siswa,
      kelasId: row.kelas_id,
      nilai: nilaiPerSiswa.get(row.id) ?? null,
    }));

    // Saat "Semua kelas", urutkan per kelas lalu nama supaya daftar
    // tetap terasa dikelompokkan per kelas.
    daftarSiswa.sort((a, b) => {
      // "~" membuat siswa tanpa kelas tampil paling bawah.
      const kelasA = a.kelasId
        ? (mapKelasIdKeNama.get(a.kelasId) ?? "~")
        : "~";
      const kelasB = b.kelasId
        ? (mapKelasIdKeNama.get(b.kelasId) ?? "~")
        : "~";
      if (kelasA !== kelasB) {
        return kelasA.localeCompare(kelasB, "id", {
          numeric: true,
          sensitivity: "base",
        });
      }
      return a.nama_siswa.localeCompare(b.nama_siswa, "id", {
        numeric: true,
        sensitivity: "base",
      });
    });
  }

  // ---------- Ranking per daftar yang ditampilkan (1, 2, 2, 4) ----------
  // Saat filter kelas aktif, ranking dihitung di dalam kelas itu. Siswa
  // tanpa nilai tidak ikut ranking.
  const ranking = hitungRanking(daftarSiswa);

  // Tiga nama teratas untuk kartu ringkasan.
  const tigaTeratas = [...daftarSiswa]
    .filter((s) => s.nilai !== null)
    .sort((a, b) => {
      if (b.nilai! - a.nilai! !== 0) return b.nilai! - a.nilai!;
      return a.nama_siswa.localeCompare(b.nama_siswa, "id", {
        numeric: true,
        sensitivity: "base",
      });
    })
    .slice(0, 3);

  // Nama kelas siswa (untuk kolom "Kelas" di tabel input nilai)
  const mapSiswaIdKeNamaKelas = new Map<string, string>();
  for (const siswa of daftarSiswa) {
    if (siswa.kelasId) {
      mapSiswaIdKeNamaKelas.set(
        siswa.id,
        mapKelasIdKeNama.get(siswa.kelasId) ?? "Belum ada kelas",
      );
    } else {
      mapSiswaIdKeNamaKelas.set(siswa.id, "Belum ada kelas");
    }
  }

  // Review jawaban ikut filter kelas supaya isinya konsisten dengan
  // tabel nilai. "Semua kelas" tetap menampilkan semua submission.
  const idSiswaTampil = new Set(daftarSiswa.map((siswa) => siswa.id));
  const daftarSubmitTampil = kelasFilter
    ? daftarSubmit.filter((submit) => idSiswaTampil.has(submit.siswa_id))
    : daftarSubmit;
  const daftarSesiTampil = kelasFilter
    ? daftarSesi.filter((sesi) => idSiswaTampil.has(sesi.siswa_id))
    : daftarSesi;

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
          Input Nilai — {dataUlangan.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelas: {namaKelasTeks}
          {dataUlangan.tanggal ? ` · Tanggal: ${dataUlangan.tanggal}` : ""}
          {dataUlangan.status === "akan" ? (
            <span className="ml-2 text-xs text-blue-600">
              · Status: Sedang dilaksanakan
            </span>
          ) : null}
          {dataUlangan.dibuka === false ? (
            <span className="ml-2 text-xs text-red-600">
              · Ditutup untuk siswa
            </span>
          ) : null}
        </p>

        {dataUlangan.status === "akan" ? (
          <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-700 ring-1 ring-blue-100">
            Ulangan ini berstatus <b>Sedang dilaksanakan</b>. Siswa bisa
            mengerjakan soal secara online. {teksInfoNilai}
            <Link
              href={`/guru/ulangan/${id}/soal`}
              className="font-medium underline hover:no-underline"
            >
              Kelola Soal →
            </Link>
          </div>
        ) : null}

        {dataUlangan.dibuka === false ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-3 ring-1 ring-red-100">
            <p className="text-xs text-red-700">
              <b>Ditutup untuk siswa.</b>{" "}
              {dataUlangan.status === "akan"
                ? "Siswa tidak bisa membuka form soal. Yang sudah submit tetap bisa lihat hasil."
                : "Halaman detail nilai tidak bisa diakses siswa."}
            </p>
            <form action={toggleUlangan}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                Buka Ulangan
              </button>
            </form>
          </div>
        ) : null}

        {/* Tahap 48: bagikan / tarik nilai untuk siswa. */}
        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ring-1 ${
            dataUlangan.bagikan_nilai === true
              ? "bg-emerald-50 ring-emerald-100"
              : "bg-violet-50 ring-violet-100"
          }`}
        >
          <p
            className={`text-xs ${
              dataUlangan.bagikan_nilai === true
                ? "text-emerald-700"
                : "text-violet-700"
            }`}
          >
            {dataUlangan.bagikan_nilai === true ? (
              <>
                <b>📤 Nilai dibagikan ke siswa.</b> Siswa bisa melihat nilai
                ulangan ini di halaman mereka.
              </>
            ) : (
              <>
                <b>🔒 Nilai belum dibagikan.</b> Siswa tidak melihat angka
                nilai sampai kamu membagikannya.
              </>
            )}
            {!siapBagikan ? (
              <span className="ml-1 font-medium text-amber-700">
                Jalankan <code>schema.sql</code> Tahap 48 untuk mengaktifkan.
              </span>
            ) : null}
          </p>
          <form action={toggleBagikanNilai}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={!siapBagikan}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                dataUlangan.bagikan_nilai === true
                  ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {dataUlangan.bagikan_nilai === true
                ? "Tarik nilai"
                : "Bagikan nilai"}
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold text-slate-900">Daftar Nilai</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {kelasFilter
              ? `Menampilkan ${labelKelasFilter}`
              : "Menampilkan semua kelas"}{" "}
            · {daftarSiswa.length} siswa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/guru/ulangan/${id}/ranking`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            🏆 Ranking seluruh siswa
          </Link>
          <FilterKelasNilai
            kelasList={kelasTersedia}
            active={kelasFilter}
            izinkanTanpaKelas={izinkanTanpaKelas}
          />
        </div>
      </div>

      {tigaTeratas.length > 0 ? (
        <KartuRanking
          judul={
            kelasFilter
              ? `3 Siswa Teratas — ${labelKelasFilter}`
              : "3 Siswa Teratas"
          }
          daftar={tigaTeratas.map((s) => ({
            nama: s.nama_siswa,
            nis: s.nis,
            nilai: s.nilai!,
            ranking: ranking.get(s.id)!.ranking!,
          }))}
        />
      ) : null}

      {daftarSiswa.length > 0 ? (
        <AreaInputNilai
          key={kelasFilter || "semua"}
          examId={id}
          daftarSiswa={daftarSiswa}
          ranking={ranking}
          mapSiswaIdKeNamaKelas={mapSiswaIdKeNamaKelas}
          kelasId={kelasFilter}
        />
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {kelasFilter
            ? `Belum ada siswa di ${labelKelasFilter}.`
            : `Belum ada siswa${
                daftarKelasId.length > 0 ? " di kelas-kelas tersebut" : ""
              }.`}{" "}
          Tambahkan siswa dulu di menu Data Siswa.
        </div>
      )}

      {/* Review jawaban + penilaian sistem. Sama seperti di halaman
          Kelola Soal, tetapi bisa diakses langsung dari halaman nilai. */}
      {dataUlangan.status === "akan" || daftarSubmitTampil.length > 0 ? (
        <DaftarJawaban
          examId={id}
          daftarSubmit={daftarSubmitTampil}
          daftarSesi={daftarSesiTampil}
          soalCount={soalCount}
          probeCounts={probeCounts}
          daftarSoalEsai={daftarSoalEsai}
          daftarSoal={daftarSoal}
        />
      ) : null}
    </div>
  );
}

