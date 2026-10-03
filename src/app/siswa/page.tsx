import Link from "next/link";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { hitungRataRata, tampilkanRataRata } from "@/lib/rata-rata";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { sudahTampil } from "@/lib/jadwal-pengumuman";
import { tugasDibuka } from "@/lib/tugas";
import { JamRealtime } from "@/components/jam-realtime";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { KartuStat } from "@/components/ui/kartu-stat";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  IkonBuku,
  IkonGembok,
  IkonJam,
  IkonKomputer,
  IkonLab,
  IkonNilai,
  IkonPengumuman,
  IkonTugas,
} from "@/components/ui/ikon-siswa";

function tanggalPendek(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(t);
}

function tenggatPendek(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(t);
}

export default async function DashboardSiswaPage() {
  const { siswa, kelas } = await requireSiswa();

  const supabase = await createClient();

  // Jalankan semua query independen secara paralel untuk mengurangi
  // round-trip ke Supabase (login → dashboard jadi lebih cepat).
  const [
    hasilUlangan,
    hasilSubmit,
    hasilTugas,
    hasilTugasSubmit,
    hasilPengumuman,
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(
        "id, judul, kelas_id, tanggal, status, tenggat, durasi, nilai_ditampilkan, nilai_selesai, dibuka, exam_scores(nilai, siswa_id), exam_classes(kelas_id)",
      ),
    supabase
      .from("exam_submissions")
      .select("exam_id, nilai_total")
      .eq("siswa_id", siswa.id),
    supabase
      .from("assignments")
      .select("id, judul, tenggat, dibuka, created_at, assignment_classes(kelas_id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("assignment_submissions")
      .select("tugas_id")
      .eq("siswa_id", siswa.id),
    supabase
      .from("announcements")
      .select(
        "id, judul, isi, created_at, kelas_id, mulai_pada, announcement_classes(kelas_id)",
      ),
  ]);

  const mapSubmit = new Map(
    (hasilSubmit.data ?? []).map((s) => [
      (s as { exam_id: string }).exam_id,
      s as { nilai_total: number },
    ]),
  );

  const daftarUlangan = (hasilUlangan.data ?? [])
    .flatMap((u) => {
      const row = u as {
        id: string;
        judul: string;
        kelas_id: string | null;
        tanggal: string | null;
        status: "akan" | "sudah";
        tenggat: string | null;
        durasi: number | null;
        nilai_ditampilkan: boolean;
        nilai_selesai: boolean;
        dibuka: boolean | null;
        exam_scores?: { nilai: number; siswa_id: string }[];
        exam_classes?: { kelas_id: string }[];
      };

      const daftarKelasId = ambilKelasUlangan(row);
      const relevanUntukSiswa =
        daftarKelasId.length === 0 ||
        (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

      if (!relevanUntukSiswa) return [];

      const nilaiSiswaRaw = row.exam_scores?.find(
        (n) => n.siswa_id === siswa.id,
      )?.nilai ?? null;

      // Jika nilai ditahan, sembunyikan angka dari dashboard siswa.
      const nilaiTerbuka =
        row.nilai_ditampilkan === true || row.nilai_selesai === true;
      const nilaiSiswa =
        (row.status ?? "sudah") === "akan" && !nilaiTerbuka
          ? null
          : nilaiSiswaRaw;

      const statusRow = row.status ?? "sudah";
      // Kolom baru dibuka: null (DDL belum jalan) → anggap dibuka.
      const dibukaRow = row.dibuka !== false;
      const deadlineLewat =
        statusRow === "akan" && dibukaRow && tenggatSudahLewat(row.tenggat);
      const sudahSubmit = mapSubmit.has(row.id);

      return [
        {
          id: row.id,
          judul: row.judul,
          tanggal: row.tanggal,
          nilai: nilaiSiswa,
          status: statusRow,
          durasi: row.durasi ?? null,
          deadlineLewat,
          dibuka: dibukaRow,
          sudahSubmit,
        },
      ];
    });

  // Ulangan yang bisa dikerjakan (status "akan", belum submit, belum lewat,
  // dan dibuka oleh guru)
  const ulanganAktif = daftarUlangan.filter(
    (u) =>
      u.status === "akan" && !u.sudahSubmit && !u.deadlineLewat && u.dibuka,
  );

  const nilaiTerisi = daftarUlangan.filter((u) => u.nilai !== null);
  const rataSaya = hitungRataRata(
    nilaiTerisi.map((u) => u.nilai as number),
  );

  // Tugas yang menunggu dikerjakan: relevan untuk kelas siswa, belum
  // dikumpulkan, dan tenggatnya belum lewat (atau tanpa tenggat).
  const setTugasSubmit = new Set(
    (hasilTugasSubmit.data ?? []).map(
      (t) => (t as { tugas_id: string }).tugas_id,
    ),
  );

  const tugasMenunggu = (hasilTugas.data ?? []).flatMap((t) => {
    const row = t as {
      id: string;
      judul: string;
      tenggat: string | null;
      dibuka: boolean | null;
      assignment_classes?: { kelas_id: string }[];
    };

    const daftarKelasId =
      row.assignment_classes?.map((hub) => hub.kelas_id) ?? [];
    const relevan =
      daftarKelasId.length === 0 ||
      (siswa.kelas_id !== null && daftarKelasId.includes(siswa.kelas_id));

    if (!relevan) return [];
    // Tugas yang ditutup guru tidak bisa dikumpulkan → bukan "menunggu".
    if (!tugasDibuka(row)) return [];
    if (setTugasSubmit.has(row.id)) return [];
    if (tenggatSudahLewat(row.tenggat)) return [];

    return [{ id: row.id, judul: row.judul, tenggat: row.tenggat }];
  });

  // Pengumuman yang berlaku untuk kelas saya (atau semua kelas),
  // dan sudah waktunya tampil (pengumuman terjadwal disembunyikan).
  const pengumumanData = hasilPengumuman.data;

  const pengumumanRelevan = (pengumumanData ?? []).filter((p) => {
    const row = p as {
      kelas_id: string | null;
      mulai_pada: string | null;
      announcement_classes?: { kelas_id: string }[];
    };
    if (!sudahTampil(row.mulai_pada)) return false;
    // klasifikasi sederhana: kalau ada daftar kelas → harus termasuk kelas saya.
    // Kalau kosong → berlaku untuk semua kelas.
    if (!siswa.kelas_id) return row.announcement_classes?.length === 0;
    const adaDiHubungan = row.announcement_classes?.some(
      (c) => c.kelas_id === siswa.kelas_id,
    );
    return adaDiHubungan || row.announcement_classes?.length === 0;
  });

  const pengumumanTerbaru = pengumumanRelevan
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    )
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Halo, {siswa.nama_siswa}!
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {siswa.nis ? `NIS: ${siswa.nis} · ` : ""}
          Kelas: {kelas?.nama_kelas ?? "Belum ada kelas"}
        </p>
        <JamRealtime className="mt-1 block text-xs text-slate-400" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KartuStat
          label="Ulangan"
          nilai={daftarUlangan.length}
          catatan="Total ulanganmu"
          ikon={<IkonBuku className="h-4 w-4" />}
        />
        <KartuStat
          label="Sudah Dinilai"
          nilai={nilaiTerisi.length}
          catatan="Nilai tersedia"
          ikon={<IkonNilai className="h-4 w-4" />}
        />
        <KartuStat
          label="Rata-rata"
          nilai={tampilkanRataRata(rataSaya)}
          warna="emerald"
          catatan="Dari nilai tersedia"
          ikon={<IkonJam className="h-4 w-4" />}
        />
        <KartuStat
          label="Pengumuman"
          nilai={pengumumanRelevan.length}
          catatan="Untuk kelasmu"
          ikon={<IkonPengumuman className="h-4 w-4" />}
        />
      </div>

      {/* Ulangan aktif yang belum dikerjakan */}
      {ulanganAktif.length > 0 ? (
        <section className="rounded-2xl bg-blue-50 p-5 ring-1 ring-blue-100">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <IkonBuku className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-blue-900">
                Ulangan yang Menunggumu
              </h2>
              <p className="text-xs text-blue-600">
                {ulanganAktif.length} ulangan masih bisa dikerjakan.
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {ulanganAktif.map((u) => (
              <Link
                key={u.id}
                href={`/siswa/ulangan/${u.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-blue-100 transition hover:ring-blue-300"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {u.judul}
                  </span>
                  {u.durasi ? (
                    <Badge varian="peringatan" className="shrink-0">
                      ⏱ {u.durasi} mnt
                    </Badge>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs font-medium text-blue-600">
                  Kerjakan →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tugas yang menunggu dikerjakan */}
      {tugasMenunggu.length > 0 ? (
        <section className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <IkonTugas className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-amber-900">
                Tugas yang Menunggu
              </h2>
              <p className="text-xs text-amber-700">
                {tugasMenunggu.length} tugas belum dikumpulkan.
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {tugasMenunggu.map((t) => (
              <Link
                key={t.id}
                href={`/siswa/tugas/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-amber-100 transition hover:ring-amber-300"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {t.judul}
                  </span>
                  {t.tenggat ? (
                    <Badge varian="peringatan" className="shrink-0">
                      ⏰ {tenggatPendek(t.tenggat)}
                    </Badge>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs font-medium text-amber-700">
                  Kumpulkan →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Daftar nilai ringkas */}
      <Kartu>
        <KartuJudul
          judul="Nilai Ulangan"
          aksi={
            <Link
              href="/siswa/nilai"
              className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
            >
              Lihat semua →
            </Link>
          }
        />

        {daftarUlangan.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {daftarUlangan.slice(0, 5).map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-slate-700">
                  {u.judul}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {u.status === "akan" && !u.dibuka ? (
                    <Badge varian="bahaya">Ditutup guru</Badge>
                  ) : u.status === "akan" &&
                    !u.sudahSubmit &&
                    !u.deadlineLewat ? (
                    <Badge varian="info">Buka</Badge>
                  ) : u.status === "akan" && u.sudahSubmit ? (
                    <Badge varian="sukses">Selesai</Badge>
                  ) : null}
                  <span className="tabular-nums font-medium text-slate-700">
                    {u.nilai === null ? "–" : u.nilai}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            padat
            ikon={<IkonNilai className="h-5 w-5" />}
            judul="Belum ada ulangan"
            keterangan="Ulangan dari guru akan muncul di sini."
          />
        )}
      </Kartu>

      {/* Pengumuman terbaru */}
      <Kartu>
        <KartuJudul
          judul="Pengumuman Terbaru"
          aksi={
            <Link
              href="/siswa/pengumuman"
              className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
            >
              Lihat semua →
            </Link>
          }
        />

        {pengumumanTerbaru.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {pengumumanTerbaru.map((p) => {
              const row = p as {
                id: string;
                judul: string;
                created_at: string | null;
              };
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-slate-900">
                    {row.judul}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {tanggalPendek(row.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            padat
            ikon={<IkonPengumuman className="h-5 w-5" />}
            judul="Belum ada pengumuman"
            keterangan="Pengumuman untuk kelasmu akan muncul di sini."
          />
        )}
      </Kartu>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/siswa/nilai"
          className="group flex items-center gap-3 rounded-2xl bg-slate-900 p-5 text-white transition hover:bg-slate-700"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <IkonNilai className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Lihat Nilai</span>
            <span className="mt-0.5 block text-xs text-slate-300">
              Rincian nilai + grafik per ulangan.
            </span>
          </span>
        </Link>
        <Link
          href="/siswa/tugas"
          className="group flex items-center gap-3 rounded-2xl bg-blue-600 p-5 text-white transition hover:bg-blue-500"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <IkonTugas className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Lihat Tugas</span>
            <span className="mt-0.5 block text-xs text-blue-100">
              Kumpulkan lewat link, foto, atau dokumen.
            </span>
          </span>
        </Link>
        <Link
          href="/siswa/lab"
          className="group flex items-center gap-3 rounded-2xl bg-slate-700 p-5 text-white transition hover:bg-slate-600"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <IkonLab className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Lab Coding</span>
            <span className="mt-0.5 block text-xs text-slate-300">
              Latihan Python bertingkat di browser.
            </span>
          </span>
        </Link>
        <Link
          href="/siswa/komputer"
          className="group flex items-center gap-3 rounded-2xl bg-emerald-600 p-5 text-white transition hover:bg-emerald-500"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <IkonKomputer className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Lab Komputer</span>
            <span className="mt-0.5 block text-xs text-emerald-100">
              Praktik mouse &amp; klik, dinilai otomatis.
            </span>
          </span>
        </Link>
        <Link
          href="/siswa/ganti-password"
          className="group flex items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:ring-slate-400"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <IkonGembok className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              Ganti Password
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Ubah password akun kamu.
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
