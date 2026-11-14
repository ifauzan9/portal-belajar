"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { bacaKelasDariForm } from "@/lib/pilih-kelas";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { bacaNilaiDariForm, parseNilaiExcel } from "@/lib/parse-nilai";
import { parseInputLokalWib } from "@/lib/waktu";

const MAX_JUDUL = 200;
const MAX_KODE = 50;

// Membaca daftar kelas dari form: pilihan di `PilihKelasMulti` dikirim
// sebagai input bernama "kelas[]" (bisa beberapa). [] = "semua kelas".

// Simpan hubungan kelas untuk satu ulangan. Kosong = hapus semua
// (berlaku untuk semua kelas), mirip pola pengumuman.
//
// Tidak memakai upsert biasa: tabel exam_classes hanya punya policy
// insert/delete untuk guru, tanpa policy update. Upsert pada baris
// yang sudah ada akan memicu UPDATE dan ditolak RLS. Jadi: tambahkan
// baris baru dengan "abaikan duplikat", lalu hapus baris yang tidak
// dipilih lagi. Urutan ini juga membuat hubungan lama tetap utuh
// kalau penambahan baris baru gagal.
async function simpanKelasUlangan(
  supabase: Awaited<ReturnType<typeof requireGuru>>,
  ulanganId: string,
  daftarKelasId: string[],
) {
  const unik = Array.from(new Set(daftarKelasId));

  if (unik.length > 0) {
    const { error } = await supabase.from("exam_classes").upsert(
      unik.map((kelasId) => ({
        ulangan_id: ulanganId,
        kelas_id: kelasId,
      })),
      { onConflict: "ulangan_id,kelas_id", ignoreDuplicates: true },
    );

    if (error) {
      throw new Error(`gagal menyimpan hubungan kelas: ${error.message}`);
    }
  }

  // Hapus hubungan yang tidak dipilih lagi (atau semuanya kalau
  // pilihan kosong = berlaku untuk semua kelas).
  const kueri = supabase
    .from("exam_classes")
    .delete()
    .eq("ulangan_id", ulanganId);

  const { error: galatHapus } =
    unik.length > 0
      ? await kueri.not("kelas_id", "in", `(${unik.join(",")})`)
      : await kueri;

  if (galatHapus) {
    throw new Error(`gagal menghapus hubungan kelas: ${galatHapus.message}`);
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
  // bagikan_nilai: checkbox "bagikan_nilai". Unchecked = false (nilai
  // disembunyikan dari siswa), checked = true (siswa boleh melihat nilai).
  const bagikanNilai = formData.get("bagikan_nilai") !== null;

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
  // Tenggat hanya relevan untuk "akan". Input dibaca sebagai jam WIB.
  const tenggatValue =
    statusValid === "akan" && tenggat ? parseInputLokalWib(tenggat) : null;

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
      bagikan_nilai: bagikanNilai,
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

// Membalik saklar "bagikan nilai" per ulangan.
// Field: id (exam id)
//   false → true = nilai mulai terlihat oleh siswa
//   true → false = nilai ditarik/disembunyikan lagi
export async function toggleBagikanNilai(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();

  const { data, error } = await supabase
    .from("exams")
    .select("bagikan_nilai")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("Gagal membaca status bagikan_nilai:", error.message);
    }
    return;
  }

  const dibagikanSekarang = data.bagikan_nilai === true;
  const { error: galatUpdate } = await supabase
    .from("exams")
    .update({ bagikan_nilai: !dibagikanSekarang })
    .eq("id", id);

  if (galatUpdate) {
    console.error("Gagal membalik bagikan_nilai:", galatUpdate.message);
    return;
  }

  revalidatePath("/guru/ulangan");
  revalidatePath(`/guru/ulangan/${id}/nilai`);
  revalidatePath(`/guru/ulangan/${id}/soal`);
  revalidatePath("/siswa");
  revalidatePath("/siswa/nilai");
  revalidatePath(`/siswa/nilai/${id}`);
  revalidatePath("/siswa/ulangan");
  revalidatePath(`/siswa/ulangan/${id}`);
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
  const bagikanNilai = formData.get("bagikan_nilai") !== null;

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
    statusValid === "akan" && tenggat ? parseInputLokalWib(tenggat) : null;

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
      bagikan_nilai: bagikanNilai,
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
  } catch (galatKelas) {
    console.error("Gagal mengatur kelas ulangan:", galatKelas);
    const alasan =
      galatKelas instanceof Error ? ` (${galatKelas.message})` : "";
    return {
      message:
        "Judul dan data ulangan sudah tersimpan, tapi gagal mengatur kelasnya. " +
        "Coba pilih ulang kelas lalu simpan lagi." +
        alasan,
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

// Membalik saklar blokir paste/drop di editor kode ulangan.
// `blokir_tempel=true` → siswa tidak bisa menempel/men-drop kode ke editor.
// `false` (default) → copy-paste seperti biasa.
// Kalau kolom Tahap 39 belum ada, update akan gagal dan hanya dicatat di log;
// halaman guru tetap tampil dengan status "nonaktif".
export async function toggleBlokirTempelUlangan(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();

  const { data, error } = await supabase
    .from("exams")
    .select("blokir_tempel")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca status blokir_tempel:", error.message);
    return;
  }

  const blokirSekarang = data?.blokir_tempel === true;
  const { error: galatUpdate } = await supabase
    .from("exams")
    .update({ blokir_tempel: !blokirSekarang })
    .eq("id", id);

  if (galatUpdate) {
    console.error("Gagal membalik status blokir_tempel:", galatUpdate.message);
    return;
  }

  revalidatePath("/guru/ulangan");
  revalidatePath(`/guru/ulangan/${id}/soal`);
  revalidatePath(`/siswa/ulangan/${id}`);
}

// Menyimpan nilai siswa untuk satu ulangan.
// Input form bernama `nilai_{siswaId}`. Siswa yang inputnya kosong
// dianggap belum dinilai — baris lamanya dihapus kalau tadinya ada.
// Form mengirim hidden `kelas_id` (filter aktif) supaya menyimpan satu
// kelas tidak menghapus nilai kelas lain. Kosong = semua kelas.
export async function simpanNilaiBatch(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const examId = String(formData.get("exam_id") ?? "");

  if (!examId) {
    return { message: "Ulangan tidak ditemukan." };
  }

  const kelasId = String(formData.get("kelas_id") ?? "");
  const { daftar, galat } = bacaNilaiDariForm(formData);

  if (galat) {
    return { message: galat };
  }

  const supabase = await requireGuru();

  // Validasi kelas filter terhadap kelas sasaran ulangan.
  const { data: ulangan, error: galatUlangan } = await supabase
    .from("exams")
    .select("id, kelas_id, exam_classes(kelas_id)")
    .eq("id", examId)
    .maybeSingle();

  if (galatUlangan || !ulangan) {
    return { message: "Ulangan tidak ditemukan." };
  }

  const daftarKelasId = ambilKelasUlangan(
    ulangan as {
      kelas_id: string | null;
      exam_classes: { kelas_id: string }[];
    },
  );

  if (kelasId === "tanpa" && daftarKelasId.length > 0) {
    return {
      message: "Kelas 'Belum ada kelas' tidak termasuk ulangan ini.",
    };
  }
  if (
    kelasId &&
    kelasId !== "tanpa" &&
    daftarKelasId.length > 0 &&
    !daftarKelasId.includes(kelasId)
  ) {
    return { message: "Kelas yang dipilih tidak termasuk ulangan ini." };
  }

  // Tentukan siswa yang nilainya diganti:
  //   null = semua kelas (hapus semua nilai ulangan ini)
  //   []   = kelas kosong (tidak ada yang dihapus)
  let siswaIds: string[] | null = null;

  if (kelasId === "tanpa") {
    const { data: siswa, error: galatSiswa } = await supabase
      .from("students")
      .select("id")
      .is("kelas_id", null);

    if (galatSiswa) {
      return { message: `Gagal memuat siswa: ${galatSiswa.message}` };
    }
    siswaIds = (siswa ?? []).map((row) => row.id);
  } else if (kelasId) {
    const { data: siswa, error: galatSiswa } = await supabase
      .from("students")
      .select("id")
      .eq("kelas_id", kelasId);

    if (galatSiswa) {
      return { message: `Gagal memuat siswa: ${galatSiswa.message}` };
    }
    siswaIds = (siswa ?? []).map((row) => row.id);
  }

  // 1) Hapus nilai lama. Nilai yang dikosongkan di form berarti
  //    "belum dinilai" lagi.
  let galatHapus: { message: string } | null = null;

  if (siswaIds === null) {
    const { error } = await supabase
      .from("exam_scores")
      .delete()
      .eq("exam_id", examId);
    galatHapus = error;
  } else if (siswaIds.length > 0) {
    const { error } = await supabase
      .from("exam_scores")
      .delete()
      .eq("exam_id", examId)
      .in("siswa_id", siswaIds);
    galatHapus = error;
  }

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

  // Filter kelas dari halaman nilai. Kalau ada, import hanya mencocokkan
  // siswa di kelas itu supaya nilai tidak masuk ke kelas yang tidak
  // sedang ditampilkan.
  const kelasDiminta = String(formData.get("kelas_id") ?? "");
  let kelasImport = "";

  if (kelasDiminta === "tanpa") {
    if (daftarKelasId.length > 0) {
      return {
        message: "Kelas 'Belum ada kelas' tidak termasuk ulangan ini.",
        daftar: [],
        nilaiOk: null,
      };
    }
    kelasImport = "tanpa";
  } else if (kelasDiminta) {
    if (
      daftarKelasId.length > 0 &&
      !daftarKelasId.includes(kelasDiminta)
    ) {
      return {
        message: "Kelas yang dipilih tidak termasuk ulangan ini.",
        daftar: [],
        nilaiOk: null,
      };
    }
    kelasImport = kelasDiminta;
  }

  if (daftarKelasId.length === 0 && !kelasImport) {
    return {
      message:
        "Ulangan ini berlaku untuk semua kelas. Pilih kelas pada filter di atas halaman, lalu import ulang.",
      daftar: [],
      nilaiOk: null,
    };
  }

  // 2) Ambil daftar siswa kelas (NIS + id) untuk matching
  let siswaQuery = supabase.from("students").select("id, nis");

  if (kelasImport === "tanpa") {
    siswaQuery = siswaQuery.is("kelas_id", null);
  } else if (kelasImport) {
    siswaQuery = siswaQuery.eq("kelas_id", kelasImport);
  } else {
    siswaQuery = siswaQuery.in("kelas_id", daftarKelasId);
  }

  const { data: siswaData, error: galatSiswa } = await siswaQuery;

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

  if (jenis !== "pg" && jenis !== "esai" && jenis !== "kode") {
    return { message: "Jenis soal tidak valid." };
  }

  if (poin < 0 || poin > 1000) {
    return { message: "Poin harus antara 0 dan 1000." };
  }

  // Kolom khusus soal kode.
  const kodeAwal = String(formData.get("kode_awal") ?? "");
  // Referensi kode jawaban asli (hanya untuk guru).
  const jawabanAsli = String(formData.get("jawaban_asli") ?? "");
  const keluaranDiharapkan = String(
    formData.get("keluaran_diharapkan") ?? "",
  ).trim();
  const masukan = String(formData.get("masukan") ?? "").trim();
  const masukanUji = String(formData.get("masukan_uji") ?? "").trim();
  const keluaranUji = String(formData.get("keluaran_uji") ?? "").trim();
  const variabelWajib = String(formData.get("variabel_wajib") ?? "")
    .split(",")
    .map((nama) => nama.trim())
    .filter(Boolean);
  const minInput = Math.max(
    0,
    Math.floor(Number(formData.get("min_input") ?? 0) || 0),
  );
  const minPrint = Math.max(
    0,
    Math.floor(Number(formData.get("min_print") ?? 0) || 0),
  );

  if (jenis === "kode" && !keluaranDiharapkan) {
    return { message: "Target output utama wajib diisi untuk soal kode." };
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

  const dataDasar = {
    exam_id: examId,
    soal,
    jenis,
    pilihan: daftarPilihan,
    kunci: kunciSimpan,
    poin,
    urutan,
  };

  const dataLengkap = {
    ...dataDasar,
    kode_awal: jenis === "kode" ? kodeAwal : null,
    keluaran_diharapkan: jenis === "kode" ? keluaranDiharapkan : null,
    masukan: jenis === "kode" ? masukan : null,
    masukan_uji: jenis === "kode" ? masukanUji : null,
    keluaran_uji: jenis === "kode" ? keluaranUji : null,
    aturan:
      jenis === "kode"
        ? {
            variabel_wajib: variabelWajib,
            dari_input: true,
            min_input: minInput,
            min_print: minPrint,
            bobot: {
              output: 50,
              output_uji: 20,
              variabel: 20,
              jumlah: 10,
            },
          }
        : null,
  };

  // `jawaban_asli` baru ada setelah Tahap 36. Untuk soal kode, coba simpan
  // bersama kolom lain; kalau kolomnya belum ada, soal tetap disimpan tanpa
  // jawaban asli dan guru diberi tahu.
  const dataDenganJawabanAsli =
    jenis === "kode"
      ? {
          ...dataLengkap,
          jawaban_asli: jawabanAsli.trim() ? jawabanAsli : null,
        }
      : dataLengkap;

  const hasilInsert = await supabase
    .from("exam_questions")
    .insert(dataDenganJawabanAsli);

  if (hasilInsert.error) {
    if (jenis === "kode") {
      const fallback = await supabase
        .from("exam_questions")
        .insert(dataLengkap);

      if (fallback.error) {
        return {
          message: `Gagal menambah soal kode: ${fallback.error.message}. Pastikan SQL Tahap 33 dan Tahap 36 sudah dijalankan.`,
        };
      }

      revalidatePath(`/guru/ulangan/${examId}/soal`);
      return {
        message:
          "Soal kode tersimpan, tetapi kode jawaban asli belum tersimpan. Jalankan SQL Tahap 36 agar kolom jawaban asli aktif.",
      };
    }

    // Soal lama tetap bisa ditambah walau DDL Tahap 33 belum dijalankan.
    const fallback = await supabase
      .from("exam_questions")
      .insert(dataDasar);
    if (fallback.error) {
      return { message: `Gagal menambah soal: ${fallback.error.message}` };
    }
  }

  revalidatePath(`/guru/ulangan/${examId}/soal`);
  return { message: null };
}

// Simpan kode jawaban asli/referensi untuk soal kode yang sudah ada.
// Dipakai oleh form di halaman Kelola Soal.
export async function simpanJawabanAsliSoal(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const examId = String(formData.get("exam_id") ?? "");
  const soalId = String(formData.get("soal_id") ?? "");
  const jawabanAsli = String(formData.get("jawaban_asli") ?? "");

  if (!examId || !soalId) {
    return { message: "Soal tidak ditemukan." };
  }

  const supabase = await requireGuru();
  const { error } = await supabase
    .from("exam_questions")
    .update({ jawaban_asli: jawabanAsli.trim() ? jawabanAsli : null })
    .eq("id", soalId)
    .eq("exam_id", examId)
    .eq("jenis", "kode");

  if (error) {
    return {
      message: `Gagal menyimpan kode jawaban asli: ${error.message}. Pastikan SQL Tahap 36 sudah dijalankan.`,
    };
  }

  revalidatePath(`/guru/ulangan/${examId}/soal`);
  revalidatePath(`/guru/ulangan/${examId}/nilai`);
  return { message: "Kode jawaban asli tersimpan." };
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

  // Ambil nilai PG + kode dari submit
  const hasilSubmit = await supabase
    .from("exam_submissions")
    .select("nilai_pg, nilai_esai, nilai_total, nilai_kode, nilai_kode_manual")
    .eq("exam_id", examId)
    .eq("siswa_id", siswaId)
    .maybeSingle();

  let submit: unknown = hasilSubmit.data;
  let galatSubmit: { message: string } | null = hasilSubmit.error;

  // Fallback kalau DDL Tahap 33 belum dijalankan.
  if (galatSubmit) {
    const fallback = await supabase
      .from("exam_submissions")
      .select("nilai_pg, nilai_esai, nilai_total")
      .eq("exam_id", examId)
      .eq("siswa_id", siswaId)
      .maybeSingle();
    submit = fallback.data;
    galatSubmit = fallback.error;
  }

  if (galatSubmit || !submit) {
    return { message: "Submit siswa ini tidak ditemukan." };
  }

  const dataSubmit = submit as {
    nilai_pg: number;
    nilai_esai: number;
    nilai_total: number;
    nilai_kode?: number | null;
    nilai_kode_manual?: number | null;
  };

  const nilaiPG = dataSubmit.nilai_pg;
  // Nilai kode manual (kalau guru menimpa) menggantikan nilai otomatis.
  const nilaiKode =
    dataSubmit.nilai_kode_manual ?? dataSubmit.nilai_kode ?? 0;
  const nilaiTotal = nilaiPG + totalEsai + nilaiKode;

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

  // Nilai esai sudah masuk ke exam_submissions, tetapi exam_scores gagal
  // disinkronkan. Jangan diamkan: beri tahu guru supaya bisa mencoba lagi.
  return {
    message: galatScores
      ? `Nilai esai tersimpan, tetapi sinkronisasi nilai siswa gagal: ${galatScores.message}`
      : null,
  };
}

// ============================================================================
// Nilai kode manual (hibrida): guru boleh menimpa nilai kode otomatis.
//
// Versi massal dipakai oleh tombol "Simpan Semua Nilai Kode" di halaman
// jawaban siswa. Guru mengetik beberapa nilai sebagai draft di browser, lalu
// satu request menyimpan semuanya. Nilai kosong = kembali ke nilai otomatis.
// Total dihitung ulang = PG + esai + (manual ?? otomatis).
// ============================================================================
export type HasilSimpanNilaiKodeBanyak = {
  message: string | null;
  disimpan: string[];
  gagal: string[];
};

export async function simpanNilaiKodeManualBanyak(input: {
  examId: string;
  items: { siswa_id: string; nilai_kode_manual: string }[];
}): Promise<HasilSimpanNilaiKodeBanyak> {
  const examId = String(input?.examId ?? "").trim();
  const items = Array.isArray(input?.items) ? input.items : [];

  if (!examId || items.length === 0) {
    return {
      message: "Tidak ada nilai kode yang perlu disimpan.",
      disimpan: [],
      gagal: [],
    };
  }

  // Satu siswa hanya boleh muncul sekali. Nilai terakhir yang dipakai.
  const unik = new Map<string, string>();
  for (const item of items.slice(0, 1000)) {
    const siswaId = String(item?.siswa_id ?? "").trim();
    if (!siswaId) continue;
    unik.set(siswaId, String(item?.nilai_kode_manual ?? "").trim());
  }

  if (unik.size === 0) {
    return {
      message: "Tidak ada nilai kode yang perlu disimpan.",
      disimpan: [],
      gagal: [],
    };
  }

  const valid: { siswaId: string; manual: number | null }[] = [];
  const gagal = new Set<string>();

  for (const [siswaId, raw] of unik) {
    if (raw === "") {
      valid.push({ siswaId, manual: null });
      continue;
    }

    const angka = Number(raw);
    if (!Number.isFinite(angka)) {
      gagal.add(siswaId);
      continue;
    }

    valid.push({
      siswaId,
      manual: Math.max(0, Math.min(1000, Math.floor(angka))),
    });
  }

  if (valid.length === 0) {
    return {
      message: "Nilai kode manual harus berupa angka.",
      disimpan: [],
      gagal: [...gagal],
    };
  }

  const supabase = await requireGuru();

  // Ambil semua submit sekaligus supaya perhitungan total konsisten.
  const { data: submits, error: galatSubmits } = await supabase
    .from("exam_submissions")
    .select("siswa_id, nilai_pg, nilai_esai, nilai_kode")
    .eq("exam_id", examId)
    .in(
      "siswa_id",
      valid.map((item) => item.siswaId),
    );

  if (galatSubmits) {
    return {
      message: `Gagal membaca submit siswa: ${galatSubmits.message}`,
      disimpan: [],
      gagal: valid.map((item) => item.siswaId),
    };
  }

  const mapSubmit = new Map<
    string,
    { nilai_pg: number; nilai_esai: number; nilai_kode: number | null }
  >();

  for (const row of (submits ?? []) as {
    siswa_id: string;
    nilai_pg: number | null;
    nilai_esai: number | null;
    nilai_kode: number | null;
  }[]) {
    mapSubmit.set(row.siswa_id, {
      nilai_pg: row.nilai_pg ?? 0,
      nilai_esai: row.nilai_esai ?? 0,
      nilai_kode: row.nilai_kode ?? null,
    });
  }

  const barisSubmits: {
    exam_id: string;
    siswa_id: string;
    nilai_pg: number;
    nilai_esai: number;
    nilai_kode: number;
    nilai_kode_manual: number | null;
    nilai_total: number;
  }[] = [];

  for (const item of valid) {
    const submit = mapSubmit.get(item.siswaId);
    if (!submit) {
      gagal.add(item.siswaId);
      continue;
    }

    const nilaiKode = item.manual ?? submit.nilai_kode ?? 0;
    barisSubmits.push({
      exam_id: examId,
      siswa_id: item.siswaId,
      nilai_pg: submit.nilai_pg,
      nilai_esai: submit.nilai_esai,
      nilai_kode: submit.nilai_kode ?? 0,
      nilai_kode_manual: item.manual,
      nilai_total: submit.nilai_pg + submit.nilai_esai + nilaiKode,
    });
  }

  let disimpan: string[] = [];
  let pesanGagal: string | null = null;
  let pesanSinkron: string | null = null;

  // Satu upsert untuk semua siswa. Semua baris sudah dipastikan ada lewat
  // query di atas, jadi tidak ada submission baru yang tidak sengaja dibuat.
  if (barisSubmits.length > 0) {
    const { error: galatUpsert } = await supabase
      .from("exam_submissions")
      .upsert(barisSubmits, { onConflict: "exam_id,siswa_id" });

    if (galatUpsert) {
      pesanGagal = `Gagal menyimpan nilai kode: ${galatUpsert.message}`;
      console.error("Gagal menyimpan nilai kode massal:", galatUpsert.message);
      for (const baris of barisSubmits) gagal.add(baris.siswa_id);
    } else {
      disimpan = barisSubmits.map((baris) => baris.siswa_id);
    }
  }

  // Sinkronkan semua nilai ke exam_scores dalam satu upsert.
  const idDisimpan = new Set(disimpan);
  const barisScores = barisSubmits
    .filter((baris) => idDisimpan.has(baris.siswa_id))
    .map((baris) => ({
      exam_id: baris.exam_id,
      siswa_id: baris.siswa_id,
      nilai: baris.nilai_total,
    }));

  if (barisScores.length > 0) {
    const { error: galatScores } = await supabase
      .from("exam_scores")
      .upsert(barisScores, { onConflict: "exam_id,siswa_id" });

    if (galatScores) {
      console.error("Gagal sinkronkan exam_scores:", galatScores.message);
      pesanSinkron = `Nilai kode tersimpan, tetapi sinkronisasi nilai siswa gagal: ${galatScores.message}`;
      // Jangan anggap baris ini selesai. Draft dipertahankan di browser
      // supaya guru bisa mencoba simpan lagi setelah masalahnya diperbaiki.
      for (const baris of barisScores) gagal.add(baris.siswa_id);
      disimpan = [];
    }
  }

  if (disimpan.length > 0) {
    revalidatePath(`/guru/ulangan/${examId}/soal`);
    revalidatePath(`/guru/ulangan/${examId}/nilai`);
    revalidatePath(`/siswa/nilai/${examId}`);
    revalidatePath("/siswa/nilai");
    revalidatePath("/guru/ulangan");
  }

  const pesanGabungan = [pesanGagal, pesanSinkron].filter(Boolean).join(" ");

  return {
    message:
      pesanGabungan ||
      (gagal.size > 0 ? `${gagal.size} nilai gagal disimpan.` : null),
    disimpan,
    gagal: [...gagal],
  };
}

