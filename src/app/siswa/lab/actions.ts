"use server";

import { revalidatePath } from "next/cache";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cekKaryaBebas,
  cekKetentuanKode,
  cekVariabelWajib,
  gabungPesan,
  inputSesuaiWajib,
  keluaranCocok,
  bandingkanPerBaris,
  pesanBanding,
  pecahInput,
  PESAN_TUGAS_BENAR,
  PESAN_TUGAS_SALAH,
  PESAN_INPUT_SALAH,
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

// Petunjuk saat output belum cocok. Kasus tersering di modul input():
// siswa menulis input("Nama: ") sehingga teks label ikut tercetak.
// Urutan pemeriksaan mengikuti spesifikasi: jumlah baris → isi baris yang
// berbeda → spasi di awal baris. Pesan tidak pernah memuat isi target, supaya
// siswa tetap membaca soal dan memperbaiki kodenya sendiri.
function petunjukOutputSalah(
  keluaran: string,
  diharapkan: string,
  analisis: AnalisisBebas | null | undefined,
  opsi?: { izinkanPrompt?: boolean },
): string {
  // Sebagian soal (mis. tugas praktik) justru menganjurkan input("Teks: ").
  // Untuk soal itu, jangan salahkan teks prompt saat output belum cocok.
  if ((analisis?.input_berprompt ?? 0) > 0 && !opsi?.izinkanPrompt) {
    return 'Output belum sesuai. Kamu menulis teks di dalam input("..."). Teks itu hanya tampil di modal, bukan bagian output, jadi jangan di-print ulang.';
  }
  const banding = bandingkanPerBaris(keluaran, diharapkan);
  if (banding.cocok) return "Output sudah sesuai.";
  return `Output belum sesuai. ${pesanBanding(banding)}`;
}

