// ============================================================================
// Ranking ulangan untuk halaman siswa.
//
// Menghitung peringkat seluruh siswa pada satu ulangan memakai aturan yang
// sama dengan halaman ranking guru (competition ranking: 1, 2, 2, 4).
//
// PENTING: fungsi ini TIDAK mengembalikan nilai per siswa ke lapisan
// tampilan. Nilai hanya dipakai untuk mengurutkan; yang dikirim ke
// komponen hanya peringkat, nama, dan kelas.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { gabungNilaiUlangan } from "@/lib/nilai-ulangan";
import { hitungRanking } from "@/lib/ranking";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type BarisPeringkat = {
  id: string;
  nama: string;
  namaKelas: string;
  ranking: number;
  // Jumlah siswa dengan nilai sama (termasuk diri sendiri).
  tiedWith: number;
};

export type PosisiSaya = {
  ranking: number;
  tiedWith: number;
} | null;

export type HasilRankingUlangan = {
  // Sudah terurut dari peringkat terbaik.
  daftarDinilai: BarisPeringkat[];
  // Posisi siswa yang sedang membuka halaman (null = belum dinilai).
  posisiSaya: PosisiSaya;
  totalDinilai: number;
  totalSiswa: number;
};

export async function ambilRankingUlangan(
  supabase: Supabase,
  examId: string,
  daftarKelasId: string[],
  mapKelas: Map<string, string>,
  siswaId: string,
): Promise<HasilRankingUlangan> {
  // Siswa peserta ulangan: kelas sasaran, atau semua siswa bila ulangan
  // berlaku untuk semua kelas (daftarKelasId kosong).
  let siswaQuery = supabase
    .from("students")
    .select("id, nama_siswa, kelas_id");

  if (daftarKelasId.length > 0) {
    siswaQuery = siswaQuery.in("kelas_id", daftarKelasId);
  }

  const [siswaRes, nilaiRes, submitRes] = await Promise.all([
    siswaQuery,
    supabase.from("exam_scores").select("siswa_id, nilai").eq("exam_id", examId),
    supabase
      .from("exam_submissions")
      .select("siswa_id, nilai_total")
      .eq("exam_id", examId),
  ]);

  // Nilai resmi diutamakan; nilai submit dipakai sebagai cadangan.
  const nilaiPerSiswa = gabungNilaiUlangan(
    nilaiRes.data as { siswa_id: string; nilai: number }[] | null,
    submitRes.data as { siswa_id: string; nilai_total: number }[] | null,
  );

  const daftarSiswa = (siswaRes.data ?? []).map((row) => ({
    id: row.id,
    nama_siswa: row.nama_siswa,
    namaKelas: row.kelas_id
      ? (mapKelas.get(row.kelas_id) ?? "Belum ada kelas")
      : "Belum ada kelas",
    nilai: nilaiPerSiswa.get(row.id) ?? null,
  }));

  const ranking = hitungRanking(daftarSiswa);

  // Papan peringkat hanya untuk siswa yang sudah punya nilai. Tie-break
  // tampilan: nilai, lalu kelas, lalu nama (sama seperti halaman guru).
  const daftarDinilai: BarisPeringkat[] = daftarSiswa
    .filter(
      (s): s is (typeof daftarSiswa)[number] & { nilai: number } =>
        s.nilai !== null,
    )
    .sort((a, b) => {
      if (b.nilai !== a.nilai) return b.nilai - a.nilai;
      const kelas = a.namaKelas.localeCompare(b.namaKelas, "id", {
        numeric: true,
        sensitivity: "base",
      });
      if (kelas !== 0) return kelas;
      return a.nama_siswa.localeCompare(b.nama_siswa, "id", {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map((s) => {
      const info = ranking.get(s.id)!;
      return {
        id: s.id,
        nama: s.nama_siswa,
        namaKelas: s.namaKelas,
        ranking: info.ranking!,
        tiedWith: info.tiedWith,
      };
    });

  const infoSaya = ranking.get(siswaId);

  return {
    daftarDinilai,
    posisiSaya: infoSaya?.ranking
      ? { ranking: infoSaya.ranking, tiedWith: infoSaya.tiedWith }
      : null,
    totalDinilai: daftarDinilai.length,
    totalSiswa: daftarSiswa.length,
  };
}
