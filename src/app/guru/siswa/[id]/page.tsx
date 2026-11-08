import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Notifikasi } from "@/components/ui/notifikasi";
import {
  formatAkurasi,
  formatKoordinat,
  LABEL_STATUS_LOKASI,
  statusLokasiValid,
  tautanPeta,
} from "@/lib/lokasi";
import { requireGuru } from "@/lib/require-guru";
import { formatTanggalWib, formatWaktuDetikWib } from "@/lib/waktu";

// ============================================================================
// Detail satu siswa untuk guru: identitas, lokasi terakhir, dan riwayat
// lokasi perangkat. Riwayat hanya ditampilkan di halaman guru ini.
//
// Lokasi dicatat best-effort dari browser siswa saat dashboard dibuka. Kalau
// izin browser dicabut, pencatatan baru berhenti tetapi riwayat lama tetap ada.
// ============================================================================

const PER_HALAMAN = 50;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type SiswaRow = {
  id: string;
  nis: string | null;
  nama_siswa: string;
  kelas_id: string | null;
  created_at: string | null;
};

type LokasiTerakhirRow = {
  lat: number | null;
  lng: number | null;
  akurasi_m: number | null;
  status: string;
  diperbarui_at: string | null;
};

type RiwayatLokasiRow = {
  id: string;
  lat: number;
  lng: number;
  akurasi_m: number | null;
  dicatat_at: string;
};

function buatUrlHalaman(id: string, halaman: number): string {
  return halaman > 1
    ? `/guru/siswa/${id}?halaman=${halaman}`
    : `/guru/siswa/${id}`;
}

function labelStatus(status: string): string {
  return statusLokasiValid(status) ? LABEL_STATUS_LOKASI[status] : status;
}

function keteranganStatusLokasi(status: string): string {
  if (status === "ditolak") {
    return "Siswa belum mengizinkan akses lokasi di browser.";
  }
  if (status === "tidak_didukung") {
    return "Browser siswa tidak mendukung lokasi atau halaman tidak diakses lewat HTTPS.";
  }
  if (status === "gagal") {
    return "Lokasi gagal dibaca dari perangkat siswa.";
  }
  if (status === "diizinkan") {
    return "Koordinat lokasi belum tersedia.";
  }
  return "Lokasi tidak tersedia.";
}

function BadgeLokasi({ status }: { status: string }) {
  const label = labelStatus(status);

  if (status === "diizinkan") {
    return (
      <Badge varian="sukses" titik>
        {label}
      </Badge>
    );
  }
  if (status === "ditolak") {
    return (
      <Badge varian="bahaya" titik>
        {label}
      </Badge>
    );
  }
  if (status === "tidak_didukung") {
    return (
      <Badge varian="peringatan" titik>
        {label}
      </Badge>
    );
  }
  return <Badge varian="netral" titik>{label}</Badge>;
}

