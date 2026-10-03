"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { bacaKelasDariForm } from "@/lib/pilih-kelas";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { bacaNilaiDariForm, parseNilaiExcel } from "@/lib/parse-nilai";

const MAX_JUDUL = 200;
const MAX_KODE = 50;

// Membaca daftar kelas dari form: pilihan di `PilihKelasMulti` dikirim
// sebagai input bernama "kelas[]" (bisa beberapa). [] = "semua kelas".

// Simpan hubungan kelas untuk satu ulangan. Kosong = hapus semua
// (berlaku untuk semua kelas), mirip pola pengumuman.
async function simpanKelasUlangan(
  supabase: Awaited<ReturnType<typeof requireGuru>>,
  ulanganId: string,
  daftarKelasId: string[],
) {
  if (daftarKelasId.length > 0) {
    const { error } = await supabase
      .from("exam_classes")
      .upsert(
        daftarKelasId.map((kelasId) => ({
          ulangan_id: ulanganId,
          kelas_id: kelasId,
        })),
      );

    if (error) {
      throw new Error(`gagal menyimpan hubungan kelas: ${error.message}`);
    }
  } else {
    const { error } = await supabase
      .from("exam_classes")
      .delete()
      .eq("ulangan_id", ulanganId);

    if (error) {
      throw new Error(`gagal menghapus hubungan kelas: ${error.message}`);
    }
  }
}

export async function addUlangan(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const judul = String(formData.get("judul") ?? "").trim();
  const daftarKelasId = bacaKelasDariForm(formData);
  const tanggal = String(formData.get("tanggal") ?? "").trim();
  const accessCode = String(formData.get("access_code") ?? "").trim().toUpperCase();
  const status = String(formData.get("status") ?? "sudah").trim();
  const tenggat = String(formData.get("tenggat") ?? "").trim();
  const durasiRaw = String(formData.get("durasi") ?? "").trim();
  // nilai_ditampilkan: checkbox "tampilkan_nilai". Unchecked = false, checked = true.
  const nilaiDitampilkan = formData.get("tampilkan_nilai") !== null;

  if (!judul) {
    return { message: "Judul ulangan wajib diisi." };
  }

  if (judul.length > MAX_JUDUL) {
    return { message: `Judul maksimal ${MAX_JUDUL} karakter.` };
  }

  if (accessCode.length > MAX_KODE) {
    return { message: `Kode akses maksimal ${MAX_KODE} karakter.` };
  }

  const statusValid = status === "akan" ? "akan" : "sudah";
  // Tenggat hanya relevan untuk "akan"
  const tenggatValue =
    statusValid === "akan" && tenggat
      ? new Date(tenggat).toISOString()
      : null;

  // Durasi (menit) — validasi 0–9999
  let durasiValue: number | null = null;
  if (durasiRaw) {
    const parsed = Number(durasiRaw);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 9999) {
      return {
        message:
          "Durasi harus angka lebih dari 0 (dalam menit), maksimal 9999 menit.",
      };
    }
    durasiValue = Math.floor(parsed);
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("exams")
    .insert({
      judul,
      // Kolom lama tetap diisi kelas pertama (atau null) supaya data
      // lama yang dibaca dari exams.kelas_id masih bekerja.
      kelas_id: daftarKelasId.length === 1 ? daftarKelasId[0] : null,
      tanggal: tanggal ? tanggal : null,
      access_code: accessCode ? accessCode : null,
      status: statusValid,
      tenggat: tenggatValue,
      durasi: statusValid === "akan" ? durasiValue : null,
      nilai_ditampilkan: statusValid === "akan" ? nilaiDitampilkan : true,
    })
    .select("id")
    .single();

  if (error) {
    return { message: `Gagal menambah ulangan: ${error.message}` };
  }

  try {
    await simpanKelasUlangan(supabase, data.id, daftarKelasId);
  } catch {
    // Rollback sederhana: ulangan baru dihapus juga kalau hubungannya gagal
    await supabase.from("exams").delete().eq("id", data.id);
    return {
      message:
        "Ulangan tersimpan, tapi gagal mengatur kelasnya. " +
        "Jalankan dulu bagian DDL terbaru di Supabase SQL Editor.",
    };
  }

  revalidatePath("/guru/ulangan");
  return { message: null };
}

