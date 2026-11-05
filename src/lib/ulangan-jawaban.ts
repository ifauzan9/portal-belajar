// ============================================================================
// Data jawaban siswa untuk halaman review guru.
//
// Dipakai oleh dua tempat:
//  - /guru/ulangan/[id]/soal   (Kelola Soal)
//  - /guru/ulangan/[id]/nilai  (Input Nilai)
//
// Isinya: submit + jawaban, nilai kode otomatis + rincian, nilai esai per
// soal, dan jumlah probe (keluar halaman / pindah tab).
// ============================================================================

import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SoalEsaiView = { id: string; urutan: number; potongan: string };
export type NilaiEsaiPerSoal = Record<string, number>; // soalId → nilai

export type KodeJawabanView = {
  soalId: string;
  kode: string;
  keluaran: string;
  keluaranUji: string | null;
  nilai: number;
  rincian: { terpenuhi?: string[]; belum?: string[] } | null;
  percobaan: number;
};

export type SubmitView = {
  id: string;
  siswa_id: string;
  nilai_pg: number;
  nilai_esai: number;
  nilai_kode: number;
  nilai_kode_manual: number | null;
  nilai_total: number;
  disubmit_at: string;
  namaSiswa: string;
  nis: string | null;
  daftarJawaban: { soalId: string; jawaban: string }[];
  // Nilai esai yang sudah tersimpan per soal (soalId → nilai).
  // null = belum ada data penilaian per soal.
  nilaiEsaiPerSoal: NilaiEsaiPerSoal | null;
  // Jawaban kode (kosong untuk ulangan tanpa soal kode).
  daftarKode: KodeJawabanView[];
};

// Siswa yang sudah memulai ulangan (punya baris exam_sessions) tetapi
// belum submit. Dipakai untuk menampilkan tombol reset timer.
export type SesiView = {
  siswa_id: string;
  namaSiswa: string;
  nis: string | null;
  mulai_at: string;
};

export type DataJawabanUlangan = {
  daftarSubmit: SubmitView[];
  daftarSesi: SesiView[];
  soalCount: number;
  probeCounts: Record<string, number> | null;
  daftarSoalEsai: SoalEsaiView[];
};

type SoalRingkas = { id: string; jenis: string; soal: string };

export async function ambilDataJawabanUlangan(
  supabase: Supabase,
  examId: string,
  daftarSoal: SoalRingkas[],
): Promise<DataJawabanUlangan> {
  // Jumlah "probe" per siswa: berapa kali siswa meninggalkan halaman soal
  // / pindah tab / minimize browser selama pengerjaan. Dicatat real-time
  // oleh server action `catatProbe` di sisi siswa.
  const { data: probeData, error: galatProbe } = await supabase
    .from("exam_probes")
    .select("siswa_id")
    .eq("exam_id", examId);

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

  // Sesi siswa yang sudah mulai (timer berjalan). Ini juga menangkap
  // siswa yang belum submit — penting untuk tombol reset timer.
  const { data: sesiData, error: galatSesi } = await supabase
    .from("exam_sessions")
    .select("siswa_id, mulai_at, students(nis, nama_siswa)")
    .eq("exam_id", examId);

  const daftarSesi: SesiView[] = [];
  if (!galatSesi) {
    for (const raw of sesiData ?? []) {
      const row = raw as {
        siswa_id: string;
        mulai_at: string;
        students:
          | { nis: string | null; nama_siswa: string }
          | { nis: string | null; nama_siswa: string }[]
          | null;
      };
      const siswa = Array.isArray(row.students)
        ? row.students[0]
        : row.students;
      daftarSesi.push({
        siswa_id: row.siswa_id,
        namaSiswa: siswa?.nama_siswa ?? "Siswa",
        nis: siswa?.nis ?? null,
        mulai_at: row.mulai_at,
      });
    }
  }

  // Daftar soal esai (urut) + potongan teks soal sebagai label input
  // nilai per soal. Urutan = posisi soal esai ke-n di antara soal esai.
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
    .eq("exam_id", examId);

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
  const kolomSubmitLengkap =
    "id, siswa_id, nilai_pg, nilai_esai, nilai_kode, nilai_kode_manual, nilai_total, disubmit_at, students(nis, nama_siswa), exam_answers(soal_id, jawaban)";
  const kolomSubmitDasar =
    "id, siswa_id, nilai_pg, nilai_esai, nilai_total, disubmit_at, students(nis, nama_siswa), exam_answers(soal_id, jawaban)";

  const hasilSubmit = await supabase
    .from("exam_submissions")
    .select(kolomSubmitLengkap)
    .eq("exam_id", examId)
    .order("nilai_total", { ascending: false });

  let submitData: unknown[] | null = hasilSubmit.data;

  if (!submitData) {
    const fallback = await supabase
      .from("exam_submissions")
      .select(kolomSubmitDasar)
      .eq("exam_id", examId)
      .order("nilai_total", { ascending: false });
    submitData = fallback.data;
  }

  // Jawaban kode (kode terakhir + rincian nilai otomatis).
  const idSubmit = (submitData ?? []).map(
    (row) => (row as { id: string }).id,
  );
  const mapKodePerSubmission: Record<string, KodeJawabanView[]> = {};
  if (idSubmit.length > 0) {
    const { data: kodeData } = await supabase
      .from("exam_code_answers")
      .select(
        "submission_id, soal_id, kode, keluaran, keluaran_uji, nilai, rincian, percobaan",
      )
      .in("submission_id", idSubmit);

    for (const raw of kodeData ?? []) {
      const row = raw as {
        submission_id: string;
        soal_id: string;
        kode: string;
        keluaran: string;
        keluaran_uji: string | null;
        nilai: number;
        rincian: { terpenuhi?: string[]; belum?: string[] } | null;
        percobaan: number;
      };
      if (!mapKodePerSubmission[row.submission_id]) {
        mapKodePerSubmission[row.submission_id] = [];
      }
      mapKodePerSubmission[row.submission_id].push({
        soalId: row.soal_id,
        kode: row.kode,
        keluaran: row.keluaran,
        keluaranUji: row.keluaran_uji,
        nilai: row.nilai,
        rincian: row.rincian,
        percobaan: row.percobaan,
      });
    }
  }

  // Ratakan: satu SubmitView per submit
  const daftarSubmit: SubmitView[] = (submitData ?? []).map((row) => {
    const r = row as {
      id: string;
      siswa_id: string;
      nilai_pg: number;
      nilai_esai: number;
      nilai_kode?: number;
      nilai_kode_manual?: number | null;
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
      nilai_kode: r.nilai_kode ?? 0,
      nilai_kode_manual: r.nilai_kode_manual ?? null,
      nilai_total: r.nilai_total,
      disubmit_at: r.disubmit_at,
      namaSiswa: siswa?.nama_siswa ?? "Siswa",
      nis: siswa?.nis ?? null,
      daftarJawaban: (r.exam_answers ?? []).map((a) => ({
        soalId: a.soal_id,
        jawaban: a.jawaban,
      })),
      nilaiEsaiPerSoal: mapNilaiEsaiPerSoal[r.siswa_id] ?? null,
      daftarKode: mapKodePerSubmission[r.id] ?? [],
    };
  });

  return {
    daftarSubmit,
    daftarSesi,
    soalCount: daftarSoal.length,
    probeCounts,
    daftarSoalEsai,
  };
}