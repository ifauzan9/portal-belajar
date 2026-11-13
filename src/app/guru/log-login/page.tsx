import Link from "next/link";
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

// Jumlah log per halaman. Data diambil bertahap dari server, bukan sekaligus.
const PER_HALAMAN = 50;

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
  token_ditutup_guru: "Login token ditutup guru",
  token_lewat_batas_jam: "Login token lewat jam tutup",
};

type LogRow = {
  id: string;
  siswa_id: string | null;
  username: string;
  berhasil: boolean;
  alasan: string | null;
  ip: string | null;
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

// URL halaman ini dengan filter + nomor halaman yang sedang aktif.
function buatUrlLog(opsi: {
  kelas: string;
  hasil: string;
  lokasi: string;
  halaman: number;
}) {
  const params = new URLSearchParams();
  if (opsi.kelas) params.set("kelas", opsi.kelas);
  if (opsi.hasil) params.set("hasil", opsi.hasil);
  if (opsi.lokasi) params.set("lokasi", opsi.lokasi);
  if (opsi.halaman > 1) params.set("halaman", String(opsi.halaman));
  const query = params.toString();
  return query ? `/guru/log-login?${query}` : "/guru/log-login";
}

// Nomor halaman yang ditampilkan: awal, akhir, dan sekitar halaman aktif.
// Bagian yang terlewat ditandai dengan elipsis.
function daftarHalaman(aktif: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const nomor = new Set<number>([1, total, aktif - 1, aktif, aktif + 1]);
  const urut = [...nomor]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);

  const hasil: (number | "…")[] = [];
  let sebelumnya = 0;
  for (const n of urut) {
    if (sebelumnya > 0 && n - sebelumnya > 1) hasil.push("…");
    hasil.push(n);
    sebelumnya = n;
  }
  return hasil;
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
  const halamanParam = Number(
    typeof searchParams.halaman === "string" ? searchParams.halaman : "1",
  );
  const halaman =
    Number.isFinite(halamanParam) && halamanParam >= 1
      ? Math.floor(halamanParam)
      : 1;

  // Daftar kelas untuk dropdown (jumlahnya kecil, aman diambil semua).
  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  const kelasList = (kelasData ?? []) as {
    id: string;
    nama_kelas: string;
  }[];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  // Filter kelas: ambil id siswa di kelas itu saja (bukan seluruh siswa).
  let idsKelas: string[] = [];
  if (kelasFilter) {
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("kelas_id", kelasFilter);
    idsKelas = ((data ?? []) as { id: string }[]).map((s) => s.id);
  }

  // Filter lokasi: cukup ambil kolom siswa_id dari siswa yang terlacak.
  // Datanya kecil (satu kolom), bukan seluruh baris lokasi.
  let lokasiSiap = true;
  let idsTerlacak: string[] = [];
  if (lokasiFilter) {
    const { data, error } = await supabase
      .from("lokasi_terakhir_siswa")
      .select("siswa_id")
      .eq("status", "diizinkan")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (error) {
      lokasiSiap = false;
    } else {
      idsTerlacak = ((data ?? []) as { siswa_id: string }[]).map(
        (l) => l.siswa_id,
      );
    }
  }

  // Filter yang pasti tidak menghasilkan baris: lewati query ke server.
  const kosongKarenaFilter =
    (kelasFilter !== "" && idsKelas.length === 0) ||
    (lokasiFilter === "terlacak" && idsTerlacak.length === 0);

  // Query data log dengan filter yang sama. Hitungan diambil terpisah lewat
  // queryHitung() agar halaman di luar batas tidak memicu error range.
  function queryDataLog() {
    let q = supabase
      .from("login_logs")
      .select(
        "id, siswa_id, username, berhasil, alasan, ip, created_at, students(nama_siswa, nis, kelas_id)",
      );

    if (hasilFilter === "berhasil") q = q.eq("berhasil", true);
    else if (hasilFilter === "gagal") q = q.eq("berhasil", false);

    if (kelasFilter) q = q.in("siswa_id", idsKelas);

    if (lokasiFilter === "terlacak") {
      q = q.in("siswa_id", idsTerlacak);
    } else if (lokasiFilter === "tidak_terlacak" && idsTerlacak.length > 0) {
      q = q.or(
        `siswa_id.is.null,siswa_id.not.in.(${idsTerlacak.join(",")})`,
      );
    }

    return q;
  }

  // Query hitung: hanya mengembalikan angka, bukan baris data.
  function queryHitung() {
    let q = supabase
      .from("login_logs")
      .select("id", { count: "exact", head: true });

    if (hasilFilter === "berhasil") q = q.eq("berhasil", true);
    else if (hasilFilter === "gagal") q = q.eq("berhasil", false);

    if (kelasFilter) q = q.in("siswa_id", idsKelas);

    if (lokasiFilter === "terlacak") {
      q = q.in("siswa_id", idsTerlacak);
    } else if (lokasiFilter === "tidak_terlacak" && idsTerlacak.length > 0) {
      q = q.or(
        `siswa_id.is.null,siswa_id.not.in.(${idsTerlacak.join(",")})`,
      );
    }

    return q;
  }

  const dari = (halaman - 1) * PER_HALAMAN;
  const sampai = dari + PER_HALAMAN - 1;

  let logs: LogRow[] = [];
  let totalLogs = 0;
  let galatLog: { message: string } | null = null;

  // Hitung dulu totalnya, baru ambil rentang halaman. Kalau langsung memakai
  // range di luar jumlah baris, PostgREST bisa membalas error "range not
  // satisfiable" dan halaman akan salah menampilkan pesan gagal.
  if (!kosongKarenaFilter) {
    const hasilHitung = await queryHitung();
    totalLogs = hasilHitung.count ?? 0;
    galatLog = hasilHitung.error;
  }

  const totalHalaman = Math.max(1, Math.ceil(totalLogs / PER_HALAMAN));

  // Kalau nomor halaman melewati batas (mis. URL lama), arahkan ke halaman
  // terakhir yang valid sebelum data halaman itu diambil.
  if (!galatLog && halaman > totalHalaman) {
    redirect(
      buatUrlLog({
        kelas: kelasFilter,
        hasil: hasilFilter,
        lokasi: lokasiFilter,
        halaman: totalHalaman,
      }),
    );
  }

  if (!galatLog && !kosongKarenaFilter) {
    const { data, error } = await queryDataLog()
      .order("created_at", { ascending: false })
      .range(dari, sampai);

    logs = (data ?? []) as unknown as LogRow[];
    galatLog = error;
  }

  // Statistik: total diambil dari count query, berhasil/gagal lewat count
  // terpisah supaya tidak perlu mengunduh semua baris.
  let totalBerhasil = 0;
  let totalGagal = 0;
  if (!galatLog && !kosongKarenaFilter) {
    if (hasilFilter === "berhasil") {
      totalBerhasil = totalLogs;
    } else if (hasilFilter === "gagal") {
      totalGagal = totalLogs;
    } else {
      const [hBerhasil, hGagal] = await Promise.all([
        queryHitung().eq("berhasil", true),
        queryHitung().eq("berhasil", false),
      ]);
      totalBerhasil = hBerhasil.count ?? 0;
      totalGagal = hGagal.count ?? 0;
    }
  }

  // Detail lokasi hanya untuk siswa yang muncul di halaman aktif.
  const siswaIdsHalaman = [
    ...new Set(
      logs
        .map((log) => log.siswa_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let petaLokasi = new Map<string, LokasiRow>();
  if (siswaIdsHalaman.length > 0) {
    const { data, error } = await supabase
      .from("lokasi_terakhir_siswa")
      .select("siswa_id, lat, lng, akurasi_m, status, diperbarui_at")
      .in("siswa_id", siswaIdsHalaman);

    if (error) {
      lokasiSiap = false;
    } else {
      petaLokasi = new Map(
        ((data ?? []) as LokasiRow[]).map((l) => [l.siswa_id, l]),
      );
    }
  }

  // "Lokasi terlacak" dihitung untuk halaman aktif saja.
  const totalTerlacak = logs.filter((log) => {
    const l = petaLokasi.get(log.siswa_id ?? "");
    return l?.status === "diizinkan" && l.lat !== null && l.lng !== null;
  }).length;

  const halamanAktif = Math.min(halaman, totalHalaman);

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
            Total
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {totalLogs}
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
            Lokasi terlacak (halaman ini)
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
          subjudul="Waktu ditampilkan dalam WIB (UTC+7). Kolom Lokasi = lokasi terakhir perangkat siswa. Menampilkan 50 percobaan per halaman."
        />

        {!lokasiSiap ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Fitur lokasi belum aktif: jalankan <code>schema.sql</code> Tahap 30
            (tabel <code>lokasi_terakhir_siswa</code>) di Supabase SQL Editor,
            lalu pastikan akun guru punya akses baca.
          </p>
        ) : null}

        {galatLog ? (
          <p className="mt-3 text-sm text-red-600">
            Gagal memuat log: {galatLog.message}. Pastikan schema.sql Tahap 18
            sudah dijalankan dan akun guru punya akses baca.
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

            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-slate-500">
                Halaman {halamanAktif} dari {totalHalaman} · {totalLogs} log
              </p>
              {totalHalaman > 1 ? (
                <nav
                  aria-label="Paginasi log login"
                  className="flex flex-wrap items-center justify-center gap-1.5"
                >
                  {halamanAktif > 1 ? (
                    <Link
                      href={buatUrlLog({
                        kelas: kelasFilter,
                        hasil: hasilFilter,
                        lokasi: lokasiFilter,
                        halaman: halamanAktif - 1,
                      })}
                      prefetch={false}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      ← Sebelumnya
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-300">
                      ← Sebelumnya
                    </span>
                  )}

                  {daftarHalaman(halamanAktif, totalHalaman).map((n, i) =>
                    n === "…" ? (
                      <span
                        key={`elipsis-${i}`}
                        className="px-1 text-sm text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <Link
                        key={n}
                        href={buatUrlLog({
                          kelas: kelasFilter,
                          hasil: hasilFilter,
                          lokasi: lokasiFilter,
                          halaman: n,
                        })}
                        aria-current={n === halamanAktif ? "page" : undefined}
                        prefetch={false}
                        className={`min-w-9 rounded-lg border px-3 py-1.5 text-center text-sm font-medium transition ${
                          n === halamanAktif
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </Link>
                    ),
                  )}

                  {halamanAktif < totalHalaman ? (
                    <Link
                      href={buatUrlLog({
                        kelas: kelasFilter,
                        hasil: hasilFilter,
                        lokasi: lokasiFilter,
                        halaman: halamanAktif + 1,
                      })}
                      prefetch={false}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Berikutnya →
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-300">
                      Berikutnya →
                    </span>
                  )}
                </nav>
              ) : null}
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
