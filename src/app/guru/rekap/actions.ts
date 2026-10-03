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

type JenisReset = "tugas" | "ulangan" | "lab_coding" | "lab_komputer";

const JENIS_VALID: JenisReset[] = [
  "tugas",
  "ulangan",
  "lab_coding",
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
  revalidatePath("/guru/lab/hasil");
  revalidatePath("/guru/komputer/hasil");

  return { message: "Kegiatan siswa berhasil direset.", berhasil: true };
}
