"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { bacaKelasDariForm } from "@/lib/pilih-kelas";
import {
  BUCKET_TUGAS,
  bacaFileDiizinkan,
  bacaMetode,
  metodeMengizinkanFile,
} from "@/lib/tugas";

const MAX_JUDUL = 200;
const MAX_DESKRIPSI = 5000;
const MAX_UMPAN_BALIK = 2000;

export type HasilTugas = { message: string | null; berhasil: boolean };

// Membaca input datetime-local → ISO. Kosong = tanpa tenggat.
function parseTenggat(
  nilai: string,
): { ok: true; iso: string | null } | { ok: false } {
  const teks = nilai.trim();
  if (!teks) return { ok: true, iso: null };
  const waktu = new Date(teks);
  if (Number.isNaN(waktu.getTime())) return { ok: false };
  return { ok: true, iso: waktu.toISOString() };
}

// Simpan hubungan tugas-kelas (kosong = semua kelas). Pola sama
// seperti pengumuman/ulangan.
async function simpanKelasTugas(
  supabase: Awaited<ReturnType<typeof requireGuru>>,
  tugasId: string,
  daftarKelasId: string[],
) {
  if (daftarKelasId.length > 0) {
    const { error } = await supabase
      .from("assignment_classes")
      .upsert(
        daftarKelasId.map((kelasId) => ({
          tugas_id: tugasId,
          kelas_id: kelasId,
        })),
      );

    if (error) {
      throw new Error(`gagal menyimpan hubungan kelas: ${error.message}`);
    }
  } else {
    const { error } = await supabase
      .from("assignment_classes")
      .delete()
      .eq("tugas_id", tugasId);

    if (error) {
      throw new Error(`gagal menghapus hubungan kelas: ${error.message}`);
    }
  }
}

function bacaIsian(formData: FormData) {
  const judul = String(formData.get("judul") ?? "").trim();
  const deskripsi = String(formData.get("deskripsi") ?? "").trim();
  const metode = bacaMetode(formData.get("metode"));
  const tenggat = parseTenggat(String(formData.get("tenggat") ?? ""));
  const daftarKelasId = bacaKelasDariForm(formData);
  const fileDiizinkan = metodeMengizinkanFile(metode)
    ? bacaFileDiizinkan(formData)
    : [];

  return {
    judul,
    deskripsi,
    metode,
    tenggat,
    daftarKelasId,
    fileDiizinkan,
  };
}

// Validasi bersama; kembalikan pesan error atau null.
function validasi(isian: ReturnType<typeof bacaIsian>): string | null {
  if (!isian.judul) return "Judul tugas wajib diisi.";
  if (isian.judul.length > MAX_JUDUL)
    return `Judul maksimal ${MAX_JUDUL} karakter.`;
  if (isian.deskripsi.length > MAX_DESKRIPSI)
    return `Deskripsi maksimal ${MAX_DESKRIPSI} karakter.`;
  if (!isian.tenggat.ok) return "Format tenggat waktu tidak valid.";
  return null;
}

export async function addTugas(
  _prevState: HasilTugas,
  formData: FormData,
): Promise<HasilTugas> {
  const isian = bacaIsian(formData);

  const galat = validasi(isian);
  if (galat) return { message: galat, berhasil: false };
  if (!isian.tenggat.ok) {
    return { message: "Format tenggat waktu tidak valid.", berhasil: false };
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      judul: isian.judul,
      deskripsi: isian.deskripsi,
      metode: isian.metode,
      file_diizinkan:
        isian.fileDiizinkan.length > 0 ? isian.fileDiizinkan : null,
      tenggat: isian.tenggat.iso,
    })
    .select("id")
    .single();

  if (error) {
    return { message: `Gagal menambah tugas: ${error.message}`, berhasil: false };
  }

  try {
    await simpanKelasTugas(supabase, data.id, isian.daftarKelasId);
  } catch {
    await supabase.from("assignments").delete().eq("id", data.id);
    return {
      message:
        "Tugas tersimpan, tapi gagal mengatur kelasnya. Jalankan dulu bagian DDL Tahap 16 di Supabase SQL Editor.",
      berhasil: false,
    };
  }

  revalidatePath("/guru/tugas");
  revalidatePath("/siswa/tugas");
  return { message: null, berhasil: true };
}

