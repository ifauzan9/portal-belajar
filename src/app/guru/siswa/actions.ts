"use server";

import { revalidatePath } from "next/cache";
import { requireGuru } from "@/lib/require-guru";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_NIS = 50;
const MAX_NAMA = 200;

function bacaForm(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nis = String(formData.get("nis") ?? "").trim();
  const namaSiswa = String(formData.get("nama_siswa") ?? "").trim();
  const kelasId = String(formData.get("kelas_id") ?? "").trim();

  return { id, nis, namaSiswa, kelasId: kelasId ? kelasId : null };
}

function pesanGagal(
  error: { code?: string; message: string },
  aksi: string,
): string {
  if (error.code === "23505") {
    return "NIS sudah dipakai siswa lain.";
  }
  return `Gagal ${aksi} siswa: ${error.message}`;
}

export async function addSiswa(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const { nis, namaSiswa, kelasId } = bacaForm(formData);

  if (!nis) {
    return { message: "NIS wajib diisi." };
  }

  if (nis.length > MAX_NIS) {
    return { message: `NIS maksimal ${MAX_NIS} karakter.` };
  }

  if (!namaSiswa) {
    return { message: "Nama siswa wajib diisi." };
  }

  if (namaSiswa.length > MAX_NAMA) {
    return { message: `Nama siswa maksimal ${MAX_NAMA} karakter.` };
  }

  const supabase = await requireGuru();
  const { error } = await supabase.from("students").insert({
    nis,
    nama_siswa: namaSiswa,
    kelas_id: kelasId,
  });

  if (error) {
    return { message: pesanGagal(error, "menambah") };
  }

  revalidatePath("/guru/siswa");
  return { message: null };
}

export async function updateSiswa(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const { id, nis, namaSiswa, kelasId } = bacaForm(formData);

  if (!id) {
    return { message: "Data siswa tidak ditemukan." };
  }

  if (!nis) {
    return { message: "NIS wajib diisi." };
  }

  if (nis.length > MAX_NIS) {
    return { message: `NIS maksimal ${MAX_NIS} karakter.` };
  }

  if (!namaSiswa) {
    return { message: "Nama siswa wajib diisi." };
  }

  if (namaSiswa.length > MAX_NAMA) {
    return { message: `Nama siswa maksimal ${MAX_NAMA} karakter.` };
  }

  const supabase = await requireGuru();
  const { data, error } = await supabase
    .from("students")
    .update({ nis, nama_siswa: namaSiswa, kelas_id: kelasId })
    .eq("id", id)
    .select("id");

  if (error) {
    return { message: pesanGagal(error, "mengubah") };
  }

  if (!data || data.length === 0) {
    return {
      message:
        "Gagal mengubah siswa. Jalankan lagi schema.sql supaya izin update aktif.",
    };
  }

  revalidatePath("/guru/siswa");
  return { message: null };
}

export async function deleteSiswa(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await requireGuru();
  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    console.error("Gagal menghapus siswa:", error.message);
  }

  revalidatePath("/guru/siswa");
}

// ============================================================================
// Aksi massal untuk siswa terpilih (dari checkbox di halaman Data Siswa).
// Field: `ids` (boleh banyak), `aksi` = salah satu:
//   aktifkan | nonaktifkan | hapus-akun | hapus-siswa
// ============================================================================

export type HasilAksiSiswaBanyak = {
  message: string | null;
  sukses: boolean;
  info: string | null;
};

export async function aksiSiswaBanyak(
  _prevState: HasilAksiSiswaBanyak,
  formData: FormData,
): Promise<HasilAksiSiswaBanyak> {
  const aksi = String(formData.get("aksi") ?? "");
  const ids = formData
    .getAll("ids")
    .map((nilai) => String(nilai))
    .filter(Boolean);

  if (ids.length === 0) {
    return { message: "Tidak ada siswa yang dipilih.", sukses: false, info: null };
  }

  const supabase = await requireGuru();
  const admin = createAdminClient();

  if (aksi === "aktifkan" || aksi === "nonaktifkan") {
    const aktif = aksi === "aktifkan";
    const { error, count } = await admin
      .from("student_accounts")
      .update({ is_active: aktif }, { count: "exact" })
      .in("siswa_id", ids);

    if (error) {
      return {
        message: `Gagal mengubah status akun: ${error.message}`,
        sukses: false,
        info: null,
      };
    }

    revalidatePath("/guru/siswa");
    return {
      message: null,
      sukses: true,
      info: `${count ?? 0} akun ${aktif ? "diaktifkan" : "dinonaktifkan"}.`,
    };
  }

  if (aksi === "hapus-akun") {
    const { error, count } = await admin
      .from("student_accounts")
      .delete({ count: "exact" })
      .in("siswa_id", ids);

    if (error) {
      return {
        message: `Gagal menghapus akun: ${error.message}`,
        sukses: false,
        info: null,
      };
    }

    revalidatePath("/guru/siswa");
    return {
      message: null,
      sukses: true,
      info: `${count ?? 0} akun login dihapus (siswa tetap ada).`,
    };
  }

  if (aksi === "hapus-siswa") {
    const { error, count } = await supabase
      .from("students")
      .delete({ count: "exact" })
      .in("id", ids);

    if (error) {
      return {
        message: `Gagal menghapus siswa: ${error.message}`,
        sukses: false,
        info: null,
      };
    }

    revalidatePath("/guru/siswa");
    revalidatePath("/guru");
    return {
      message: null,
      sukses: true,
      info: `${count ?? 0} siswa dihapus.`,
    };
  }

  return { message: "Aksi tidak dikenal.", sukses: false, info: null };
}

