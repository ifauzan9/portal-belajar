"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { BUCKET_TUGAS } from "@/lib/tugas";

// ============================================================================
// Reset kegiatan siswa (Tahap 21).
// Guru menghapus pengerjaan siswa untuk satu kegiatan supaya siswa bisa
// mengerjakan ulang. Empat jenis: tugas, ulangan, lab_coding, lab_komputer.
// ============================================================================

export type HasilReset = { message: string | null; berhasil: boolean };

type JenisReset =
  | "tugas"
  | "ulangan"
  | "lab_coding"
  | "lab_coding_modul"
  | "lab_komputer";

const JENIS_VALID: JenisReset[] = [
  "tugas",
  "ulangan",
  "lab_coding",
  "lab_coding_modul",
  "lab_komputer",
];

export async function resetKegiatan(
  _prevState: HasilReset,
  formData: FormData,
): Promise<HasilReset> {
  const jenis = String(formData.get("jenis") ?? "").trim() as JenisReset;
  const siswaId = String(formData.get("siswa_id") ?? "").trim();
  const refId = String(formData.get("ref_id") ?? "").trim();

  if (!siswaId || !refId) {
    return { message: "Data tidak lengkap.", berhasil: false };
  }
  if (!JENIS_VALID.includes(jenis)) {
    return { message: "Jenis kegiatan tidak dikenal.", berhasil: false };
  }

  const supabase = await requireGuru();

  if (jenis === "tugas") {
    // Ambil path berkas dulu supaya bisa dihapus dari Storage.
    const { data: sub, error: galatCari } = await supabase
      .from("assignment_submissions")
      .select("id, assignment_files(path)")
      .eq("tugas_id", refId)
      .eq("siswa_id", siswaId)
      .maybeSingle();

    if (galatCari) {
      return {
        message: `Gagal memuat pengumpulan: ${galatCari.message}`,
        berhasil: false,
      };
    }

    const daftarPath =
      (
        sub as { assignment_files?: { path: string }[] } | null
      )?.assignment_files?.map((berkas) => berkas.path) ?? [];

    if (daftarPath.length > 0) {
      await supabase.storage.from(BUCKET_TUGAS).remove(daftarPath);
    }

    // Hapus pengumpulan (baris assignment_files ikut cascade).
    const { error } = await supabase
      .from("assignment_submissions")
      .delete()
      .eq("tugas_id", refId)
      .eq("siswa_id", siswaId);

    if (error) {
      return {
        message: `Gagal mereset tugas: ${error.message}`,
        berhasil: false,
      };
    }
  }

  if (jenis === "ulangan") {
    // Sesi timer (Tahap 33) dihapus lebih dulu. Kalau guru belum
    // menjalankan SQL Tahap 35, jangan hapus apa pun supaya reset
    // tidak berhenti setengah jalan.
    const { error: galatSesi } = await supabase
      .from("exam_sessions")
      .delete()
      .eq("exam_id", refId)
      .eq("siswa_id", siswaId);

    if (galatSesi) {
      return {
        message: `Gagal mereset timer ulangan: ${galatSesi.message}. Jalankan SQL Tahap 35 lalu coba lagi.`,
        berhasil: false,
      };
    }

    // exam_answers hanya punya kolom submission_id, jadi hapus lewat id-nya.
    const { data: sub } = await supabase
      .from("exam_submissions")
      .select("id")
      .eq("exam_id", refId)
      .eq("siswa_id", siswaId)
      .maybeSingle();

    const submissionId = (sub as { id: string } | null)?.id ?? null;

    if (submissionId) {
      await supabase
        .from("exam_answers")
        .delete()
        .eq("submission_id", submissionId);

      const { error } = await supabase
        .from("exam_submissions")
        .delete()
        .eq("id", submissionId);

      if (error) {
        return {
          message: `Gagal mereset ulangan: ${error.message}`,
          berhasil: false,
        };
      }
    }

    // Nilai manual/otomatis + nilai esai + pelacak ikut dibersihkan.
    await supabase
      .from("exam_essay_scores")
      .delete()
      .eq("exam_id", refId)
      .eq("siswa_id", siswaId);
    await supabase
      .from("exam_scores")
      .delete()
      .eq("exam_id", refId)
      .eq("siswa_id", siswaId);
    await supabase
      .from("exam_probes")
      .delete()
      .eq("exam_id", refId)
      .eq("siswa_id", siswaId);

    // Halaman review di Kelola Soal & Input Nilai juga perlu ikut segar.
    revalidatePath(`/guru/ulangan/${refId}/soal`);
    revalidatePath(`/guru/ulangan/${refId}/nilai`);
    revalidatePath(`/siswa/ulangan/${refId}`);
    revalidatePath(`/siswa/nilai/${refId}`);
    revalidatePath("/siswa/nilai");
  }

  if (jenis === "lab_coding") {
    const { error } = await supabase
      .from("coding_submissions")
      .delete()
      .eq("exercise_id", refId)
      .eq("siswa_id", siswaId);

    if (error) {
      return {
        message: `Gagal mereset lab coding: ${error.message}`,
        berhasil: false,
      };
    }
  }

  if (jenis === "lab_coding_modul") {
    // Reset satu modul sekaligus: ambil semua latihan milik modul, lalu
    // hapus pengerjaan siswa pada latihan-latihan itu. Siswa mengulang
    // modul dari level 1 (termasuk membuka kembali level yang terkunci).
    const { data: latihan, error: galatLatihan } = await supabase
      .from("coding_exercises")
      .select("id")
      .eq("lesson_id", refId);

    if (galatLatihan) {
      return {
        message: `Gagal memuat latihan modul: ${galatLatihan.message}`,
        berhasil: false,
      };
    }

    const daftarLatihanId = (latihan ?? []).map(
      (baris) => (baris as { id: string }).id,
    );

    if (daftarLatihanId.length === 0) {
      return {
        message: "Modul ini belum punya latihan untuk direset.",
        berhasil: false,
      };
    }

    const { error } = await supabase
      .from("coding_submissions")
      .delete()
      .eq("siswa_id", siswaId)
      .in("exercise_id", daftarLatihanId);

    if (error) {
      return {
        message: `Gagal mereset modul lab coding: ${error.message}`,
        berhasil: false,
      };
    }
  }

  if (jenis === "lab_komputer") {
    const { error } = await supabase
      .from("komputer_hasil")
      .delete()
      .eq("challenge_id", refId)
      .eq("siswa_id", siswaId);

    if (error) {
      return {
        message: `Gagal mereset lab komputer: ${error.message}`,
        berhasil: false,
      };
    }
  }

  revalidatePath(`/guru/rekap/${siswaId}`);
  revalidatePath("/guru/rekap");
  revalidatePath("/guru/tugas");
  revalidatePath("/guru/ulangan");
  revalidatePath("/guru/lab");
  revalidatePath("/guru/lab/hasil");
  revalidatePath("/guru/komputer/hasil");

  return { message: "Kegiatan siswa berhasil direset.", berhasil: true };
}
