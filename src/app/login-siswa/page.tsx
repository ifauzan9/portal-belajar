import { LoginSiswaTabs } from "@/components/login-siswa-tabs";
import { createAdminClient } from "@/lib/supabase/admin";

type Kelas = { id: string; nama_kelas: string };
type Siswa = {
  id: string;
  nama_siswa: string;
  nis: string | null;
  kelas_id: string | null;
};

// Daftar kelas + siswa untuk dropdown login token. Dibaca di server
// (service-role) supaya tabel siswa tidak perlu dibuka ke browser.
export default async function LoginSiswaPage() {
  let kelasList: Kelas[] = [];
  let siswaList: Siswa[] = [];

  try {
    const admin = createAdminClient();
    const [hasilKelas, hasilSiswa] = await Promise.all([
      admin
        .from("classes")
        .select("id, nama_kelas")
        .order("nama_kelas", { ascending: true }),
      admin
        .from("students")
        .select("id, nama_siswa, nis, kelas_id")
        .not("kelas_id", "is", null)
        .order("nama_siswa", { ascending: true }),
    ]);
    kelasList = (hasilKelas.data ?? []) as Kelas[];
    siswaList = (hasilSiswa.data ?? []) as Siswa[];
  } catch (err) {
    console.error("Gagal memuat data untuk login siswa:", err);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <LoginSiswaTabs kelasList={kelasList} siswaList={siswaList} />
    </div>
  );
}