// ============================================================================
// Pindah kelas siswa (satu atau banyak sekaligus).
// Field: `ids` (boleh banyak), `kelas_id` (kelas tujuan; kosong = tanpa kelas)
//
// Catatan:
//  - Data tugas/ulangan/lab/nilai menempel ke siswa_id, jadi tidak terpengaruh.
//  - Absensi menyimpan kelas_id sendiri → ikut dipindah ke kelas tujuan.
//  - Constraint unik (siswa_id, tanggal) bisa bentrok kalau siswa punya
//    absensi di kelas tujuan pada tanggal yang sama; baris kelas tujuan
//    dipertahankan dan jumlah bentrokan dilaporkan sebagai info.
// ============================================================================

export type HasilPindahKelas = {
  message: string | null;
  sukses: boolean;
  info: string | null;
};

export async function pindahKelasSiswa(
  _prevState: HasilPindahKelas,
  formData: FormData,
): Promise<HasilPindahKelas> {
  const ids = Array.from(
    new Set(
      formData
        .getAll("ids")
        .map((nilai) => String(nilai))
        .filter(Boolean),
    ),
  );
  const kelasIdTujuan = String(formData.get("kelas_id") ?? "").trim() || null;

  if (ids.length === 0) {
    return { message: "Tidak ada siswa yang dipilih.", sukses: false, info: null };
  }

  const supabase = await requireGuru();

  // Kalau tujuan bukan "tanpa kelas", pastikan kelasnya memang ada.
  if (kelasIdTujuan) {
    const { data: kelas, error: kelasError } = await supabase
      .from("classes")
      .select("id, nama_kelas")
      .eq("id", kelasIdTujuan)
      .maybeSingle();

    if (kelasError) {
      return {
        message: `Gagal memeriksa kelas tujuan: ${kelasError.message}`,
        sukses: false,
        info: null,
      };
    }

    if (!kelas) {
      return { message: "Kelas tujuan tidak ditemukan.", sukses: false, info: null };
    }
  }

  // Cari siswa yang kelasnya benar-benar berubah.
  let siswaQuery = supabase
    .from("students")
    .select("id, nama_siswa, kelas_id")
    .in("id", ids);
  siswaQuery = kelasIdTujuan
    ? siswaQuery.or(`kelas_id.is.null,kelas_id.neq.${kelasIdTujuan}`)
    : siswaQuery.not("kelas_id", "is", null);

  const { data: siswaBerubah, error: siswaError } = await siswaQuery;

  if (siswaError) {
    return {
      message: `Gagal memuat siswa: ${siswaError.message}`,
      sukses: false,
      info: null,
    };
  }

  const daftarBerubah = (siswaBerubah ?? []) as {
    id: string;
    nama_siswa: string;
    kelas_id: string | null;
  }[];

  if (daftarBerubah.length === 0) {
    return {
      message: null,
      sukses: true,
      info: "Semua siswa terpilih sudah berada di kelas tujuan.",
    };
  }

  const idBerubah = daftarBerubah.map((siswa) => siswa.id);

  const { error: updateError } = await supabase
    .from("students")
    .update({ kelas_id: kelasIdTujuan })
    .in("id", idBerubah);

  if (updateError) {
    return {
      message: `Gagal memindahkan siswa: ${updateError.message}`,
      sukses: false,
      info: null,
    };
  }

  // Absensi ikut pindah. Tanpa kelas tujuan, absensi tetap di kelas asalnya
  // karena attendance.kelas_id wajib terisi.
  let bentrok = 0;
  if (kelasIdTujuan) {
    for (const siswaId of idBerubah) {
      const { error: absensiError } = await supabase
        .from("attendance")
        .update({ kelas_id: kelasIdTujuan })
        .eq("siswa_id", siswaId);

      if (absensiError) {
        // Kode 23505 = ada absensi di kelas tujuan pada tanggal yang sama.
        if (absensiError.code === "23505") {
          bentrok += 1;
          continue;
        }
        console.error(
          `Gagal memindahkan absensi siswa ${siswaId}:`,
          absensiError.message,
        );
      }
    }
  }

  revalidatePath("/guru/siswa");
  revalidatePath("/guru/absensi");
  revalidatePath("/guru/rekap");
  revalidatePath("/siswa", "layout");

  const ringkas = `${daftarBerubah.length} siswa dipindahkan.`;
  return {
    message: null,
    sukses: true,
    info:
      bentrok > 0
        ? `${ringkas} Absensi lama ${bentrok} siswa tidak ikut pindah karena sudah ada catatan di kelas tujuan pada tanggal yang sama.`
        : ringkas,
  };
}
