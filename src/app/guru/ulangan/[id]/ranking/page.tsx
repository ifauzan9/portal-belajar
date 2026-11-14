import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KartuRanking } from "@/components/kartu-ranking";
import { createClient } from "@/lib/supabase/server";
import {
  ambilKelasUlangan,
  namaKelasDariIds,
} from "@/lib/ambil-kelas-ulangan";
import { gabungNilaiUlangan } from "@/lib/nilai-ulangan";
import { hitungRanking } from "@/lib/ranking";
import { hitungRataRata, tampilkanRataRata } from "@/lib/rata-rata";
import { statusNilai } from "@/lib/status-nilai";
import { Badge } from "@/components/ui/badge";
import { formatTanggalWib } from "@/lib/waktu";

type SiswaRow = {
  id: string;
  nis: string | null;
  nama_siswa: string;
  kelasId: string | null;
  namaKelas: string;
  nilai: number | null;
};

// Warna lencana peringkat. Peringkat 1/2/3 memakai warna emas/perak/perunggu.
function warnaPeringkat(peringkat: number): string {
  if (peringkat === 1) {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (peringkat === 2) {
    return "bg-slate-100 text-slate-700 ring-slate-300";
  }
  if (peringkat === 3) {
    return "bg-orange-100 text-orange-800 ring-orange-200";
  }
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

function bandingkanNama(a: SiswaRow, b: SiswaRow): number {
  return a.nama_siswa.localeCompare(b.nama_siswa, "id", {
    numeric: true,
    sensitivity: "base",
  });
}

function bandingkanKelasLaluNama(a: SiswaRow, b: SiswaRow): number {
  const kelas = a.namaKelas.localeCompare(b.namaKelas, "id", {
    numeric: true,
    sensitivity: "base",
  });
  return kelas !== 0 ? kelas : bandingkanNama(a, b);
}

export default async function RankingUlanganPage({
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

  // Detail ulangan + kelas sasaran (gabungan kolom lama + relasi).
  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select("id, judul, kelas_id, tanggal, status, exam_classes(kelas_id)")
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
    exam_classes: { kelas_id: string }[];
  };

  const daftarKelasId = ambilKelasUlangan(dataUlangan);

  const kelasRes = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  const semuaKelas: { id: string; nama_kelas: string }[] =
    kelasRes.data ?? [];
  const mapIdKeNama = new Map(
    semuaKelas.map((kelas) => [kelas.id, kelas.nama_kelas]),
  );
  const namaKelasTeks =
    daftarKelasId.length === 0
      ? "Semua kelas"
      : namaKelasDariIds(daftarKelasId, mapIdKeNama).join(", ");

  // Siswa yang ikut ulangan. Kalau ulangan berlaku untuk semua kelas,
  // ambil semua siswa; kalau tidak, hanya kelas sasaran.
  let siswaQuery = supabase
    .from("students")
    .select("id, nis, nama_siswa, kelas_id");

  if (daftarKelasId.length > 0) {
    siswaQuery = siswaQuery.in("kelas_id", daftarKelasId);
  }

  const [siswaRes, nilaiRes, submitRes] = await Promise.all([
    siswaQuery,
    supabase
      .from("exam_scores")
      .select("siswa_id, nilai")
      .eq("exam_id", id),
    supabase
      .from("exam_submissions")
      .select("siswa_id, nilai_total")
      .eq("exam_id", id),
  ]);

  // Nilai resmi diutamakan; nilai submit dipakai sebagai cadangan kalau
  // baris exam_scores belum tersinkron. Sama seperti halaman input nilai.
  const nilaiPerSiswa = gabungNilaiUlangan(
    nilaiRes.data as { siswa_id: string; nilai: number }[] | null,
    submitRes.data as { siswa_id: string; nilai_total: number }[] | null,
  );

  const daftarSiswa: SiswaRow[] = (siswaRes.data ?? []).map((row) => ({
    id: row.id,
    nis: row.nis,
    nama_siswa: row.nama_siswa,
    kelasId: row.kelas_id,
    namaKelas: row.kelas_id
      ? (mapIdKeNama.get(row.kelas_id) ?? "Belum ada kelas")
      : "Belum ada kelas",
    nilai: nilaiPerSiswa.get(row.id) ?? null,
  }));

  const ranking = hitungRanking(daftarSiswa);

  // Ranking hanya untuk siswa yang sudah punya nilai. Tie-break tampilan:
  // nilai, lalu kelas, lalu nama. Peringkat tetap competition ranking.
  const dinilai = daftarSiswa
    .filter((siswa): siswa is SiswaRow & { nilai: number } => {
      return siswa.nilai !== null;
    })
    .sort((a, b) => {
      if (b.nilai !== a.nilai) return b.nilai - a.nilai;
      return bandingkanKelasLaluNama(a, b);
    });

  const belumDinilai = daftarSiswa
    .filter((siswa) => siswa.nilai === null)
    .sort(bandingkanKelasLaluNama);

  const tigaTeratas = dinilai.slice(0, 3).map((siswa) => ({
    nama: siswa.nama_siswa,
    nis: siswa.nis,
    nilai: siswa.nilai,
    ranking: ranking.get(siswa.id)!.ranking!,
  }));

  const rataRata = tampilkanRataRata(
    hitungRataRata(dinilai.map((siswa) => siswa.nilai)),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/guru/ulangan/${id}/nilai`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Nilai
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Ranking — {dataUlangan.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Peringkat seluruh siswa dari {namaKelasTeks}.
          {dataUlangan.tanggal
            ? ` · Tanggal: ${formatTanggalWib(dataUlangan.tanggal)}`
            : ""}
        </p>
      </div>

      {siswaRes.error ? (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100">
          Gagal memuat daftar siswa: {siswaRes.error.message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium text-slate-500">Total siswa</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {daftarSiswa.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium text-slate-500">Sudah dinilai</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700 tabular-nums">
            {dinilai.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium text-slate-500">Belum dinilai</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700 tabular-nums">
            {belumDinilai.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium text-slate-500">Rata-rata</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {rataRata}
          </p>
        </div>
      </div>

      {tigaTeratas.length > 0 ? (
        <KartuRanking
          judul="3 Siswa Teratas — Seluruh Kelas"
          daftar={tigaTeratas}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Ranking Seluruh Siswa
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Nilai yang sama mendapat peringkat yang sama. Hanya siswa yang
            sudah dinilai yang masuk ranking.
          </p>
        </div>

        {dinilai.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="w-20 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Peringkat
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    NIS
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Nama
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Kelas
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-medium text-slate-500 sm:px-5"
                  >
                    Nilai
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Keterangan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dinilai.map((siswa) => {
                  const info = ranking.get(siswa.id)!;
                  const peringkat = info.ranking!;
                  const status = statusNilai(siswa.nilai);
                  return (
                    <tr
                      key={siswa.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ring-1 ${warnaPeringkat(
                            peringkat,
                          )}`}
                        >
                          {peringkat}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums sm:px-5">
                        {siswa.nis ?? "-"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 sm:px-5">
                        {siswa.nama_siswa}
                      </td>
                      <td className="px-4 py-3 text-slate-500 sm:px-5">
                        {siswa.namaKelas}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums sm:px-5">
                        {siswa.nilai}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 sm:px-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {status ? (
                            <Badge varian={status.varian}>
                              {status.label}
                            </Badge>
                          ) : null}
                          {info.tiedWith > 1 ? (
                            <span>Seri {info.tiedWith} siswa</span>
                          ) : status ? null : (
                            <span>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
            Belum ada nilai untuk ulangan ini.{" "}
            <Link
              href={`/guru/ulangan/${id}/nilai`}
              className="font-medium text-slate-900 underline"
            >
              Input nilai dulu
            </Link>
            .
          </div>
        )}
      </section>

      {belumDinilai.length > 0 ? (
        <details className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-5">
            Belum dinilai ({belumDinilai.length}){" "}
            <span className="text-xs font-normal text-slate-400">
              · klik untuk lihat
            </span>
          </summary>

          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    NIS
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Nama
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Kelas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {belumDinilai.map((siswa) => (
                  <tr key={siswa.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 tabular-nums sm:px-5">
                      {siswa.nis ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 sm:px-5">
                      {siswa.nama_siswa}
                    </td>
                    <td className="px-4 py-3 text-slate-500 sm:px-5">
                      {siswa.namaKelas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            Input nilai lewat{" "}
            <Link
              href={`/guru/ulangan/${id}/nilai`}
              className="font-medium text-slate-900 underline"
            >
              halaman Nilai
            </Link>
            .
          </p>
        </details>
      ) : null}
    </div>
  );
}