export async function simpanHasilLab(input: {
  exerciseId: string;
  kode: string;
  keluaran: string;
  keluaranUji?: string | null;
  galatUji?: string | null;
  /** Baris input yang benar-benar dikonsumsi input() pada run utama. */
  masukanDipakai?: string[] | null;
  analisis?: AnalisisBebas | null;
}): Promise<HasilSimpanLab> {
  const { siswa } = await requireSiswa();

  const exerciseId = String(input.exerciseId ?? "").trim();
  if (!exerciseId) {
    return { ...HASIL_GAGAL, message: "Latihan tidak ditemukan." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Ambil latihan (jenis, target output, aturan, level, modul, input wajib).
  // Kolom input baru ada setelah SQL Tahap 29 dijalankan.
  const KOLOM_LATIHAN = "lesson_id, level, jenis, keluaran_diharapkan, aturan";
  const ambilLatihan = (kolom: string) =>
    supabase
      .from("coding_exercises")
      .select(kolom)
      .eq("id", exerciseId)
      .maybeSingle();

  const lengkap = await ambilLatihan(
    `${KOLOM_LATIHAN}, masukan, masukan_uji, keluaran_uji`,
  );
  const { data: exercise } = lengkap.error
    ? await ambilLatihan(KOLOM_LATIHAN)
    : lengkap;

  if (!exercise) {
    return { ...HASIL_GAGAL, message: "Latihan tidak ditemukan." };
  }

  const exerciseRow = exercise as unknown as {
    lesson_id: string;
    level: number;
    jenis: string;
    keluaran_diharapkan: string;
    aturan: AturanBebas | null;
    masukan?: string | null;
    masukan_uji?: string | null;
    keluaran_uji?: string | null;
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
  const keluaranUjiTeks =
    typeof input.keluaranUji === "string" ? input.keluaranUji : null;
  const galatUjiTeks =
    typeof input.galatUji === "string" && input.galatUji.trim()
      ? input.galatUji
      : null;

  const aturan = exerciseRow.aturan ?? {};
  // Ada uji internal (input berbeda) untuk latihan ini?
  const adaUji = Boolean(exerciseRow.masukan_uji?.trim());
  // Input wajib modul input(). Kosong untuk modul lama (Modul 1 & 2).
  const inputWajib = pecahInput(exerciseRow.masukan);
  // Baris yang benar-benar dikonsumsi input() saat run utama.
  const inputDipakai = Array.isArray(input.masukanDipakai)
    ? input.masukanDipakai.map((baris) => String(baris))
    : null;
  // Siswa mengganti input wajib? Kalau ya, target output tidak lagi berarti.
  const inputDiubah =
    inputWajib.length > 0 && !inputSesuaiWajib(inputDipakai, inputWajib);

  // Penilaian di server.
  let benarBaru: boolean;
  let petunjuk: string | null = null;
  // true = yang salah adalah input yang diketik siswa (bukan kodenya).
  // Pesannya harus tampil apa adanya, tanpa awalan pesan umum.
  let inputSalah = false;

  // Pesan khusus tugas praktik (kalau ada). Modul lama tidak mengisinya,
  // sehingga pesan bawaannya tetap seperti sebelumnya. Cukup salah satu kunci
  // diisi untuk mengaktifkan mode pesan tugas; kunci lainnya memakai teks baku.
  const pakaiPesanTugas =
    aturan.pesan_benar !== undefined || aturan.pesan_salah !== undefined;
  const pesanBenarKhusus = pakaiPesanTugas
    ? aturan.pesan_benar?.trim() || PESAN_TUGAS_BENAR
    : null;
  const pesanSalahKhusus = pakaiPesanTugas
    ? aturan.pesan_salah?.trim() || PESAN_TUGAS_SALAH
    : null;
  const pesanInputKhusus = pakaiPesanTugas
    ? aturan.pesan_input_salah?.trim() || PESAN_INPUT_SALAH
    : aturan.pesan_input_salah?.trim() || null;

  if (exerciseRow.jenis === "bebas") {
    const hasilCek = cekKaryaBebas(input.analisis, keluaranTeks, aturan);
    benarBaru = hasilCek.benar;
    petunjuk = hasilCek.petunjuk;

    // Karya bebas: output harus berubah saat inputnya diganti.
    if (benarBaru && aturan.wajib_dinamis) {
      if (galatUjiTeks) {
        benarBaru = false;
        petunjuk =
          "Dengan input berbeda, program berhenti karena error. Pastikan program memakai data dari input() dan menampilkan semua masukan.";
      } else if (keluaranUjiTeks === null) {
        benarBaru = false;
        petunjuk =
          "Program perlu diuji ulang dengan input berbeda. Tekan Run Python sekali lagi.";
      } else if (keluaranCocok(keluaranUjiTeks, keluaranTeks)) {
        benarBaru = false;
        petunjuk =
          "Output tidak berubah saat inputnya diganti. Pastikan semua data ditampilkan dari variabel hasil input().";
      }
    }
  } else {
    // Target output hanya berlaku untuk input wajib yang tertulis di soal.
    // Dicek lebih dulu supaya pesan "input berbeda" tidak menutupi pesan
    // bahwa program tidak memakai input sama sekali (hardcode).
    benarBaru = !inputDiubah;
    inputSalah = inputDiubah;
    petunjuk = inputDiubah
      ? (pesanInputKhusus ||
        "Input yang kamu pakai berbeda dari input wajib. Ketik ulang input wajib persis seperti yang tertulis, lalu tekan Run Python lagi.")
      : null;

    if (benarBaru && !keluaranCocok(keluaranTeks, exerciseRow.keluaran_diharapkan)) {
      benarBaru = false;
      petunjuk = petunjukOutputSalah(
        keluaranTeks,
        exerciseRow.keluaran_diharapkan,
        input.analisis,
        { izinkanPrompt: aturan.izinkan_prompt === true },
      );
    }

    // Ketentuan jumlah variabel/input()/print() dan garis pembatas. Hanya
    // berlaku kalau soalnya memang mengisi angka minimalnya, jadi modul lama
    // tidak ikut berubah.
    const adaKetentuanJumlah =
      (aturan.min_variabel ?? 0) > 0 ||
      (aturan.min_input ?? 0) > 0 ||
      (aturan.min_print ?? 0) > 0 ||
      (aturan.min_baris ?? 0) > 0 ||
      aturan.wajib_garis === true;

    if (benarBaru && adaKetentuanJumlah) {
      const cekJumlah = cekKetentuanKode(input.analisis, keluaranTeks, aturan);
      benarBaru = cekJumlah.benar;
      petunjuk = cekJumlah.petunjuk;
    }

    // Pastikan variabel wajib benar-benar dibuat, diisi dari input(), dan
    // ditampilkan dengan print().
    if (benarBaru) {
      const cekVar = cekVariabelWajib(input.analisis, aturan.variabel_wajib ?? [], {
        dariInput: aturan.dari_input === true,
      });
      benarBaru = cekVar.benar;
      petunjuk = cekVar.petunjuk;
    }

    // Larangan perulangan (mis. tantangan "PESAN BERULANG").
    if (benarBaru && aturan.tanpa_loop && (input.analisis?.jumlah_loop ?? 0) > 0) {
      benarBaru = false;
      petunjuk =
        "Tantangan ini diminta tanpa perulangan. Tulis print() beberapa kali, bukan for/while.";
    }

    // Uji internal: kode yang sama dijalankan dengan input berbeda.
    // Fail-closed: latihan bermodul input WAJIB punya uji. Kalau uji tidak
    // tersedia, jangan pernah meloloskan jawaban tanpa uji.
    if (benarBaru && (adaUji || inputWajib.length > 0)) {
      if (!adaUji || !exerciseRow.keluaran_uji?.trim()) {
        benarBaru = false;
        petunjuk =
          "Soal ini belum siap dinilai karena data ujinya tidak lengkap. Hubungi gurumu.";
      } else if (galatUjiTeks) {
        benarBaru = false;
        petunjuk =
          "Dengan input berbeda, program berhenti karena error. Pastikan jumlah input() dan pengolahan datanya benar.";
      } else if (keluaranUjiTeks === null) {
        benarBaru = false;
        petunjuk =
          "Program perlu diuji ulang dengan input berbeda. Tekan Run Python sekali lagi.";
      } else if (
        !keluaranCocok(keluaranUjiTeks, exerciseRow.keluaran_uji)
      ) {
        benarBaru = false;
        petunjuk =
          "Dengan input berbeda, output tidak sesuai. Pastikan program mengolah data dari input(), bukan menulis jawaban langsung.";
      }
    }
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

  // Catat input yang dipakai (tidak wajib; kolomnya baru ada setelah Tahap 29).
  void supabase
    .from("coding_submissions")
    .update({ masukan_dipakai: inputDipakai })
    .eq("exercise_id", exerciseId)
    .eq("siswa_id", siswa.id)
    .then(
      () => undefined,
      () => undefined,
    );

  return {
    sukses: true,
    message: null,
    percobaan: percobaanBaru,
    pernahBenar: pernahBenarBaru,
    benar: benarBaru,
    // Modul lama: petunjuk apa adanya (perilaku sebelumnya). Tugas praktik:
    // kalimat baku + petunjuk spesifik, tanpa membocorkan kode solusi.
    petunjuk: benarBaru
      ? pesanBenarKhusus
      : inputSalah
        ? petunjuk
        : pesanSalahKhusus
          ? gabungPesan(pesanSalahKhusus, petunjuk)
          : petunjuk,
  };
}

// ============================================================================
// Ambil input uji (input berbeda) untuk sebuah latihan.
//
// Sengaja dipisah dari data halaman: isinya baru diambil saat siswa menekan
// Run, jadi tidak ikut terkirim waktu halaman dimuat. Dipakai untuk menguji
// bahwa program benar-benar mengolah data dari input(), bukan menulis jawaban.
// ============================================================================
export async function ambilMasukanUji(
  exerciseId: string,
): Promise<{ masukan: string } | null> {
  await requireSiswa();

  const id = String(exerciseId ?? "").trim();
  if (!id) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("coding_exercises")
    .select("masukan_uji")
    .eq("id", id)
    .maybeSingle();

  // Kolom bisa belum ada sebelum SQL Tahap 29 dijalankan → data null.
  const masukan = (data as { masukan_uji?: string | null } | null)?.masukan_uji;
  if (!masukan || !masukan.trim()) return null;

  return { masukan };
}