export async function updateTugas(
  _prevState: HasilTugas,
  formData: FormData,
): Promise<HasilTugas> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { message: "Data tugas tidak ditemukan.", berhasil: false };

  const isian = bacaIsian(formData);

  const galat = validasi(isian);
  if (galat) return { message: galat, berhasil: false };
  if (!isian.tenggat.ok) {
    return { message: "Format tenggat waktu tidak valid.", berhasil: false };
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("assignments")
    .update({
      judul: isian.judul,
      deskripsi: isian.deskripsi,
      metode: isian.metode,
      file_diizinkan:
        isian.fileDiizinkan.length > 0 ? isian.fileDiizinkan : null,
      tenggat: isian.tenggat.iso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { message: `Gagal mengubah tugas: ${error.message}`, berhasil: false };
  }

  if (!data || data.length === 0) {
    return {
      message:
        "Gagal mengubah tugas. Jalankan lagi schema.sql supaya izin update aktif.",
      berhasil: false,
    };
  }

  try {
    await simpanKelasTugas(supabase, id, isian.daftarKelasId);
  } catch {
    return {
      message:
        "Perubahan tersimpan, tapi gagal mengatur kelasnya. Jalankan dulu DDL Tahap 16.",
      berhasil: false,
    };
  }

  revalidatePath("/guru/tugas");
  revalidatePath(`/guru/tugas/${id}`);
  revalidatePath("/siswa/tugas");
  return { message: null, berhasil: true };
}

export async function deleteTugas(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await requireGuru();

  // Hapus berkas storage milik tugas ini dulu (biar tidak jadi sampah).
  const { data: submissions } = await supabase
    .from("assignment_submissions")
    .select("assignment_files(path)")
    .eq("tugas_id", id);

  const daftarPath = (submissions ?? []).flatMap((baris) => {
    const berkas =
      (baris as { assignment_files?: { path: string }[] }).assignment_files ??
      [];
    return berkas.map((f) => f.path);
  });

  if (daftarPath.length > 0) {
    await supabase.storage.from(BUCKET_TUGAS).remove(daftarPath);
  }

  const { error } = await supabase.from("assignments").delete().eq("id", id);

  if (error) {
    console.error("Gagal menghapus tugas:", error.message);
  }

  revalidatePath("/guru/tugas");
  revalidatePath("/siswa/tugas");
}

export async function nilaiTugas(
  _prevState: HasilTugas,
  formData: FormData,
): Promise<HasilTugas> {
  const submissionId = String(formData.get("submission_id") ?? "").trim();
  const tugasId = String(formData.get("tugas_id") ?? "").trim();
  const nilaiRaw = String(formData.get("nilai") ?? "").trim();
  const umpanBalik = String(formData.get("umpan_balik") ?? "").trim();

  if (!submissionId) {
    return { message: "Pengumpulan tidak ditemukan.", berhasil: false };
  }

  if (umpanBalik.length > MAX_UMPAN_BALIK) {
    return {
      message: `Umpan balik maksimal ${MAX_UMPAN_BALIK} karakter.`,
      berhasil: false,
    };
  }

  let nilai: number | null = null;
  if (nilaiRaw) {
    const angka = Number(nilaiRaw);
    if (!Number.isFinite(angka) || angka < 0 || angka > 100) {
      return { message: "Nilai harus berupa angka 0–100.", berhasil: false };
    }
    nilai = Math.round(angka);
  }

  const supabase = await requireGuru();
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      nilai,
      umpan_balik: umpanBalik || null,
      dinilai_at: nilai === null ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) {
    return { message: `Gagal menyimpan nilai: ${error.message}`, berhasil: false };
  }

  revalidatePath("/guru/tugas");
  if (tugasId) revalidatePath(`/guru/tugas/${tugasId}`);
  revalidatePath("/siswa/tugas");
  if (tugasId) revalidatePath(`/siswa/tugas/${tugasId}`);
  return { message: "Nilai tersimpan.", berhasil: true };
}
