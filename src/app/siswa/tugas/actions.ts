"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ambilSesiSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_TUGAS,
  MAKS_FILE,
  MAKS_FILE_MB,
  ambilKelasTugas,
  bacaMetode,
  bersihkanNamaFile,
  daftarEkstensiDiizinkan,
  fileDiizinkan,
  metodeMengizinkanFile,
  metodeMengizinkanLink,
  normalisasiTautan,
  tipeDariNama,
} from "@/lib/tugas";

export type HasilKumpulTugas = { message: string | null; berhasil: boolean };

// Ambil File dari FormData; buang string kosong / berkas 0 byte.
function sebagaiFile(nilai: FormDataEntryValue): File | null {
  if (typeof nilai === "string") return null;
  const berkas = nilai as File;
  if (typeof berkas.arrayBuffer !== "function") return null;
  if (!berkas.size) return null;
  return berkas;
}

export async function kumpulkanTugas(
  _prevState: HasilKumpulTugas,
  formData: FormData,
): Promise<HasilKumpulTugas> {
  const tugasId = String(formData.get("tugas_id") ?? "").trim();
  if (!tugasId) {
    return { message: "Tugas tidak ditemukan.", berhasil: false };
  }

  const sesi = await ambilSesiSiswa();
  if (!sesi) redirect("/login-siswa");

  const supabase = await createClient();

  const { data: tugasData } = await supabase
    .from("assignments")
    .select("id, metode, file_diizinkan, tenggat, dibuka, assignment_classes(kelas_id)")
    .eq("id", tugasId)
    .maybeSingle();

  if (!tugasData) {
    return { message: "Tugas tidak ditemukan.", berhasil: false };
  }

  const tugas = tugasData as {
    id: string;
    metode: string;
    file_diizinkan: string[] | null;
    tenggat: string | null;
    dibuka: boolean | null;
    assignment_classes?: { kelas_id: string }[];
  };

  const metode = bacaMetode(tugas.metode);

  // Tugas ditutup guru? Tolak walau tenggat belum lewat.
  if (tugas.dibuka === false) {
    return { message: "Tugas ini sudah ditutup oleh guru.", berhasil: false };
  }

  // Tenggat sudah lewat?
  if (tugas.tenggat && new Date(tugas.tenggat).getTime() < Date.now()) {
    return {
      message: "Tenggat sudah lewat. Hubungi gurumu kalau ada masalah.",
      berhasil: false,
    };
  }

  // Cek relevansi kelas.
  const { data: siswaData } = await supabase
    .from("students")
    .select("id, kelas_id")
    .eq("id", sesi.siswaId)
    .maybeSingle();

  const siswa = siswaData as { id: string; kelas_id: string | null } | null;
  if (!siswa) {
    return { message: "Data siswa tidak ditemukan.", berhasil: false };
  }

  const daftarKelasId = ambilKelasTugas(tugas);
  const relevan =
    daftarKelasId.length === 0 ||
    (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

  if (!relevan) {
    return { message: "Tugas ini bukan untuk kelasmu.", berhasil: false };
  }

  // Baca isian.
  const tautanRaw = String(formData.get("tautan") ?? "");
  const catatan = String(formData.get("catatan") ?? "").trim();
  const tautan = metodeMengizinkanLink(metode)
    ? normalisasiTautan(tautanRaw)
    : null;

  const berkas = [
    ...formData.getAll("foto").map(sebagaiFile),
    ...formData.getAll("dokumen").map(sebagaiFile),
  ].filter((f): f is File => f !== null);

  // Validasi sesuai metode.
  if (metodeMengizinkanLink(metode) && !tautan) {
    return { message: "Tautan wajib diisi.", berhasil: false };
  }
  if (metodeMengizinkanFile(metode) && berkas.length === 0) {
    return {
      message: "Minimal satu berkas harus diunggah.",
      berhasil: false,
    };
  }
  if (!tautan && berkas.length === 0) {
    return { message: "Isi tautan atau unggah berkas dulu.", berhasil: false };
  }

  if (berkas.length > MAKS_FILE) {
    return { message: `Maksimal ${MAKS_FILE} berkas.`, berhasil: false };
  }

  const daftarEkstensi = daftarEkstensiDiizinkan(tugas.file_diizinkan);
  for (const file of berkas) {
    if (!fileDiizinkan(file.name, daftarEkstensi)) {
      return {
        message: `Jenis berkas "${file.name}" tidak diizinkan.`,
        berhasil: false,
      };
    }
    if (file.size > MAKS_FILE_MB * 1024 * 1024) {
      return {
        message: `Berkas "${file.name}" melebihi ${MAKS_FILE_MB} MB.`,
        berhasil: false,
      };
    }
  }

  // Simpan / perbarui pengumpulan.
  const sekarang = new Date().toISOString();
  const { data: submission, error: galatSimpan } = await supabase
    .from("assignment_submissions")
    .upsert(
      {
        tugas_id: tugasId,
        siswa_id: sesi.siswaId,
        tautan,
        catatan: catatan || null,
        updated_at: sekarang,
      },
      { onConflict: "tugas_id,siswa_id" },
    )
    .select("id")
    .single();

  if (galatSimpan || !submission) {
    return {
      message: `Gagal menyimpan pengumpulan: ${
        galatSimpan?.message ?? "tidak diketahui"
      }`,
      berhasil: false,
    };
  }

  // Ganti berkas lama dengan yang baru (hanya kalau metode mengizinkan file).
  // Kalau metode "link saja", berkas lama dibiarkan.
  if (metodeMengizinkanFile(metode)) {
    const { data: berkasLama } = await supabase
      .from("assignment_files")
      .select("path")
      .eq("submission_id", submission.id);

    const pathLama = (berkasLama ?? []).map(
      (baris) => (baris as { path: string }).path,
    );

    if (pathLama.length > 0) {
      await supabase.storage.from(BUCKET_TUGAS).remove(pathLama);
      await supabase
        .from("assignment_files")
        .delete()
        .eq("submission_id", submission.id);
    }

    const barisBerkas: {
      submission_id: string;
      tipe: string;
      nama_file: string;
      path: string;
      ukuran: number;
    }[] = [];

    for (const file of berkas) {
      const path = `${tugasId}/${sesi.siswaId}/${Date.now()}-${bersihkanNamaFile(
        file.name,
      )}`;
      const isi = await file.arrayBuffer();

      const { error: galatUpload } = await supabase.storage
        .from(BUCKET_TUGAS)
        .upload(path, isi, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (galatUpload) {
        // Buang berkas yang sudah terlanjur terunggah di percobaan ini.
        if (barisBerkas.length > 0) {
          await supabase.storage
            .from(BUCKET_TUGAS)
            .remove(barisBerkas.map((b) => b.path));
        }
        return {
          message: `Gagal mengunggah "${file.name}": ${galatUpload.message}. Pastikan bucket "tugas" sudah dibuat (jalankan schema.sql Tahap 16).`,
          berhasil: false,
        };
      }

      barisBerkas.push({
        submission_id: submission.id,
        tipe: tipeDariNama(file.name),
        nama_file: file.name,
        path,
        ukuran: file.size,
      });
    }

    if (barisBerkas.length > 0) {
      const { error: galatBerkas } = await supabase
        .from("assignment_files")
        .insert(barisBerkas);

      if (galatBerkas) {
        await supabase.storage
          .from(BUCKET_TUGAS)
          .remove(barisBerkas.map((b) => b.path));
        return {
          message: `Gagal menyimpan data berkas: ${galatBerkas.message}`,
          berhasil: false,
        };
      }
    }
  }

  revalidatePath("/siswa/tugas");
  revalidatePath(`/siswa/tugas/${tugasId}`);
  revalidatePath("/guru/tugas");
  revalidatePath(`/guru/tugas/${tugasId}`);

  return { message: "Tugas berhasil dikumpulkan!", berhasil: true };
}
