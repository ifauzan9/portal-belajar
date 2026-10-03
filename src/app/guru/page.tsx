import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JamRealtime } from "@/components/jam-realtime";

type IkonProps = { className?: string };

function IkonKelas({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M8 21h8M12 17v4" />
      <path d="M7 9h6M7 12h3" />
    </svg>
  );
}

function IkonSiswa({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 2 8l10 5 10-5-10-5Z" />
      <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
      <path d="M22 8v5" />
    </svg>
  );
}

function IkonUlangan({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function IkonAbsensi({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

function IkonPengumuman({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M14 8a5 5 0 0 1 0 8" />
      <path d="M17 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function IkonStatistik({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function IkonTugas({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M15 4v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IkonLab({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
      <path d="M13 5 11 19" />
    </svg>
  );
}

function IkonLog({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function IkonKomputer({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function IkonPerhatian({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IkonPanah({ className }: IkonProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Stat({
  label,
  nilai,
  catatan,
  perhatian = false,
  Ikon,
}: {
  label: string;
  nilai: number;
  catatan: string;
  perhatian?: boolean;
  Ikon: (props: IkonProps) => React.JSX.Element;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-emerald-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            perhatian
              ? "bg-amber-100 text-amber-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <Ikon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          perhatian ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {nilai}
      </p>
      <p
        className={`mt-1 text-xs ${
          perhatian ? "text-amber-700" : "text-slate-400"
        }`}
      >
        {catatan}
      </p>
    </div>
  );
}

function KartuMenu({
  href,
  judul,
  deskripsi,
  Ikon,
}: {
  href: string;
  judul: string;
  deskripsi: string;
  Ikon: (props: IkonProps) => React.JSX.Element;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-900/5 hover:ring-emerald-300"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
          <Ikon className="h-5 w-5" />
        </span>
        <IkonPanah className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
      </div>
      <h2 className="mt-4 font-semibold text-slate-900">{judul}</h2>
      <p className="mt-1 text-sm text-slate-500">{deskripsi}</p>
    </Link>
  );
}

export default async function GuruPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [hasilKelas, hasilSiswa, hasilUlangan, hasilTugas] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id, nis, kelas_id"),
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("assignments").select("id", { count: "exact", head: true }),
  ]);

  const jumlahKelas = hasilKelas.count ?? 0;
  const jumlahUlangan = hasilUlangan.count ?? 0;
  const jumlahTugas = hasilTugas.count ?? 0;
  const siswa = hasilSiswa.data ?? [];
  const jumlahSiswa = siswa.length;
  const tanpaNis = siswa.filter((item) => !(item.nis ?? "").trim()).length;
  const tanpaKelas = siswa.filter((item) => !item.kelas_id).length;

  const galat =
    hasilKelas.error?.message ??
    hasilSiswa.error?.message ??
    hasilUlangan.error?.message ??
    hasilTugas.error?.message ??
    null;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 py-7 text-white shadow-sm shadow-emerald-900/20">
        <JamRealtime className="text-xs font-medium tracking-wide text-emerald-100 uppercase" />
        <h1 className="mt-1 text-2xl font-semibold">Portal Pembelajaran</h1>
        <p className="mt-1 text-sm text-emerald-100">Selamat datang, Pak Guru</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Kelas"
          nilai={jumlahKelas}
          catatan="Kelas terdaftar"
          Ikon={IkonKelas}
        />
        <Stat
          label="Siswa"
          nilai={jumlahSiswa}
          catatan="Semua siswa"
          Ikon={IkonSiswa}
        />
        <Stat
          label="Ulangan"
          nilai={jumlahUlangan}
          catatan="Ulangan dibuat"
          Ikon={IkonUlangan}
        />
        <Stat
          label="Tugas"
          nilai={jumlahTugas}
          catatan="Tugas dibuat"
          Ikon={IkonTugas}
        />
        <Stat
          label="Tanpa NIS"
          nilai={tanpaNis}
          perhatian={tanpaNis > 0}
          catatan={
            tanpaNis > 0
              ? "Isi lewat Data Siswa → Ubah"
              : "Semua sudah punya NIS"
          }
          Ikon={IkonPerhatian}
        />
        <Stat
          label="Tanpa kelas"
          nilai={tanpaKelas}
          perhatian={tanpaKelas > 0}
          catatan={
            tanpaKelas > 0
              ? "Pilih kelas di Data Siswa"
              : "Semua sudah punya kelas"
          }
          Ikon={IkonPerhatian}
        />
      </div>

      {galat ? (
        <p className="text-sm text-red-600">
          Gagal memuat ringkasan: {galat}
        </p>
      ) : null}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Menu Cepat
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KartuMenu
            href="/guru/kelas"
            judul="Kelola Kelas"
            deskripsi="Lihat, tambah, ubah, dan hapus kelas."
            Ikon={IkonKelas}
          />
          <KartuMenu
            href="/guru/siswa"
            judul="Data Siswa"
            deskripsi="Lihat, tambah, ubah, dan hapus siswa."
            Ikon={IkonSiswa}
          />
          <KartuMenu
            href="/guru/absensi"
            judul="Absensi"
            deskripsi="Catat kehadiran siswa per kelas dan lihat rekapnya."
            Ikon={IkonAbsensi}
          />
          <KartuMenu
            href="/guru/pengumuman"
            judul="Papan Pengumuman"
            deskripsi="Tulis dan kelola pengumuman untuk siswa."
            Ikon={IkonPengumuman}
          />
          <KartuMenu
            href="/guru/ulangan"
            judul="Ulangan"
            deskripsi="Tambah ulangan dan input nilai siswa per kelas."
            Ikon={IkonUlangan}
          />
          <KartuMenu
            href="/guru/tugas"
            judul="Tugas"
            deskripsi="Beri tugas; siswa kumpulkan lewat link, foto, atau dokumen."
            Ikon={IkonTugas}
          />
          <KartuMenu
            href="/guru/lab"
            judul="Lab Coding"
            deskripsi="Latihan Python bertingkat; siswa ngoding langsung di browser."
            Ikon={IkonLab}
          />
          <KartuMenu
            href="/guru/komputer"
            judul="Lab Komputer"
            deskripsi="Praktik dasar komputer (mouse, klik, drag) dengan nilai otomatis."
            Ikon={IkonKomputer}
          />
          <KartuMenu
            href="/guru/statistik"
            judul="Statistik"
            deskripsi="Papan grafik rekap nilai dan distribusi per kelas."
            Ikon={IkonStatistik}
          />
          <KartuMenu
            href="/guru/log-login"
            judul="Log Login"
            deskripsi="Pantau riwayat login siswa beserta status dan alasannya."
            Ikon={IkonLog}
          />
        </div>
      </div>
    </div>
  );
}