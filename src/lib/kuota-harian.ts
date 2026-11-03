// ============================================================================
// Kuota harian ganti password siswa — DISIMPAN DI DATABASE.
//
// Sebelumnya kuota ini disimpan di memori proses server (Map). Cara itu TIDAK
// benar untuk aplikasi serverless seperti Vercel: setiap instance punya Map
// sendiri dan selalu mulai dari nol, sehingga siswa bisa mengganti password
// berkali-kali sementara halaman tetap menampilkan "3 dari 3".
//
// Sekarang penghitung menempel pada baris akun siswa di student_accounts
// (schema Tahap 31):
//   - password_kuota_tanggal  : tanggal WIB saat kuota terakhir dipakai
//   - password_kuota_terpakai : berapa kali dipakai pada tanggal itu
//
// Reset harian memakai zona Asia/Jakarta (tengah malam WIB), sama seperti
// tampilan waktu di seluruh aplikasi.
//
// Kunci penghitung = id akun (student_accounts.id), jadi kuota mengikuti AKUN
// — bukan IP/jaringan, dan tidak bisa diakali dengan ganti jaringan.
//
// Soal "atomik": pemakaian memakai pola compare-and-swap. UPDATE hanya berhasil
// kalau nilai lama masih sama persis dengan yang tadi dibaca. Jadi kalau dua
// permintaan datang bersamaan, hanya satu yang menang; yang kalah membaca
// ulang lalu mencoba lagi. Tidak perlu fungsi/trigger di database.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { tanggalWibHariIni } from "@/lib/waktu";

export type AlasanKuotaTidakSiap = "skema" | "galat";

export type HasilKuota = {
  boleh: boolean;
  terpakai: number;
  sisa: number;
  maks: number;
  // true = kuota bisa dibaca/dihitung. false = lihat `alasan`.
  siap: boolean;
  // "skema" = kolom Tahap 31 belum ada (perlu jalankan SQL).
  // "galat" = gangguan lain (jaringan/database); pengguna cukup coba lagi.
  alasan?: AlasanKuotaTidakSiap;
};

// Tipe minimal admin client (service-role) yang dibutuhkan di sini.
type AdminClient = SupabaseClient;

type BarisKuota = {
  password_kuota_tanggal: string | null;
  password_kuota_terpakai: number | null;
};

// Berapa kali pengulangan saat kalah balapan (hampir selalu cukup 1x).
const MAKS_PERCOBAAN = 5;

function hasilTidakSiap(
  maks: number,
  alasan: AlasanKuotaTidakSiap,
): HasilKuota {
  return {
    boleh: false,
    terpakai: 0,
    sisa: 0,
    maks,
    siap: false,
    alasan,
  };
}

// Postgres error 42703 = undefined_column; PostgREST menyampaikannya lewat
// pesan. Dipakai untuk membedakan "schema belum dijalankan" dari gangguan
// jaringan biasa.
//
// Diekspor karena aksi guru (reset kuota siswa) juga perlu membedakan kedua
// keadaan itu agar pesannya tidak menyesatkan.
export function galatKolomKuotaBelumAda(
  galat: { message?: string; code?: string } | null,
): boolean {
  if (!galat) return false;
  if (galat.code === "42703") return true;
  const pesan = galat.message ?? "";
  return (
    pesan.includes("does not exist") &&
    (pesan.includes("password_kuota_tanggal") ||
      pesan.includes("password_kuota_terpakai"))
  );
}

function buatHasil(terpakai: number, maks: number): HasilKuota {
  return {
    // Untuk pembacaan: masih ada sisa kuota.
    boleh: terpakai < maks,
    terpakai,
    sisa: Math.max(0, maks - terpakai),
    maks,
    siap: true,
  };
}

// Hasil pemakaian yang BERHASIL. `boleh` di sini berarti "pemakaian
// diberikan", bukan "masih ada sisa" — pemakaian ke-3 (maks) tetap sah
// walaupun sisanya menjadi 0.
function buatHasilDipakai(terpakai: number, maks: number): HasilKuota {
  return {
    boleh: true,
    terpakai,
    sisa: Math.max(0, maks - terpakai),
    maks,
    siap: true,
  };
}

// Hitungan yang berlaku hari ini. Tanggal tersimpan dari hari lain dianggap
// kosong (reset otomatis saat tengah malam WIB lewat).
function terpakaiHariIni(row: BarisKuota, hariIni: string): number {
  return row.password_kuota_tanggal === hariIni
    ? Math.max(0, row.password_kuota_terpakai ?? 0)
    : 0;
}

// Versi murni (tanpa query) untuk halaman guru yang sudah memuat banyak baris
// akun sekaligus. Mengembalikan berapa kali kuota dipakai HARI INI.
export function terpakaiKuotaHariIni(
  tanggalTersimpan: string | null,
  terpakaiTersimpan: number | null,
  sekarang: Date = new Date(),
): number {
  return terpakaiHariIni(
    {
      password_kuota_tanggal: tanggalTersimpan,
      password_kuota_terpakai: terpakaiTersimpan,
    },
    tanggalWibHariIni(sekarang),
  );
}

