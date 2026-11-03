import { cookies } from "next/headers";
import { SiswaSidebar } from "@/components/siswa-sidebar";
import { requireSiswa } from "@/lib/sesi-siswa";
import {
  NAMA_COOKIE_TAMPILAN,
  uraiCookieTampilan,
} from "@/lib/preferensi-siswa";

export default async function SiswaLayout({
  children,
}: LayoutProps<"/siswa">) {
  // Ambil sesi untuk menampilkan nama & kelas siswa di sidebar.
  // requireSiswa() akan redirect ke /login-siswa kalau belum login,
  // sehingga halaman siswa tidak pernah dirender tanpa sesi valid.
  const { siswa, kelas } = await requireSiswa();

  // Preferensi tampilan dibaca dari cookie di server, sehingga HTML pertama
  // sudah bertema benar (tanpa kedip) dan halaman guru/login tidak terpengaruh.
  const store = await cookies();
  const tampilan = uraiCookieTampilan(store.get(NAMA_COOKIE_TAMPILAN)?.value);

  return (
    // id="area-siswa" menjadi batas tema: mode gelap & ukuran teks hanya
    // berlaku di dalam elemen ini.
    <div
      id="area-siswa"
      data-tema={tampilan.efektif}
      data-ukuran={tampilan.ukuran}
      className="flex min-h-screen flex-col bg-slate-50 sm:flex-row"
    >
      <SiswaSidebar
        namaSiswa={siswa.nama_siswa}
        namaKelas={kelas?.nama_kelas ?? null}
      />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
