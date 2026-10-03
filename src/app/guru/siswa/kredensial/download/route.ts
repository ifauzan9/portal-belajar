import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buatXlsxKredensial, type BarisKredensialExport } from "@/lib/export-kredensial";

// Unduh kredensial siswa sebagai file .xlsx
// (Nama, NIS, Username, Password). Hanya bisa diakses guru yang sudah login.
//
// Data dikirim via form POST dari halaman kredensial setelah tombol
// "Buat Sekarang". Password plaintext ikut terisi di kolom "Password"
// karena memang tujuan distribusi ke siswa. File hanya berisi baris
// yang baru dibuat / yang dikirim dari client.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let rows: BarisKredensialExport[];
  try {
    const body = await request.json();
    rows = Array.isArray(body?.rows) ? body.rows : [];
  } catch {
    return NextResponse.json(
      { pesan: "Data tidak valid." },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { pesan: "Tidak ada kredensial untuk diunduh." },
      { status: 400 },
    );
  }

  // Batasi maksimal 1000 baris (sesuai aturan import).
  if (rows.length > 1000) {
    rows = rows.slice(0, 1000);
  }

  const buffer = await buatXlsxKredensial(rows);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="kredensial-siswa.xlsx"',
    },
  });
}
