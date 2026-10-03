import Link from "next/link";
import { redirect } from "next/navigation";
import { PanelKredensialSiswa } from "@/components/import-kredensial";
import { createClient } from "@/lib/supabase/server";

export default async function KredensialSiswaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/siswa"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Data Siswa
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Kredensial Login Siswa
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Import massal dari Excel atau buat otomatis untuk semua siswa tanpa
          akun.
        </p>
      </div>

      <PanelKredensialSiswa daftarKelas={kelasData ?? []} />
    </div>
  );
}
