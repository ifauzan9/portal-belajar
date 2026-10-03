"use server";

import { revalidatePath } from "next/cache";
import {
  MAX_FILE_SIZE,
  MAX_ROWS,
  parseSiswaXlsx,
  type BarisImport,
} from "@/lib/parse-siswa-xlsx";
import { requireGuru } from "@/lib/require-guru";

async function ambilNisTerpakai(supabase: Awaited<ReturnType<typeof requireGuru>>) {
  const { data, error } = await supabase
    .from("students")
    .select("nis")
    .not("nis", "is", null);

  if (error) return { nis: [] as string[], error: error.message };

  return {
    nis: (data ?? []).map((row) => String(row.nis ?? "")),
    error: null,
  };
}

export async function previewImport(
  _prevState: { rows: BarisImport[]; error: string | null },
  formData: FormData,
): Promise<{ rows: BarisImport[]; error: string | null }> {
  const supabase = await requireGuru();

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { rows: [], error: "Pilih file Excel (.xlsx) terlebih dahulu." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { rows: [], error: "Ukuran file maksimal 2 MB." };
  }

  const { data: kelasData, error: kelasError } = await supabase
    .from("classes")
    .select("id, nama_kelas");

  if (kelasError) {
    return { rows: [], error: `Gagal memuat data kelas: ${kelasError.message}` };
  }

  const nis = await ambilNisTerpakai(supabase);

  if (nis.error) {
    return { rows: [], error: `Gagal memuat data siswa: ${nis.error}` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return parseSiswaXlsx(buffer, kelasData ?? [], nis.nis);
}

export async function simpanImport(
  _prevState: { jumlah: number; dilewati: number; error: string | null },
  formData: FormData,
): Promise<{ jumlah: number; dilewati: number; error: string | null }> {
  const supabase = await requireGuru();

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return {
      jumlah: 0,
      dilewati: 0,
      error: "Data pratinjau tidak valid. Ulangi pilih file.",
    };
  }

  if (!Array.isArray(input) || input.length === 0) {
    return { jumlah: 0, dilewati: 0, error: "Tidak ada baris valid untuk diimport." };
  }

  if (input.length > MAX_ROWS) {
    return {
      jumlah: 0,
      dilewati: 0,
      error: `Maksimal ${MAX_ROWS} baris per import.`,
    };
  }

  // Validasi ulang di server: kelas harus ada, NIS tidak boleh kosong/ganda.
  const { data: kelasData, error: kelasError } = await supabase
    .from("classes")
    .select("id");

  if (kelasError) {
    return {
      jumlah: 0,
      dilewati: 0,
      error: `Gagal memuat data kelas: ${kelasError.message}`,
    };
  }

  const kelasIds = new Set((kelasData ?? []).map((kelas) => kelas.id as string));

  const nisDatabase = await ambilNisTerpakai(supabase);
  if (nisDatabase.error) {
    return {
      jumlah: 0,
      dilewati: 0,
      error: `Gagal memuat data siswa: ${nisDatabase.error}`,
    };
  }

  const nisTerpakai = new Set(nisDatabase.nis);
  const rows: { nis: string; nama_siswa: string; kelas_id: string | null }[] = [];
  let dilewati = 0;

  for (const item of input) {
    if (typeof item !== "object" || item === null) {
      dilewati += 1;
      continue;
    }

    const data = item as { nis?: unknown; nama?: unknown; kelasId?: unknown };
    const nis = typeof data.nis === "string" ? data.nis.trim() : "";
    const nama = typeof data.nama === "string" ? data.nama.trim() : "";

    if (!nis || !nama || nis.length > 50 || nama.length > 200) {
      dilewati += 1;
      continue;
    }

    if (nisTerpakai.has(nis)) {
      dilewati += 1;
      continue;
    }

    const kelasId =
      typeof data.kelasId === "string" && kelasIds.has(data.kelasId)
        ? data.kelasId
        : null;

    nisTerpakai.add(nis);
    rows.push({ nis, nama_siswa: nama, kelas_id: kelasId });
  }

  if (rows.length === 0) {
    return { jumlah: 0, dilewati, error: "Tidak ada baris valid untuk diimport." };
  }

  const { error } = await supabase.from("students").insert(rows);

  if (error) {
    if (error.code === "23505") {
      return {
        jumlah: 0,
        dilewati,
        error: "Ada NIS yang sudah dipakai siswa lain. Ulangi pratinjau lalu import lagi.",
      };
    }
    return { jumlah: 0, dilewati, error: `Gagal menyimpan: ${error.message}` };
  }

  revalidatePath("/guru/siswa");
  return { jumlah: rows.length, dilewati, error: null };
}
