import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AreaInputNilai } from "@/components/area-input-nilai";
import { KartuRanking } from "@/components/kartu-ranking";
import { createClient } from "@/lib/supabase/server";
import {
  ambilKelasUlangan,
  namaKelasDariIds,
} from "@/lib/ambil-kelas-ulangan";
import { toggleUlangan } from "@/app/guru/ulangan/actions";

type SiswaRow = {
  id: string;
  nis: string | null;
  nama_siswa: string;
  // Kelas asal siswa (untuk penanda di tabel input nilai)
  kelasId: string | null;
  // Nilai yang sudah terinput untuk ulangan ini, atau null
  nilai: number | null;
};

// Ranking per siswa. tiedWith = jumlah siswa lain yang nilainya sama
// (1 berarti tidak ada yang seri). null = belum ada nilai.
export type InfoRanking = {
  ranking: number | null;
  tiedWith: number;
};

export default async function InputNilaiPage({
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

  // Ambil detail ulangan + semua kelasnya (gabungan legacy + relasi)
  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select(
      "id, judul, kelas_id, tanggal, status, tenggat, dibuka, exam_classes(kelas_id)",
    )
    .eq("id", id)
    .maybeSingle();

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

  // Nilai yang sudah diinput sebelumnya untuk ulangan ini
  const { data: nilaiLama } = await supabase
    .from("exam_scores")
    .select("siswa_id, nilai")
    .eq("exam_id", id);

  const nilaiPerSiswa = new Map(
    (nilaiLama ?? []).map((row) => [row.siswa_id, row.nilai]),
  );

  // Daftar siswa yang akan dinilai.
  // - "Semua kelas" (0 id) → semua siswa tanpa filter.
  // - Kelas tertentu → siswa di kelas-kelas tersebut.
  let daftarSiswa: SiswaRow[] = [];

  const ambilSiswa = async () => {
    const query = supabase
      .from("students")
      .select("id, nis, nama_siswa, kelas_id");

    if (daftarKelasId.length > 0) {
      query.in("kelas_id", daftarKelasId);
    }
    return query;
  };

  const { data: siswaData, error: galatSiswa } = await ambilSiswa();

  if (!galatSiswa) {
    daftarSiswa = (siswaData ?? []).map((row) => ({
      id: row.id,
      nis: row.nis,
      nama_siswa: row.nama_siswa,
      kelasId: row.kelas_id,
      nilai: nilaiPerSiswa.get(row.id) ?? null,
    }));

    daftarSiswa.sort((a, b) =>
      a.nama_siswa.localeCompare(b.nama_siswa, "id", {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }

  // ---------- Ranking per ulangan (competition ranking: 1, 2, 2, 4) ----------
  // Berdasarkan nilai yang sudah tersimpan di DB. Siswa tanpa nilai
  // tidak ikut ranking.
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
              · Status: Akan dilaksanakan
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
            Ulangan ini berstatus <b>Akan dilaksanakan</b>. Siswa bisa
            mengerjakan soal secara online. Nilai PG dihitung otomatis saat
            siswa submit; nilai esai dinilai manual melalui halaman{" "}
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
      </div>

      {tigaTeratas.length > 0 ? (
        <KartuRanking
          judul="3 Siswa Teratas"
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
          examId={id}
          daftarSiswa={daftarSiswa}
          ranking={ranking}
          mapSiswaIdKeNamaKelas={mapSiswaIdKeNamaKelas}
        />
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Belum ada siswa{daftarKelasId.length > 0 ? " di kelas-kelas tersebut" : ""}.
          Tambahkan siswa dulu di menu Data Siswa.
        </div>
      )}
    </div>
  );
}

// Competition ranking: nilai sama dapat ranking sama (1, 2, 2, 4).
// Siswa tanpa nilai tidak ikut ranking (ranking: null).
function hitungRanking(daftar: SiswaRow[]): Map<string, InfoRanking> {
  const hasil = new Map<string, InfoRanking>();

  const dinilai = daftar
    .filter((s): s is SiswaRow & { nilai: number } => s.nilai !== null)
    .sort((a, b) => {
      if (b.nilai - a.nilai !== 0) return b.nilai - a.nilai;
      return a.nama_siswa.localeCompare(b.nama_siswa, "id", {
        numeric: true,
        sensitivity: "base",
      });
    });

  let urutan = 0;
  for (let i = 0; i < dinilai.length; i++) {
    const s = dinilai[i];
    // Posisi berubah saat nilainya beda dari sebelumnya.
    if (i === 0 || s.nilai !== dinilai[i - 1].nilai) {
      urutan = i + 1;
    }
    // tiedWith = berapa banyak siswa dengan nilai sama (termasuk diri sendiri).
    let tiedWith = 1;
    for (let j = i + 1; j < dinilai.length; j++) {
      if (dinilai[j].nilai === s.nilai) tiedWith++;
      else break;
    }
    hasil.set(s.id, { ranking: urutan, tiedWith });
  }

  // Sisanya (belum dinilai) tidak punya ranking.
  for (const s of daftar) {
    if (!hasil.has(s.id)) {
      hasil.set(s.id, { ranking: null, tiedWith: 0 });
    }
  }

  return hasil;
}