export default async function DetailSiswaPage(props: Props) {
  const supabase = await requireGuru();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const halamanParam = Number(
    typeof searchParams.halaman === "string" ? searchParams.halaman : "1",
  );
  const halaman =
    Number.isFinite(halamanParam) && halamanParam >= 1
      ? Math.floor(halamanParam)
      : 1;

  const { data: siswaData } = await supabase
    .from("students")
    .select("id, nis, nama_siswa, kelas_id, created_at")
    .eq("id", id)
    .maybeSingle();

  const siswa = siswaData as SiswaRow | null;
  if (!siswa) {
    notFound();
  }

  let namaKelas = "Belum ada kelas";
  if (siswa.kelas_id) {
    const { data: kelasData } = await supabase
      .from("classes")
      .select("nama_kelas")
      .eq("id", siswa.kelas_id)
      .maybeSingle();
    const kelas = kelasData as { nama_kelas: string } | null;
    namaKelas = kelas?.nama_kelas ?? "Kelas tak ditemukan";
  }

  const dari = (halaman - 1) * PER_HALAMAN;
  const sampai = dari + PER_HALAMAN - 1;

  const [hasilLokasi, hasilHitung] = await Promise.all([
    supabase
      .from("lokasi_terakhir_siswa")
      .select("lat, lng, akurasi_m, status, diperbarui_at")
      .eq("siswa_id", siswa.id)
      .maybeSingle(),
    supabase
      .from("lokasi_riwayat_siswa")
      .select("id", { count: "exact", head: true })
      .eq("siswa_id", siswa.id),
  ]);

  const lokasi = hasilLokasi.data as LokasiTerakhirRow | null;
  const totalRiwayat = hasilHitung.count ?? 0;
  const totalHalaman = Math.max(1, Math.ceil(totalRiwayat / PER_HALAMAN));

  // URL halaman lama yang melewati batas diarahkan ke halaman terakhir yang
  // masih ada. Kalau tabel riwayat belum dibuat, biarkan halaman menampilkan
  // catatan schema agar tidak terjadi redirect loop.
  if (!hasilHitung.error && halaman > totalHalaman) {
    redirect(buatUrlHalaman(siswa.id, totalHalaman));
  }

  // Hitung dulu totalnya, baru ambil rentang halaman. Kalau langsung memakai
  // range di luar jumlah baris, PostgREST bisa membalas error "range not
  // satisfiable" dan halaman akan salah mengira tabel belum dibuat.
  let riwayat: RiwayatLokasiRow[] = [];
  let galatRiwayat = hasilHitung.error;

  if (!galatRiwayat) {
    const hasilRiwayat = await supabase
      .from("lokasi_riwayat_siswa")
      .select("id, lat, lng, akurasi_m, dicatat_at")
      .eq("siswa_id", siswa.id)
      .order("dicatat_at", { ascending: false })
      .range(dari, sampai);

    riwayat = (hasilRiwayat.data ?? []) as RiwayatLokasiRow[];
    galatRiwayat = hasilRiwayat.error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/siswa"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Data Siswa
        </Link>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-slate-900">
              {siswa.nama_siswa}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {siswa.nis ? `NIS ${siswa.nis} · ` : ""}
              {namaKelas}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Terdaftar sejak {formatTanggalWib(siswa.created_at)}
            </p>
          </div>

          <Link
            href={`/guru/rekap/${siswa.id}`}
            className="w-fit rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            Lihat rekap kegiatan →
          </Link>
        </div>
      </div>

      <Kartu>
        <KartuJudul
          judul="Lokasi Terakhir"
          subjudul="Lokasi perangkat yang terakhir berhasil dibaca dari browser siswa."
          aksi={lokasi ? <BadgeLokasi status={lokasi.status} /> : null}
        />

        <div className="mt-4">
          {hasilLokasi.error ? (
            <Notifikasi varian="peringatan" judul="Fitur lokasi belum aktif">
              Jalankan <code>schema.sql</code> Tahap 30 di Supabase, lalu
              pastikan akun guru punya akses baca, agar lokasi terakhir siswa
              bisa ditampilkan.
            </Notifikasi>
          ) : !lokasi ? (
            <p className="text-sm text-slate-500">
              Belum ada data lokasi untuk siswa ini.
            </p>
          ) : lokasi.status === "diizinkan" &&
            lokasi.lat !== null &&
            lokasi.lng !== null ? (
            <div className="flex flex-col gap-1">
              <a
                href={tautanPeta(lokasi.lat, lokasi.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-emerald-700 underline-offset-2 hover:underline"
              >
                {formatKoordinat(lokasi.lat, lokasi.lng)}
              </a>
              <p className="text-xs text-slate-500">
                {formatAkurasi(lokasi.akurasi_m)} ·{" "}
                {formatWaktuDetikWib(lokasi.diperbarui_at)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-slate-700">
                {keteranganStatusLokasi(lokasi.status)}
              </p>
              <p className="text-xs text-slate-500">
                Terakhir dicoba: {formatWaktuDetikWib(lokasi.diperbarui_at)}
              </p>
            </div>
          )}
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul
          judul="Riwayat Lokasi"
          subjudul="Dicatat setiap siswa membuka dashboard dan mengizinkan akses lokasi browser."
        />

        <div className="mt-4">
          {galatRiwayat ? (
            <Notifikasi varian="peringatan" judul="Riwayat lokasi belum aktif">
              Jalankan <code>schema.sql</code> Tahap 40 di Supabase, lalu
              pastikan akun guru punya akses baca, agar riwayat lokasi siswa
              bisa ditampilkan.
            </Notifikasi>
          ) : riwayat.length === 0 ? (
            <EmptyState
              padat
              judul="Belum ada riwayat lokasi"
              keterangan={
                lokasi?.status === "ditolak"
                  ? "Siswa belum mengizinkan akses lokasi di browser."
                  : "Riwayat muncul setelah siswa membuka dashboard dengan izin lokasi browser."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {["Waktu (WIB)", "Koordinat", "Akurasi"].map((judul) => (
                        <th
                          key={judul}
                          scope="col"
                          className="px-3 py-2 text-left font-medium text-slate-500"
                        >
                          {judul}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {riwayat.map((baris) => (
                      <tr key={baris.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                          {formatWaktuDetikWib(baris.dicatat_at)}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={tautanPeta(baris.lat, baris.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-emerald-700 underline-offset-2 hover:underline"
                          >
                            {formatKoordinat(baris.lat, baris.lng)}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {formatAkurasi(baris.akurasi_m)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xs text-slate-500">
                  Halaman {halaman} dari {totalHalaman} · {totalRiwayat} riwayat
                </p>

                {totalHalaman > 1 ? (
                  <nav
                    aria-label="Paginasi riwayat lokasi"
                    className="flex items-center gap-1.5"
                  >
                    {halaman > 1 ? (
                      <Link
                        href={buatUrlHalaman(siswa.id, halaman - 1)}
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

                    {halaman < totalHalaman ? (
                      <Link
                        href={buatUrlHalaman(siswa.id, halaman + 1)}
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
          )}
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Data lokasi hanya dapat dilihat melalui akun guru. Riwayat lama tetap
          tersimpan meskipun izin lokasi browser siswa dicabut.
        </p>
      </Kartu>
    </div>
  );
}