// Tandai ulangan "selesai dinilai" — nilai terbuka untuk semua siswa.
// Field: exam_id
export async function selesaiDinilai(formData: FormData) {
  const examId = String(formData.get("exam_id") ?? "");
  if (!examId) return;

  const supabase = await requireGuru();
  const { error } = await supabase
    .from("exams")
    .update({ nilai_selesai: true })
    .eq("id", examId);

  if (error) {
    console.error("Gagal menandai selesai dinilai:", error.message);
  }

  revalidatePath(`/guru/ulangan/${examId}/soal`);
  revalidatePath(`/siswa/nilai/${examId}`);
  revalidatePath("/siswa/nilai");
}

// Batalkan "selesai dinilai" (jika guru ingin menahan nilai lagi).
// Field: exam_id
export async function batalkanSelesaiDinilai(formData: FormData) {
  const examId = String(formData.get("exam_id") ?? "");
  if (!examId) return;

  const supabase = await requireGuru();
  const { error } = await supabase
    .from("exams")
    .update({ nilai_selesai: false })
    .eq("id", examId);

  if (error) {
    console.error("Gagal membatalkan selesai dinilai:", error.message);
  }

  revalidatePath(`/guru/ulangan/${examId}/soal`);
  revalidatePath(`/siswa/nilai/${examId}`);
  revalidatePath("/siswa/nilai");
}