// Reset kuota satu akun (dipakai guru). Setelah ini siswa mendapat jatah penuh
// lagi hari ini.
export async function resetKuotaSiswa(
  admin: AdminClient,
  accountId: string,
  sekarang: Date = new Date(),
): Promise<{ sukses: boolean; pesan: string | null }> {
  const { error } = await admin
    .from("student_accounts")
    .update({
      password_kuota_tanggal: tanggalWibHariIni(sekarang),
      password_kuota_terpakai: 0,
    })
    .eq("id", accountId);

  if (error) {
    return {
      sukses: false,
      pesan: galatKolomKuotaBelumAda(error)
        ? "Kuota belum aktif: jalankan schema Tahap 31 di Supabase terlebih dahulu."
        : `Gagal mereset kuota: ${error.message}`,
    };
  }

  return { sukses: true, pesan: null };
}

// Baca kuota tanpa mengubah apa pun.
export async function cekKuota(
  admin: AdminClient,
  accountId: string,
  maks: number,
  sekarang: Date = new Date(),
): Promise<HasilKuota> {
  const hariIni = tanggalWibHariIni(sekarang);

  const { data, error } = await admin
    .from("student_accounts")
    .select("password_kuota_tanggal, password_kuota_terpakai")
    .eq("id", accountId)
    .maybeSingle();

  // Kolom belum ada (Tahap 31 belum dijalankan) → jangan pura-pura siap.
  if (error) {
    return hasilTidakSiap(maks, galatKolomKuotaBelumAda(error) ? "skema" : "galat");
  }

  if (!data) {
    return hasilTidakSiap(maks, "galat");
  }

  return buatHasil(terpakaiHariIni(data as BarisKuota, hariIni), maks);
}

// Pakai satu kuota. Mengembalikan kuota SETELAH pemakaian.
//
// Aturan:
//   - tanggal != hari ini  → mulai hari baru: terpakai = 1
//   - tanggal == hari ini  → terpakai + 1 (hanya kalau masih di bawah maks)
//   - sudah mencapai maks  → tidak berubah (boleh = false)
export async function pakaiKuota(
  admin: AdminClient,
  accountId: string,
  maks: number,
  sekarang: Date = new Date(),
): Promise<HasilKuota> {
  const hariIni = tanggalWibHariIni(sekarang);

  for (let percobaan = 0; percobaan < MAKS_PERCOBAAN; percobaan++) {
    const { data, error } = await admin
      .from("student_accounts")
      .select("password_kuota_tanggal, password_kuota_terpakai")
      .eq("id", accountId)
      .maybeSingle();

    if (error) {
      return hasilTidakSiap(maks, galatKolomKuotaBelumAda(error) ? "skema" : "galat");
    }

    // Akun tidak ada → jangan pernah meloloskan pemakaian.
    if (!data) {
      return { boleh: false, terpakai: maks, sisa: 0, maks, siap: true };
    }

    const row = data as BarisKuota;
    const terpakai = terpakaiHariIni(row, hariIni);

    if (terpakai >= maks) {
      return buatHasil(terpakai, maks);
    }

    const nilaiBaru = terpakai + 1;
    const terpakaiLama = row.password_kuota_terpakai;

    // Compare-and-swap: hanya menulis kalau baris masih bernilai seperti yang
    // dibaca tadi. Syarat ini yang membuat dua permintaan bersamaan tidak bisa
    // sama-sama lolos.
    let kueri = admin
      .from("student_accounts")
      .update({
        password_kuota_tanggal: hariIni,
        password_kuota_terpakai: nilaiBaru,
      })
      .eq("id", accountId);

    // Cocokkan kondisi LAMA secara persis (termasuk NULL).
    kueri =
      row.password_kuota_tanggal === null
        ? kueri.is("password_kuota_tanggal", null)
        : kueri.eq("password_kuota_tanggal", row.password_kuota_tanggal);

    kueri =
      terpakaiLama === null || terpakaiLama === undefined
        ? kueri.is("password_kuota_terpakai", null)
        : kueri.eq("password_kuota_terpakai", terpakaiLama);

    const { data: terupdate, error: galatUpdate } = await kueri.select("id");

    if (galatUpdate) {
      return hasilTidakSiap(maks, galatKolomKuotaBelumAda(galatUpdate) ? "skema" : "galat");
    }

    // 1 baris = berhasil. 0 baris = kalah balapan, ulangi dengan nilai baru.
    if (Array.isArray(terupdate) && terupdate.length === 1) {
      return buatHasilDipakai(nilaiBaru, maks);
    }
  }

  // Terlalu sering kalah balapan: anggap kuota habis (aman, tidak meloloskan).
  return { boleh: false, terpakai: maks, sisa: 0, maks, siap: true };
}

// Kembalikan satu kuota yang sudah terpakai tetapi penyimpanan password gagal.
//
// Best-effort: dipakai hanya di jalur kegagalan, dan bersyarat "nilainya masih
// sama" supaya tidak mengganggu pemakaian lain yang lebih baru.
export async function kembalikanKuota(
  admin: AdminClient,
  accountId: string,
  terpakaiSaatIni: number,
): Promise<void> {
  if (terpakaiSaatIni <= 0) return;

  await admin
    .from("student_accounts")
    .update({ password_kuota_terpakai: terpakaiSaatIni - 1 })
    .eq("id", accountId)
    .eq("password_kuota_terpakai", terpakaiSaatIni);
}
