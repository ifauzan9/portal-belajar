"use server";

import { revalidatePath } from "next/cache";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cekKaryaBebas,
  cekVariabelWajib,
  keluaranCocok,
  type AnalisisBebas,
  type AturanBebas,
} from "@/lib/lab";

// ============================================================================
// Simpan hasil terakhir siswa untuk satu latihan lab. Dipanggil setiap kali
// siswa menekan "Jalankan" (hasil lama ditimpa).
//
// Penilaian dilakukan di server, bukan dipercaya dari browser:
//   - jenis "output": output dicocokkan dengan keluaran_diharapkan.
//   - jenis "bebas" : syarat kode dicek dari analisis AST worker Pyodide.
// Tantangan juga dikunci berurutan: level hanya bisa dinilai kalau semua level
// sebelumnya di modul yang sama sudah pernah benar.
// ============================================================================

export type HasilSimpanLab = {
  sukses: boolean;
  message: string | null;
  percobaan: number;
  pernahBenar: boolean;
  benar: boolean;
  petunjuk: string | null;
};

const HASIL_GAGAL: HasilSimpanLab = {
  sukses: false,
  message: null,
  percobaan: 0,
  pernahBenar: false,
  benar: false,
  petunjuk: null,
};

export async function simpanHasilLab(input: {
  exerciseId: string;
  kode: string;
  keluaran: string;
  analisis?: AnalisisBebas | null;
}): Promise<HasilSimpanLab> {
  const { siswa } = await requireSiswa();

  const exerciseId = String(input.exerciseId ?? "").trim();
  if (!exerciseId) {
    return { ...HASIL_GAGAL, message: "Latihan tidak ditemukan." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Ambil latihan (jenis, target output, aturan, level, modul).
  const { data: exercise } = await supabase
    .from("coding_exercises")
    .select("lesson_id, level, jenis, keluaran_diharapkan, aturan")
    .eq("id", exerciseId)
    .maybeSingle();

  if (!exercise) {
    return { ...HASIL_GAGAL, message: "Latihan tidak ditemukan." };
  }

  const exerciseRow = exercise as {
    lesson_id: string;
    level: number;
    jenis: string;
    keluaran_diharapkan: string;
    aturan: AturanBebas | null;
  };

  // Pastikan latihan ini memang untuk kelas siswa (kalau ada target kelas).
  const { data: kelasTarget } = await supabase
    .from("coding_lesson_classes")
    .select("kelas_id")
    .eq("lesson_id", exerciseRow.lesson_id);

  const daftarKelasId = (kelasTarget ?? []).map(
    (baris) => (baris as { kelas_id: string }).kelas_id,
  );
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) {
    return { ...HASIL_GAGAL, message: "Latihan ini tidak tersedia untuk kelasmu." };
  }

  // Kunci berurutan: semua level sebelumnya harus sudah pernah benar.
  const { data: sebelumnya } = await supabase
    .from("coding_exercises")
    .select("id")
    .eq("lesson_id", exerciseRow.lesson_id)
    .lt("level", exerciseRow.level);

  const idSebelumnya = (sebelumnya ?? []).map((b) => (b as { id: string }).id);

  if (idSebelumnya.length > 0) {
    const { data: selesaiData } = await admin
      .from("coding_submissions")
      .select("exercise_id")
      .eq("siswa_id", siswa.id)
      .eq("pernah_benar", true)
      .in("exercise_id", idSebelumnya);

    const selesai = new Set(
      (selesaiData ?? []).map((b) => (b as { exercise_id: string }).exercise_id),
    );

    if (selesai.size < idSebelumnya.length) {
      return {
        ...HASIL_GAGAL,
        message: "Selesaikan tantangan sebelumnya dulu.",
      };
    }
  }

  const keluaranTeks = String(input.keluaran ?? "");

  // Penilaian di server.
  let benarBaru: boolean;
  let petunjuk: string | null = null;

  if (exerciseRow.jenis === "bebas") {
    const hasilCek = cekKaryaBebas(
      input.analisis,
      keluaranTeks,
      exerciseRow.aturan ?? {},
    );
    benarBaru = hasilCek.benar;
    petunjuk = hasilCek.petunjuk;
  } else if (!keluaranCocok(keluaranTeks, exerciseRow.keluaran_diharapkan)) {
    benarBaru = false;
    petunjuk =
      "Output belum sesuai. Periksa kembali isi variabel, urutan print(), dan jumlah baris.";
  } else {
    // Output sudah cocok; pastikan variabel wajib benar-benar dipakai.
    const wajib = exerciseRow.aturan?.variabel_wajib ?? [];
    const cekVar = cekVariabelWajib(input.analisis, wajib);
    benarBaru = cekVar.benar;
    petunjuk = cekVar.petunjuk;
  }

  const { data: lama } = await admin
    .from("coding_submissions")
    .select("percobaan, pernah_benar")
    .eq("exercise_id", exerciseId)
    .eq("siswa_id", siswa.id)
    .maybeSingle();

  const dataLama = lama as
    | { percobaan: number | null; pernah_benar: boolean | null }
    | null;

  const percobaanLama = dataLama?.percobaan ?? 0;
  const pernahLama = dataLama?.pernah_benar ?? false;
  const percobaanBaru = percobaanLama + 1;
  const pernahBenarBaru = pernahLama || benarBaru;

  const { error } = await admin.from("coding_submissions").upsert(
    {
      exercise_id: exerciseId,
      siswa_id: siswa.id,
      kode: String(input.kode ?? ""),
      keluaran: keluaranTeks,
      benar: benarBaru,
      pernah_benar: pernahBenarBaru,
      percobaan: percobaanBaru,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "exercise_id,siswa_id" },
  );

  if (error) {
    return {
      sukses: false,
      message: `Gagal menyimpan hasil: ${error.message}`,
      percobaan: percobaanLama,
      pernahBenar: pernahLama,
      benar: benarBaru,
      petunjuk,
    };
  }

  revalidatePath("/siswa/lab");
  revalidatePath("/guru/lab/hasil");

  return {
    sukses: true,
    message: null,
    percobaan: percobaanBaru,
    pernahBenar: pernahBenarBaru,
    benar: benarBaru,
    petunjuk,
  };
}
