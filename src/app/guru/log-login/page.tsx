import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";
import { formatWaktuDetikWib } from "@/lib/waktu";
import {
  formatAkurasi,
  formatKoordinat,
  LABEL_STATUS_LOKASI,
  tautanPeta,
  type StatusLokasi,
} from "@/lib/lokasi";

// Waktu log selalu ditampilkan dalam WIB (UTC+7), bukan zona server.
function formatWaktu(iso: string | null): string {
  return formatWaktuDetikWib(iso);
}

const LABEL_ALASAN: Record<string, string> = {
  password_salah: "Password salah",
  akun_nonaktif: "Akun nonaktif",
  username_tidak_ditemukan: "Username tidak ditemukan",
  diblokir: "Diblokir (percobaan berlebih)",
  token_salah: "Token kelas salah",
  siswa_bukan_di_kelas: "Nama/kelas tidak cocok",
  token_kelas_belum_dibuat: "Token kelas belum dibuat",
  akun_belum_dibuat: "Akun belum dibuat",
};

type LogRow = {
  id: string;
  siswa_id: string | null;
  username: string;
  berhasil: boolean;
  alasan: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string | null;
  students?:
    | { nama_siswa: string; nis: string | null; kelas_id: string | null }
    | { nama_siswa: string; nis: string | null; kelas_id: string | null }[]
    | null;
};

type LokasiRow = {
  siswa_id: string;
  lat: number | null;
  lng: number | null;
  akurasi_m: number | null;
  status: string;
  diperbarui_at: string | null;
};

function bacaSiswa(log: LogRow): {
  nama_siswa: string;
  nis: string | null;
  kelas_id: string | null;
} {
  const data = log.students;
  if (!data) return { nama_siswa: "", nis: null, kelas_id: null };
  if (Array.isArray(data)) {
    return data[0] ?? { nama_siswa: "", nis: null, kelas_id: null };
  }
  return data;
}

