"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import {
  MAX_FILE_SIZE,
  MAX_ROWS,
  parseKredensialXlsx,
  type BarisImportKredensial,
} from "@/lib/parse-kredensial-xlsx";
import { hashPassword } from "@/lib/hash-password";
import { requireGuru } from "@/lib/require-guru";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// Aksi kredensial siswa: import massal dari Excel + buat otomatis.
// Semua aksi memverifikasi sesi guru dulu (requireGuru).
// ============================================================================

type SiswaRef = { id: string; nis: string | null; nama_siswa: string; kelas_id: string | null };

async function ambilSiswa(
  supabase: Awaited<ReturnType<typeof requireGuru>>,
) {
  const { data, error } = await supabase
    .from("students")
    .select("id, nis, nama_siswa, kelas_id");
  if (error) return { siswa: [] as SiswaRef[], error: error.message };
  return { siswa: (data ?? []) as SiswaRef[], error: null };
}

async function ambilUsernameTerpakai() {
  const { data, error } = await createAdminClient()
    .from("student_accounts")
    .select("username, siswa_id");
  if (error) return { data: [] as { username: string; siswa_id: string }[], error: error.message };
  return { data: (data ?? []) as { username: string; siswa_id: string }[], error: null };
}

// ----------------------------------------------------------------------------
// PRATINJAU IMPORT KREDENSIAL
// ----------------------------------------------------------------------------
export type HasilPreviewKredensial = {
  rows: BarisImportKredensial[];
  error: string | null;
};

export async function previewKredensial(
  _prevState: HasilPreviewKredensial,
  formData: FormData,
): Promise<HasilPreviewKredensial> {
  const supabase = await requireGuru();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { rows: [], error: "Pilih file Excel (.xlsx) terlebih dahulu." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { rows: [], error: "Ukuran file maksimal 2 MB." };
  }

  const siswaRes = await ambilSiswa(supabase);
  if (siswaRes.error) {
    return { rows: [], error: `Gagal memuat data siswa: ${siswaRes.error}` };
  }

  const { data: kelasData, error: kelasError } = await supabase
    .from("classes")
    .select("id, nama_kelas");
  if (kelasError) {
    return { rows: [], error: `Gagal memuat data kelas: ${kelasError.message}` };
  }

  const usernameRes = await ambilUsernameTerpakai();
  if (usernameRes.error) {
    return { rows: [], error: `Gagal memuat akun: ${usernameRes.error}` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return parseKredensialXlsx(
    buffer,
    siswaRes.siswa,
    (kelasData ?? []) as { id: string; nama_kelas: string }[],
    usernameRes.data,
  );
}

// ----------------------------------------------------------------------------
// SIMPAN IMPORT KREDENSIAL
// ----------------------------------------------------------------------------
export type HasilSimpanKredensial = {
  jumlah: number;
  dilewati: number;
  error: string | null;
};

export async function simpanImportKredensial(
  _prevState: HasilSimpanKredensial,
  formData: FormData,
): Promise<HasilSimpanKredensial> {
  const supabase = await requireGuru();
  const admin = createAdminClient();

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { jumlah: 0, dilewati: 0, error: "Data pratinjau tidak valid. Ulangi pilih file." };
  }

  if (!Array.isArray(input) || input.length === 0) {
    return { jumlah: 0, dilewati: 0, error: "Tidak ada baris valid untuk diimport." };
  }
  if (input.length > MAX_ROWS) {
    return { jumlah: 0, dilewati: 0, error: `Maksimal ${MAX_ROWS} baris per import.` };
  }

  // Ambil daftar siswa (kunci NIS) & username yang sudah terpakai.
  const siswaRes = await ambilSiswa(supabase);
  if (siswaRes.error) {
    return { jumlah: 0, dilewati: 0, error: `Gagal memuat data siswa: ${siswaRes.error}` };
  }

  const usernameRes = await ambilUsernameTerpakai();
  if (usernameRes.error) {
    return { jumlah: 0, dilewati: 0, error: `Gagal memuat akun: ${usernameRes.error}` };
  }

  const nisMap = new Map<string, SiswaRef>();
  for (const s of siswaRes.siswa) {
    if (s.nis) nisMap.set(s.nis, s);
  }

  const usernameTerpakaiGlobal = new Set(
    usernameRes.data.map((u) => u.username.toLowerCase()),
  );
  const usernameTerpakaiPerSiswa = new Map<string, string>();
  for (const u of usernameRes.data) {
    usernameTerpakaiPerSiswa.set(u.siswa_id, u.username.toLowerCase());
  }

  let jumlah = 0;
  let dilewati = 0;

  for (const item of input) {
    if (typeof item !== "object" || item === null) {
      dilewati += 1;
      continue;
    }

    const baris = item as {
      nis?: unknown;
      username?: unknown;
      password?: unknown;
    };
    const nis = typeof baris.nis === "string" ? baris.nis.trim() : "";
    const username = typeof baris.username === "string" ? baris.username.trim() : "";
    const password = typeof baris.password === "string" ? baris.password : "";

    if (!nis || !username || !password) {
      dilewati += 1;
      continue;
    }

    const siswa = nisMap.get(nis);
    if (!siswa) {
      dilewati += 1;
      continue;
    }

    const usernameNorm = username.toLowerCase();

    // Cek konflik username global (kecuali siswa ini sendiri).
    if (usernameTerpakaiGlobal.has(usernameNorm)) {
      const milikSiswaIni = usernameTerpakaiPerSiswa.get(siswa.id);
      if (milikSiswaIni === undefined || milikSiswaIni !== usernameNorm) {
        dilewati += 1;
        continue;
      }
      // Update password siswa ini (username sama).
    }

    const hash = hashPassword(password);

    // Cek apakah siswa ini sudah punya akun.
    const adaAkun = usernameRes.data.find(
      (u) => u.siswa_id === siswa.id,
    );

    if (adaAkun) {
      const { error } = await admin
        .from("student_accounts")
        .update({ username, password_hash: hash })
        .eq("siswa_id", siswa.id);
      if (error) {
        dilewati += 1;
        continue;
      }
    } else {
      const { error } = await admin
        .from("student_accounts")
        .insert({ siswa_id: siswa.id, username, password_hash: hash });
      if (error) {
        dilewati += 1;
        continue;
      }
    }

    // Update indeks lokal supaya baris berikutnya tahu username sudah terpakai.
    usernameTerpakaiGlobal.add(usernameNorm);
    usernameTerpakaiPerSiswa.set(siswa.id, usernameNorm);
    jumlah += 1;
  }

  revalidatePath("/guru/siswa");
  return { jumlah, dilewati, error: null };
}

// ----------------------------------------------------------------------------
// BUAT KREDENSIAL OTOMATIS
// ----------------------------------------------------------------------------
export type KredensialOtomatis = {
  nama: string;
  nis: string;
  username: string;
  password: string;
};

export type HasilBuatOtomatis = {
  dibuat: KredensialOtomatis[];
  error: string | null;
};

// Ambil maksimal 2 kata pertama dari nama, dipisah dengan "-".
// Contoh: "Muhammad Budi Santoso" → "muhammad-budi"
//         "Siti"                  → "siti"
function duaKataDepan(nama: string): string {
  return nama
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata.toLowerCase())
    .join("-");
}