export async function updateUlangan(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const id = String(formData.get("id") ?? "");
  const judul = String(formData.get("judul") ?? "").trim();
  const daftarKelasId = bacaKelasDariForm(formData);
  const tanggal = String(formData.get("tanggal") ?? "").trim();
  const accessCode = String(formData.get("access_code") ?? "").trim().toUpperCase();
  const status = String(formData.get("status") ?? "sudah").trim();
  const tenggat = String(formData.get("tenggat") ?? "").trim();
  const durasiRaw = String(formData.get("durasi") ?? "").trim();
  const nilaiDitampilkan = formData.get("tampilkan_nilai") !== null;

  if (!id) {
    return { message: "Data ulangan tidak ditemukan." };
  }

  if (!judul) {
    return { message: "Judul ulangan wajib diisi." };
  }

  if (judul.length > MAX_JUDUL) {
    return { message: `Judul maksimal ${MAX_JUDUL} karakter.` };
  }

  if (accessCode.length > MAX_KODE) {
    return { message: `Kode akses maksimal ${MAX_KODE} karakter.` };
  }

  const statusValid = status === "akan" ? "akan" : "sudah";
  const tenggatValue =
    statusValid === "akan" && tenggat
      ? new Date(tenggat).toISOString()
      : null;

  let durasiValue: number | null = null;
  if (durasiRaw) {
    const parsed = Number(durasiRaw);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 9999) {
      return {
        message:
          "Durasi harus angka lebih dari 0 (dalam menit), maksimal 9999 menit.",
      };
    }
    durasiValue = Math.floor(parsed);
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("exams")
    .update({
      judul,
      // Kolom lama tetap diisi kelas pertama (atau null) untuk
      // kompatibilitas pembacaan data lama.
      kelas_id: daftarKelasId.length === 1 ? daftarKelasId[0] : null,
      tanggal: tanggal ? tanggal : null,
      access_code: accessCode ? accessCode : null,
      status: statusValid,
      tenggat: tenggatValue,
      durasi: statusValid === "akan" ? durasiValue : null,
      nilai_ditampilkan: statusValid === "akan" ? nilaiDitampilkan : true,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { message: `Gagal mengubah ulangan: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return {
      message:
        "Gagal mengubah ulangan. Jalankan lagi schema.sql supaya izin update aktif.",
    };
  }

  try {
    await simpanKelasUlangan(supabase, id, daftarKelasId);
  } catch {
    return {
      message:
        "Judul dan data ulangan sudah tersimpan, tapi gagal mengatur kelasnya. " +
        "Jalankan dulu bagian DDL terbaru di Supabase SQL Editor.",
    };
  }

  revalidatePath("/guru/ulangan");
  return { message: null };
}

export async function deleteUlangan(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();
  const { error } = await supabase.from("exams").delete().eq("id", id);

  if (error) {
    console.error("Gagal menghapus ulangan:", error.message);
  }

  revalidatePath("/guru/ulangan");
}

// Membalik status buka/tutup ulangan. `dibuka=false` berarti ulangan
// ditutup oleh guru: siswa tidak bisa mengerjakan soal (status "akan")
// atau melihat detail nilai. `dibuka=true` (default) = terbuka.
export async function toggleUlangan(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();

  // Ambil nilai saat ini lalu balikkan.
  const { data, error } = await supabase
    .from("exams")
    .select("dibuka")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("Gagal membaca status ulangan:", error.message);
    }
    return;
  }

  const dibukaSekarang = data.dibuka !== false; // null aman → anggap dibuka
  const { error: galatUpdate } = await supabase
    .from("exams")
    .update({ dibuka: !dibukaSekarang })
    .eq("id", id);

  if (galatUpdate) {
    console.error("Gagal membalik status ulangan:", galatUpdate.message);
  }

  revalidatePath("/guru/ulangan");
  revalidatePath(`/guru/ulangan/${id}/soal`);
  revalidatePath(`/siswa/nilai/${id}`);
  revalidatePath("/siswa/nilai");
  revalidatePath("/siswa");
}

// Menyimpan nilai semua siswa sekaligus untuk satu ulangan.
// Input form bernama `nilai_{siswaId}`. Siswa yang inputnya kosong
// dianggap belum dinilai — baris lamanya dihapus kalau tadinya ada.
export async function simpanNilaiBatch(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const examId = String(formData.get("exam_id") ?? "");

  if (!examId) {
    return { message: "Ulangan tidak ditemukan." };
  }

  const { daftar, galat } = bacaNilaiDariForm(formData);

  if (galat) {
    return { message: galat };
  }

  const supabase = await requireGuru();

  // 1) Hapus semua nilai lama ulangan ini (nilai yang dikosongkan
  //    di form berarti "belum dinilai" lagi).
  const { error: galatHapus } = await supabase
    .from("exam_scores")
    .delete()
    .eq("exam_id", examId);

  if (galatHapus) {
    return { message: `Gagal menghapus nilai lama: ${galatHapus.message}` };
  }

  // 2) Sisipkan nilai yang terisi.
  if (daftar.length > 0) {
    const { error: galatSisip } = await supabase
      .from("exam_scores")
      .insert(
        daftar.map((item) => ({
          exam_id: examId,
          siswa_id: item.siswaId,
          nilai: item.nilai,
        })),
      );

    if (galatSisip) {
      return { message: `Gagal menyimpan nilai: ${galatSisip.message}` };
    }
  }

  revalidatePath("/guru/ulangan");
  revalidatePath(`/guru/ulangan/${examId}/nilai`);
  return { message: null };
}

// ======================================================================
// Import nilai dari Excel (isi form, belum disimpan ke DB)
// ======================================================================

// Satu baris pratinjau hasil import.
export type BarisPratinjauNilai = {
  // NIS dari file
  nis: string;
  // Nama dari file (untuk verifikasi visual)
  namaFile: string;
  // Nilai dari file
  nilai: number;
  // status: "ok" = NIS terdaftar & nilai valid, "salah" = ada masalah
  status: "ok" | "salah";
  // Alasan kalau status salah (misal NIS tidak terdaftar)
  alasan: string | null;
  // SiswaId DB kalau ok (untuk mengisi form)
  siswaId: string | null;
};

export type HasilImportNilaiExcel = {
  message: string | null;
  // Baris pratinjau (semua baris dari file, status per baris)
  daftar: BarisPratinjauNilai[];
  // Petakan nilai OK saja: siswaId → nilai (untuk mengisi form saat simpan)
  nilaiOk: Map<string, number> | null;
};

export async function importNilaiExcel(
  _prevState: HasilImportNilaiExcel,
  formData: FormData,
): Promise<HasilImportNilaiExcel> {
  const examId = String(formData.get("exam_id") ?? "");

  if (!examId) {
    return { message: "Ulangan tidak ditemukan.", daftar: [], nilaiOk: null };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { message: "Pilih file Excel (.xlsx) dulu.", daftar: [], nilaiOk: null };
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      message: "File harus format .xlsx. Unduh template dan isi nilainya.",
      daftar: [],
      nilaiOk: null,
    };
  }

  const supabase = await requireGuru();

  // 1) Ambil ulangan + kelasnya (gabungan: kolom lama + relasi baru)
  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select("id, kelas_id, exam_classes(kelas_id)")
    .eq("id", examId)
    .maybeSingle();

  if (galatUlangan || !ulangan) {
    return { message: "Ulangan tidak ditemukan.", daftar: [], nilaiOk: null };
  }

  const daftarKelasId = ambilKelasUlangan(
    ulangan as {
      kelas_id: string | null;
      exam_classes: { kelas_id: string }[];
    },
  );
  if (daftarKelasId.length === 0) {
    return {
      message:
        "Ulangan ini berlaku untuk semua kelas, jadi import per kelas tidak bisa memastikan NIS terdaftar. Import langsung dari halaman input nilai.",
      daftar: [],
      nilaiOk: null,
    };
  }

  // 2) Ambil daftar siswa kelas (NIS + id) untuk matching
  const { data: siswaData, error: galatSiswa } = await supabase
    .from("students")
    .select("id, nis")
    .in("kelas_id", daftarKelasId);

  if (galatSiswa) {
    return {
      message: `Gagal memuat daftar siswa kelas: ${galatSiswa.message}`,
      daftar: [],
      nilaiOk: null,
    };
  }

  // Map: NIS → siswaId. NIS kosong/missing di siswa diabaikan.
  const mapNISKeSiswaId = new Map<string, string>();
  for (const siswa of siswaData ?? []) {
    const nis = (siswa as { nis: string | null }).nis?.trim();
    if (nis) {
      mapNISKeSiswaId.set(nis, (siswa as { id: string }).id);
    }
  }

  // 3) Baca file Excel
  const buffer = Buffer.from(await file.arrayBuffer());
  const hasilParse = await parseNilaiExcel(buffer);

  if (hasilParse.galat) {
    return { message: hasilParse.galat, daftar: [], nilaiOk: null };
  }

  // 4) Tandai baris: NIS terdaftar di kelas? Hasilkan pratinjau per baris.
  const daftar: BarisPratinjauNilai[] = [];
  const nilaiOk = new Map<string, number>();

  for (const baris of hasilParse.daftar) {
    if (baris.status === "salah") {
      daftar.push({
        nis: baris.nis,
        namaFile: baris.nama,
        nilai: baris.nilai,
        status: "salah",
        alasan: baris.alasan,
        siswaId: null,
      });
      continue;
    }

    const siswaId = mapNISKeSiswaId.get(baris.nis) ?? null;

    if (!siswaId) {
      daftar.push({
        nis: baris.nis,
        namaFile: baris.nama,
        nilai: baris.nilai,
        status: "salah",
        alasan: "NIS tidak terdaftar di kelas ini",
        siswaId: null,
      });
      continue;
    }

    daftar.push({
      nis: baris.nis,
      namaFile: baris.nama,
      nilai: baris.nilai,
      status: "ok",
      alasan: null,
      siswaId,
    });
    nilaiOk.set(siswaId, baris.nilai);
  }

  // Pesan ringkas: berapa baris ok, berapa salah
  const jumlahOk = daftar.filter((b) => b.status === "ok").length;
  const jumlahSalah = daftar.length - jumlahOk;

  let message: string | null = null;
  if (jumlahOk === 0) {
    message =
      "Tidak ada baris valid di file. Perbaiki NIS / nilai lalu import ulang.";
  } else if (jumlahSalah > 0) {
    message = `${jumlahOk} baris valid, ${jumlahSalah} baris bermasalah (lihat pratinjau).`;
  }

  return {
    message,
    daftar,
    nilaiOk: daftar.some((b) => b.status === "ok") ? nilaiOk : null,
  };
}

// ======================================================================
// CRUD Soal Ulangan
// ======================================================================

const MAX_SOAL = 5000;

export async function addQuestion(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const examId = String(formData.get("exam_id") ?? "");
  const soal = String(formData.get("soal") ?? "").trim();
  const jenis = String(formData.get("jenis") ?? "").trim();
  const poin = Number(formData.get("poin") ?? 0);
  const urutan = Number(formData.get("urutan") ?? 0);

  // Pilihan PG: baca input bernama `pilihan_0`, `pilihan_1`, dst.
  const pilihanA = String(formData.get("pilihan_0") ?? "").trim();
  const pilihanB = String(formData.get("pilihan_1") ?? "").trim();
  const pilihanC = String(formData.get("pilihan_2") ?? "").trim();
  const pilihanD = String(formData.get("pilihan_3") ?? "").trim();
  const kunci = String(formData.get("kunci") ?? "").trim().toUpperCase();

  if (!examId) {
    return { message: "Ulangan tidak ditemukan." };
  }

  if (!soal) {
    return { message: "Soal wajib diisi." };
  }

  if (soal.length > MAX_SOAL) {
    return { message: `Soal maksimal ${MAX_SOAL} karakter.` };
  }

  if (jenis !== "pg" && jenis !== "esai") {
    return { message: "Jenis soal tidak valid." };
  }

  if (poin < 0 || poin > 1000) {
    return { message: "Poin harus antara 0 dan 1000." };
  }

  const supabase = await requireGuru();

  // Untuk PG: simpan pilihan non-kosong saja
  let daftarPilihan: string[] | null = null;
  let kunciSimpan: string | null = null;

  if (jenis === "pg") {
    const opsiRaw = [pilihanA, pilihanB, pilihanC, pilihanD];
    // Tandai opsi yang non-kosong
    const opsiTerisi = opsiRaw
      .map((opsi, i) => ({ opsi, label: String.fromCharCode(65 + i) }))
      .filter(({ opsi }) => opsi);

    if (opsiTerisi.length < 2) {
      return { message: "Pilihan ganda minimal 2 opsi terisi." };
    }

    // Kunci harus sesuai salah satu label opsi yang terisi
    if (!opsiTerisi.some(({ label }) => label === kunci)) {
      return {
        message: `Kunci harus salah satu dari opsi yang terisi (${opsiTerisi
          .map(({ label }) => label)
          .join(", ")}).`,
      };
    }

    daftarPilihan = opsiTerisi.map(({ opsi, label }) => `${label}. ${opsi}`);
    kunciSimpan = kunci;
  }

  const { error } = await supabase.from("exam_questions").insert({
    exam_id: examId,
    soal,
    jenis,
    pilihan: daftarPilihan,
    kunci: kunciSimpan,
    poin,
    urutan,
  });

  if (error) {
    return { message: `Gagal menambah soal: ${error.message}` };
  }

  revalidatePath(`/guru/ulangan/${examId}/soal`);
  return { message: null };
}

export async function deleteQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const examId = String(formData.get("exam_id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();
  await supabase.from("exam_questions").delete().eq("id", id);

  revalidatePath(`/guru/ulangan/${examId}/soal`);
}

// Simpan penilaian esai: nilai esai per soal (field `nilai_esai_{soalId}`),
// update nilai_esai (total) + nilai_total di exam_submissions, dan
// simpan nilai per soal di tabel `exam_essay_scores` (DDL Tahap 13).
// Kalau DDL Tahap 13 belum dijalankan, gagal simpan per soal ditangani
// diam-diam — nilai total tetap tersinkron ke exam_scores.
export async function simpanNilaiEsai(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const examId = String(formData.get("exam_id") ?? "");
  const siswaId = String(formData.get("siswa_id") ?? "");

  if (!examId || !siswaId) {
    return { message: "Data tidak lengkap." };
  }

  // Kumpulkan semua input nilai esai per soal: `nilai_esai_{soalId}`.
  const daftarNilaiEsai: { soalId: string; nilai: number }[] = [];
  let totalEsai = 0;

  for (const [nama, nilaiRaw] of formData.entries()) {
    if (!nama.startsWith("nilai_esai_")) continue;
    const soalId = nama.replace("nilai_esai_", "");
    const nilai = Number(nilaiRaw ?? 0);
    const nilaiValid = Number.isFinite(nilai) ? Math.max(0, Math.min(100, Math.floor(nilai))) : 0;
    daftarNilaiEsai.push({ soalId, nilai: nilaiValid });
    totalEsai += nilaiValid;
  }

  // Kalau tidak ada input per soal sama sekali (mis. ulangan tanpa esai,
  // atau field lama), tetap jalankan dengan total 0 supaya nilai_total sinkron.
  const supabase = await requireGuru();

  // Ambil nilai PG dari submit
  const { data: submit, error: galatSubmit } = await supabase
    .from("exam_submissions")
    .select("nilai_pg, nilai_esai, nilai_total")
    .eq("exam_id", examId)
    .eq("siswa_id", siswaId)
    .maybeSingle();

  if (galatSubmit || !submit) {
    return { message: "Submit siswa ini tidak ditemukan." };
  }

  const nilaiPG = (submit as { nilai_pg: number }).nilai_pg;
  const nilaiTotal = nilaiPG + totalEsai;

  // Update exam_submissions
  const { error: galatUpdate } = await supabase
    .from("exam_submissions")
    .update({ nilai_esai: totalEsai, nilai_total: nilaiTotal })
    .eq("exam_id", examId)
    .eq("siswa_id", siswaId);

  if (galatUpdate) {
    return { message: `Gagal menyimpan penilaian esai: ${galatUpdate.message}` };
  }

  // Simpan nilai esai per soal (hapus lama, insert baru). Gagal diam-diam
  // kalau tabel `exam_essay_scores` belum ada (DDL Tahap 13 belum dijalankan).
  if (daftarNilaiEsai.length > 0) {
    const { error: galatHapus } = await supabase
      .from("exam_essay_scores")
      .delete()
      .eq("exam_id", examId)
      .eq("siswa_id", siswaId);

    if (!galatHapus) {
      const { error: galatInsert } = await supabase
        .from("exam_essay_scores")
        .insert(
          daftarNilaiEsai.map((n) => ({
            exam_id: examId,
            siswa_id: siswaId,
            soal_id: n.soalId,
            nilai: n.nilai,
          })),
        );

      if (galatInsert) {
        console.error(
          "Gagal menyimpan nilai esai per soal:",
          galatInsert.message,
        );
      }
    }
  }

  // Sinkronkan ke exam_scores
  const { error: galatScores } = await supabase
    .from("exam_scores")
    .upsert(
      [{ exam_id: examId, siswa_id: siswaId, nilai: nilaiTotal }],
      { onConflict: "exam_id,siswa_id" },
    );

  if (galatScores) {
    console.error("Gagal sinkronkan exam_scores:", galatScores.message);
  }

  revalidatePath(`/guru/ulangan/${examId}/soal`);
  revalidatePath(`/guru/ulangan/${examId}/nilai`);
  revalidatePath("/guru/ulangan");
  return { message: null };
}

