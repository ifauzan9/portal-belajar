import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buatXlsxSiswa } from "@/lib/export-siswa";

// Unduh rekap siswa sebagai file .xlsx
// (No, NIS, Nama, Kelas). Hanya bisa diakses guru yang sudah login.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: siswaData, error: galatSiswa }, { data: kelasData }] =
    await Promise.all([
      supabase.from("students").select("id, nis, nama_siswa, kelas_id"),
      supabase.from("classes").select("id, nama_kelas"),
    ]);

  if (galatSiswa) {
    return NextResponse.json(
      { pesan: `Gagal memuat siswa: ${galatSiswa.message}` },
      { status: 500 },
    );
  }

  const namaKelas = new Map(
    (kelasData ?? []).map((kelas) => [kelas.id, kelas.nama_kelas]),
  );

  const baris = (siswaData ?? []).map((siswa) => ({
    nis: siswa.nis,
    nama_siswa: siswa.nama_siswa,
    kelas: siswa.kelas_id
      ? (namaKelas.get(siswa.kelas_id) ?? "")
      : "",
  }));

  // Urutkan agar nomor urut stabil: nama kelas, lalu nama siswa.
  baris.sort((a, b) =>
    a.kelas.localeCompare(b.kelas, "id", {
      numeric: true,
      sensitivity: "base",
    }) ||
    a.nama_siswa.localeCompare(b.nama_siswa, "id", {
      numeric: true,
      sensitivity: "base",
    }),
  );

  const isiXlsx = await buatXlsxSiswa(baris);

  return new NextResponse(new Uint8Array(isiXlsx), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="data-siswa.xlsx"',
    },
  });
}
