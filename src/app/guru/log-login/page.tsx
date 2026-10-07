import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonBuku } from "@/components/ui/ikon-siswa";

function formatWaktu(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(t);
}

const LABEL_ALASAN: Record<string, string> = {
  password_salah: "Password salah",
  akun_nonaktif: "Akun nonaktif",
  username_tidak_ditemukan: "Username tidak ditemukan",
  diblokir: "Diblokir (percobaan berlebih)",
  token_salah: "Token kelas salah",
  siswa_bukan_di_kelas: "Nama/kelas tidak cocok",
  token_kelas_belum_dibuat: "Token kelas belum dibuat",
};

type LogRow = {
  id: string;
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

  const [hasilKelas, hasilLog] = await Promise.all([
    supabase
      .from("classes")
      .select("id, nama_kelas")
      .order("nama_kelas", { ascending: true }),
    supabase
      .from("login_logs")
      .select(
        "id, username, berhasil, alasan, ip, user_agent, created_at, students(nama_siswa, nis, kelas_id)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

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

  const totalBerhasil = logs.filter((log) => log.berhasil).length;
  const totalGagal = logs.length - totalBerhasil;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Log Login Siswa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau percobaan login siswa: waktu, status, dan alasan bila gagal.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
          subjudul="Menampilkan maksimal 500 percobaan terbaru"
        />

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
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Waktu", "Siswa", "Username", "Status", "Alasan", "IP"].map(
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