function acakHanging(karakter: string, panjang: number): string {
  const bytes = randomBytes(panjang);
  let hasil = "";
  for (let i = 0; i < panjang; i++) {
    hasil += karakter[bytes[i] % karakter.length];
  }
  return hasil;
}

export async function buatKredensialOtomatis(
  _prevState: HasilBuatOtomatis,
  formData: FormData,
): Promise<HasilBuatOtomatis> {
  const supabase = await requireGuru();
  const admin = createAdminClient();

  // Filter kelas (kosong = semua kelas).
  const kelasPilihan = String(formData.get("kelas") ?? "").trim();

  // Ambil siswa + akun. Kalau ada kelas terpilih, filter langsung di query.
  let siswaQuery = supabase.from("students").select("id, nis, nama_siswa");
  if (kelasPilihan) {
    siswaQuery = siswaQuery.eq("kelas_id", kelasPilihan);
  }

  const [
    { data: siswaData, error: siswaError },
    akunRes,
  ] = await Promise.all([
    siswaQuery,
    admin.from("student_accounts").select("siswa_id, username"),
  ]);

  if (siswaError) {
    return { dibuat: [], error: `Gagal memuat siswa: ${siswaError.message}` };
  }

  const semuaSiswa = (siswaData ?? []) as {
    id: string;
    nis: string | null;
    nama_siswa: string;
  }[];

  const akunTerpakai = new Set(
    (akunRes.data ?? []).map((a) => a.siswa_id as string),
  );

  const siswaTanpaAkun = semuaSiswa.filter(
    (s) => !akunTerpakai.has(s.id),
  );

  if (siswaTanpaAkun.length === 0) {
    return { dibuat: [], error: null };
  }

  const usernameTerpakai = new Set<string>();
  for (const a of akunRes.data ?? []) {
    usernameTerpakai.add((a.username as string).toLowerCase());
  }

  const dibuat: KredensialOtomatis[] = [];

  for (const siswa of siswaTanpaAkun) {
    // Username = 2 kata depan nama + suffix acak 4 karakter.
    // Contoh: "Muhammad Budi Santoso" → "muhammad-budi-sd2k"
    //         "Siti"                  → "siti-x9k2"
    let username = duaKataDepan(siswa.nama_siswa);
    if (!username) username = "siswa";

    const suffix = acakHanging("abcdefghijklmnopqrstuvwxyz0123456789", 4);
    let calon = `${username}-${suffix}`.toLowerCase();

    // Kalau masih bentrok, tambah suffix lagi sampai unik (maks 5 percobaan).
    for (let i = 0; i < 5 && usernameTerpakai.has(calon); i++) {
      const suffixLagi = acakHanging("0123456789", 4);
      calon = `${username}-${suffix}-${suffixLagi}`.toLowerCase();
    }

    if (usernameTerpakai.has(calon)) {
      // Langkah terakhir: pakai NIS + acak.
      const acak = acakHanging("abcdefghijklmnopqrstuvwxyz0123456789", 6);
      calon = siswa.nis ? `${siswa.nis}-${acak}`.toLowerCase() : `siswa-${acak}`;
    }

    const password = acakHanging("abcdefghjkmnpqrstuvwxyz23456789", 8);

    const hash = hashPassword(password);
    const { error } = await admin
      .from("student_accounts")
      .insert({
        siswa_id: siswa.id,
        username: calon,
        password_hash: hash,
      });

    if (error) {
      // Gagal insert (mis. konflik unik), lewati siswa ini.
      continue;
    }

    usernameTerpakai.add(calon.toLowerCase());
    dibuat.push({
      nama: siswa.nama_siswa,
      nis: siswa.nis ?? "-",
      username: calon,
      password,
    });
  }

  revalidatePath("/guru/siswa");
  return { dibuat, error: null };
}