// Bagian tabel "Lokasi": koordinat + akurasi + link Google Maps kalau
// lokasinya berhasil dilacak; kalau tidak, tampilkan alasannya.
//
// Lokasi dicatat saat siswa MEMBUKA DASHBOARD (bukan saat login), karena
// browser baru bisa dimintai izin setelah halaman terbuka. Karena itu waktu
// pencatatan ikut ditampilkan agar guru tidak salah tafsir.
function SelLokasi({ lokasi }: { lokasi: LokasiRow | undefined }) {
  if (!lokasi) {
    return <span className="text-slate-400">Belum dilacak</span>;
  }

  const waktu = lokasi.diperbarui_at
    ? formatWaktu(lokasi.diperbarui_at)
    : null;

  if (
    lokasi.status === "diizinkan" &&
    lokasi.lat !== null &&
    lokasi.lng !== null
  ) {
    return (
      <span className="flex flex-col gap-0.5">
        <a
          href={tautanPeta(lokasi.lat, lokasi.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-emerald-700 underline-offset-2 hover:underline"
        >
          {formatKoordinat(lokasi.lat, lokasi.lng)}
        </a>
        <span className="text-xs text-slate-400">
          {formatAkurasi(lokasi.akurasi_m)}
          {waktu ? ` · ${waktu}` : ""}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">
        {LABEL_STATUS_LOKASI[lokasi.status as StatusLokasi] ?? lokasi.status}
      </span>
      {waktu ? <span className="text-xs text-slate-400">{waktu}</span> : null}
    </span>
  );
}

export default async function LogLoginPage(
  props: PageProps<"/guru/log-login">,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const searchParams = await props.searchParams;
  const kelasFilter =
    typeof searchParams.kelas === "string" ? searchParams.kelas : "";
  const hasilFilter =
    typeof searchParams.hasil === "string" ? searchParams.hasil : "";
  const lokasiFilter =
    typeof searchParams.lokasi === "string" ? searchParams.lokasi : "";

  const [hasilKelas, hasilLog, hasilLokasi] = await Promise.all([
    supabase
      .from("classes")
      .select("id, nama_kelas")
      .order("nama_kelas", { ascending: true }),
    supabase
      .from("login_logs")
      .select(
        "id, siswa_id, username, berhasil, alasan, ip, user_agent, created_at, students(nama_siswa, nis, kelas_id)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    // Lokasi terakhir tiap siswa (satu baris per siswa). Tabel baru Tahap 30;
    // kalau DDL belum dijalankan, hasilnya kosong dan kolom tampil "Belum dilacak".
    supabase
      .from("lokasi_terakhir_siswa")
      .select("siswa_id, lat, lng, akurasi_m, status, diperbarui_at"),
  ]);

  const petaLokasi = new Map(
    ((hasilLokasi.data ?? []) as LokasiRow[]).map((l) => [l.siswa_id, l]),
  );

  // Tabel lokasi baru ada sejak Tahap 30. Kalau DDL belum dijalankan, beri
  // catatan singkat supaya guru tidak mengira semua siswa belum dilacak.
  const lokasiSiap = !hasilLokasi.error;

  const kelasList = (hasilKelas.data ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  let logs = (hasilLog.data ?? []) as unknown as LogRow[];

  if (kelasFilter) {
    logs = logs.filter((log) => bacaSiswa(log).kelas_id === kelasFilter);
  }
  if (hasilFilter === "berhasil") {
    logs = logs.filter((log) => log.berhasil);
  } else if (hasilFilter === "gagal") {
    logs = logs.filter((log) => !log.berhasil);
  }

  // Filter lokasi: "terlacak" = koordinat ada; "tidak_terlacak" = belum ada
  // baris lokasi atau statusnya izin ditolak/gagal.
  if (lokasiFilter === "terlacak") {
    logs = logs.filter((log) => {
      const l = petaLokasi.get(log.siswa_id ?? "");
      return l?.status === "diizinkan" && l.lat !== null && l.lng !== null;
    });
  } else if (lokasiFilter === "tidak_terlacak") {
    logs = logs.filter((log) => {
      const l = petaLokasi.get(log.siswa_id ?? "");
      return !(l?.status === "diizinkan" && l.lat !== null && l.lng !== null);
    });
  }

  const totalBerhasil = logs.filter((log) => log.berhasil).length;
  const totalGagal = logs.length - totalBerhasil;
  const totalTerlacak = logs.filter((log) => {
    const l = petaLokasi.get(log.siswa_id ?? "");
    return l?.status === "diizinkan" && l.lat !== null;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Log Login Siswa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau percobaan login siswa: waktu, status, alasan bila gagal, dan
          lokasi terakhir perangkat (akurasi bervariasi — lihat angka di kolom
          Lokasi).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Total (tampil)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {logs.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Berhasil
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
            {totalBerhasil}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Gagal
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-600">
            {totalGagal}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Lokasi terlacak
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-blue-600">
            {totalTerlacak}
          </p>
        </div>
      </div>

      <form
        method="get"
        action="/guru/log-login"
        className="flex flex-wrap items-end gap-2"
      >
        <div>
          <label
            htmlFor="kelas"
            className="block text-xs font-medium text-slate-500"
          >
            Kelas
          </label>
          <select
            id="kelas"
            name="kelas"
            defaultValue={kelasFilter}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua kelas</option>
            {kelasList.map((kelas) => (
              <option key={kelas.id} value={kelas.id}>
                {kelas.nama_kelas}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="hasil"
            className="block text-xs font-medium text-slate-500"
          >
            Status
          </label>
          <select
            id="hasil"
            name="hasil"
            defaultValue={hasilFilter}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua</option>
            <option value="berhasil">Berhasil</option>
            <option value="gagal">Gagal</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="lokasi"
            className="block text-xs font-medium text-slate-500"
          >
            Lokasi
          </label>
          <select
            id="lokasi"
            name="lokasi"
            defaultValue={lokasiFilter}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Semua</option>
            <option value="terlacak">Terlacak</option>
            <option value="tidak_terlacak">Belum / gagal</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Tampilkan
        </button>
      </form>

      <Kartu>
        <KartuJudul
          judul="Riwayat Login"
          subjudul="Waktu ditampilkan dalam WIB (UTC+7). Kolom Lokasi = lokasi terakhir perangkat siswa. Menampilkan maksimal 500 percobaan terbaru."
        />

        {!lokasiSiap ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Fitur lokasi belum aktif: jalankan <code>schema.sql</code> Tahap 30
            (tabel <code>lokasi_terakhir_siswa</code>) di Supabase SQL Editor.
          </p>
        ) : null}

        {hasilLog.error ? (
          <p className="mt-3 text-sm text-red-600">
            Gagal memuat log: {hasilLog.error.message}. Pastikan sudah
            menjalankan schema.sql Tahap 18.
          </p>
        ) : logs.length > 0 ? (
          <>
            <ul className="mt-3 space-y-2 lg:hidden">
              {logs.map((log) => {
                const siswaLog = bacaSiswa(log);
                return (
                  <li
                    key={log.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-medium text-slate-900">
                        {siswaLog.nama_siswa || "Tidak dikenal"}
                      </span>
                      {log.berhasil ? (
                        <Badge varian="sukses" titik>
                          Berhasil
                        </Badge>
                      ) : (
                        <Badge varian="bahaya" titik>
                          Gagal
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {log.username}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatWaktu(log.created_at)} · {log.ip ?? "–"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Lokasi: <SelLokasi lokasi={petaLokasi.get(log.siswa_id ?? "")} />
                    </p>
                    {!log.berhasil && log.alasan ? (
                      <p className="mt-1 text-xs text-red-600">
                        {LABEL_ALASAN[log.alasan] ?? log.alasan}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Waktu (WIB)", "Siswa", "Username", "Status", "Alasan", "IP", "Lokasi"].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-3 py-2 text-left font-medium text-slate-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const siswaLog = bacaSiswa(log);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                        {formatWaktu(log.created_at)}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {siswaLog.nama_siswa ? (
                          <>
                            {siswaLog.nama_siswa}
                            {siswaLog.nis ? (
                              <span className="ml-1 text-xs text-slate-400">
                                ({siswaLog.nis})
                              </span>
                            ) : null}
                            <span className="block text-xs text-slate-400">
                              {siswaLog.kelas_id
                                ? (namaKelas.get(siswaLog.kelas_id) ?? "-")
                                : "-"}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">Tidak dikenal</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">
                        {log.username}
                      </td>
                      <td className="px-3 py-2">
                        {log.berhasil ? (
                          <Badge varian="sukses" titik>
                            Berhasil
                          </Badge>
                        ) : (
                          <Badge varian="bahaya" titik>
                            Gagal
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {log.alasan
                          ? (LABEL_ALASAN[log.alasan] ?? log.alasan)
                          : "–"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">
                        {log.ip ?? "–"}
                      </td>
                      <td className="px-3 py-2">
                        <SelLokasi lokasi={petaLokasi.get(log.siswa_id ?? "")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <EmptyState
            padat
            ikon={<IkonBuku className="h-5 w-5" />}
            judul="Belum ada log"
            keterangan="Percobaan login siswa akan tercatat di sini."
          />
        )}
      </Kartu>
    </div>
  );
}
