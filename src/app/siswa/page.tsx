import Link from "next/link";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitungRataRata, tampilkanRataRata } from "@/lib/rata-rata";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";
import { sudahTampil } from "@/lib/jadwal-pengumuman";
import { tugasDibuka } from "@/lib/tugas";
import {
  formatTanggalJamPendekWib,
  formatTanggalWib,
} from "@/lib/waktu";
import { hitungProgresLab } from "@/lib/progres-lab";
import { JamRealtime } from "@/components/jam-realtime";
import { PelacakLokasi } from "@/components/pelacak-lokasi";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { KartuStat } from "@/components/ui/kartu-stat";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HeroSiswa, TombolHero } from "@/components/ui/hero-siswa";
import { ProgresBar } from "@/components/ui/progres";
import {
  IkonBuku,
  IkonDashboard,
  IkonGembok,
  IkonJam,
  IkonKomputer,
  IkonLab,
  IkonNilai,
  IkonPengumuman,
  IkonTugas,
} from "@/components/ui/ikon-siswa";

function tanggalPendek(iso: string | null): string {
  return formatTanggalWib(iso);
}

function tenggatPendek(iso: string | null): string {
  return formatTanggalJamPendekWib(iso);
}

export default async function DashboardSiswaPage() {
  const { siswa, kelas } = await requireSiswa();

  const supabase = await createClient();
  const admin = createAdminClient();

  // Jalankan semua query independen secara paralel untuk mengurangi
  // round-trip ke Supabase (login → dashboard jadi lebih cepat).
  const [
    hasilUlangan,
    hasilSubmit,
    hasilTugas,
    hasilTugasSubmit,
    hasilPengumuman,
    hasilLessonLab,
    hasilLatihanLab,
    hasilSelesaiLab,
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
    supabase
      .from("coding_lessons")
      .select("id, judul, urutan, coding_lesson_classes(kelas_id)"),
    supabase.from("coding_exercises").select("id, lesson_id"),
    admin
      .from("coding_submissions")
      .select("exercise_id")
      .eq("siswa_id", siswa.id)
      .eq("pernah_benar", true),
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

  // Progres Lab Coding (modul relevan untuk kelas siswa).
  const selesaiLabIds = new Set(
    (hasilSelesaiLab.data ?? []).map(
      (baris) => (baris as { exercise_id: string }).exercise_id,
    ),
  );

  const progresLab = hitungProgresLab(
    (hasilLessonLab.data ?? []) as {
      id: string;
      judul: string;
      urutan: number;
      coding_lesson_classes?: { kelas_id: string }[];
    }[],
    (hasilLatihanLab.data ?? []) as { id: string; lesson_id: string }[],
    selesaiLabIds,
    siswa.kelas_id,
  );

  // Modul yang sedang dikerjakan (sudah mulai, belum tuntas), maksimal 2.
  const modulBerjalan = progresLab.modul
    .filter((modul) => modul.total > 0 && modul.selesai > 0 && modul.selesai < modul.total)
    .slice(0, 2);

  const modulPertama = progresLab.modul.find((modul) => modul.total > 0) ?? null;

  const inisial = siswa.nama_siswa
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="space-y-6">
      {/* Catat lokasi perangkat untuk pemantauan guru (best-effort, senyap). */}
      <PelacakLokasi />

      <HeroSiswa
        label="Dashboard Siswa"
        judul={`Halo, ${siswa.nama_siswa}!`}
        subjudul={
          <>
            {siswa.nis ? `NIS ${siswa.nis} · ` : ""}
            Kelas {kelas?.nama_kelas ?? "belum ditentukan"}
            <JamRealtime className="mt-1 block text-xs text-emerald-100/80" />
          </>
        }
        ikon={
          <span className="text-lg font-bold tracking-tight">
            {inisial || <IkonDashboard className="h-5 w-5" />}
          </span>
        }
        aksi={
          <>
            <TombolHero href="/siswa/tugas">
              <IkonTugas className="h-4 w-4" />
              Kerjakan Tugas
            </TombolHero>
            <Link
              href="/siswa/lab"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-800/40 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-emerald-800/60"
            >
              <IkonLab className="h-4 w-4" />
              Lab Coding
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium text-white ring-1 ring-white/20">
            <IkonTugas className="h-3.5 w-3.5" />
            {tugasMenunggu.length} tugas menunggu
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium text-white ring-1 ring-white/20">
            <IkonBuku className="h-3.5 w-3.5" />
            {ulanganAktif.length} ulangan aktif
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium text-white ring-1 ring-white/20">
            <IkonJam className="h-3.5 w-3.5" />
            Rata-rata {tampilkanRataRata(rataSaya)}
          </span>
        </div>
      </HeroSiswa>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KartuStat
          label="Ulangan"
          nilai={daftarUlangan.length}
          catatan="Total ulanganmu"
          aksen="biru"
          ikon={<IkonBuku className="h-4 w-4" />}
        />
        <KartuStat
          label="Sudah Dinilai"
          nilai={nilaiTerisi.length}
          catatan="Nilai tersedia"
          aksen="emerald"
          ikon={<IkonNilai className="h-4 w-4" />}
        />
        <KartuStat
          label="Rata-rata"
          nilai={tampilkanRataRata(rataSaya)}
          warna="emerald"
          catatan="Dari nilai tersedia"
          aksen="ungu"
          ikon={<IkonJam className="h-4 w-4" />}
        />
        <KartuStat
          label="Pengumuman"
          nilai={pengumumanRelevan.length}
          catatan="Untuk kelasmu"
          aksen="amber"
          ikon={<IkonPengumuman className="h-4 w-4" />}
        />
      </div>

      {/* Progres Lab Coding */}
      {progresLab.modul.length > 0 ? (
        <Kartu className="border-l-4 border-l-emerald-500">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <IkonLab className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Progres Lab Coding
                </h2>
                <p className="text-xs text-slate-500">
                  {progresLab.totalSelesai} dari {progresLab.totalTantangan}{" "}
                  tantangan benar
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
              {progresLab.persen}%
            </p>
          </div>

          <ProgresBar
            nilai={progresLab.persen}
            label={`Progres lab coding ${progresLab.persen} persen`}
            className="mt-4"
          />

          <div className="mt-4 space-y-2">
            {modulBerjalan.length > 0 ? (
              modulBerjalan.map((modul) => (
                <Link
                  key={modul.id}
                  href={`/siswa/lab/${modul.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:ring-emerald-300"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {modul.judul}
                    </span>
                    <ProgresBar
                      nilai={modul.persen}
                      label={`Progres ${modul.judul}`}
                      ukuran="sm"
                      className="mt-1.5"
                    />
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-emerald-700">
                    {modul.selesai}/{modul.total} · Lanjutkan →
                  </span>
                </Link>
              ))
            ) : progresLab.persen === 100 ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
                🎉 Semua modul lab sudah tuntas. Kerja bagus!
              </p>
            ) : modulPertama ? (
              <Link
                href={`/siswa/lab/${modulPertama.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:ring-emerald-300"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                  Mulai dari: {modulPertama.judul}
                </span>
                <span className="shrink-0 text-xs font-semibold text-emerald-700">
                  Mulai →
                </span>
              </Link>
            ) : null}
          </div>
        </Kartu>
      ) : null}

      {/* Ulangan aktif yang belum dikerjakan */}
      {ulanganAktif.length > 0 ? (
        <section className="overflow-hidden rounded-2xl bg-blue-50 ring-1 ring-blue-100">
          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-100/60 px-5 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <IkonBuku className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-blue-900">
                Ulangan yang Menunggumu
              </h2>
              <p className="text-xs text-blue-700">
                {ulanganAktif.length} ulangan masih bisa dikerjakan.
              </p>
            </div>
          </div>
          <div className="space-y-2 p-4">
            {ulanganAktif.map((u) => (
              <Link
                key={u.id}
                href={`/siswa/ulangan/${u.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-blue-300"
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
                <span className="shrink-0 text-xs font-semibold text-blue-700">
                  Kerjakan →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tugas yang menunggu dikerjakan */}
      {tugasMenunggu.length > 0 ? (
        <section className="overflow-hidden rounded-2xl bg-amber-50 ring-1 ring-amber-100">
          <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-100/60 px-5 py-4">
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
          <div className="space-y-2 p-4">
            {tugasMenunggu.map((t) => (
              <Link
                key={t.id}
                href={`/siswa/tugas/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-amber-100 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-amber-300"
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
                <span className="shrink-0 text-xs font-semibold text-amber-700">
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
          subjudul="Ringkasan nilai terbaru"
          aksi={
            <Link
              href="/siswa/nilai"
              className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
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
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition hover:bg-emerald-50/60"
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
          subjudul="Kabar dari guru untuk kelasmu"
          aksi={
            <Link
              href="/siswa/pengumuman"
              className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
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
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition hover:bg-emerald-50/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                      <IkonPengumuman className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 truncate font-medium text-slate-900">
                      {row.judul}
                    </span>
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

      {/* Tautan cepat */}
      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Jelajahi
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/siswa/nilai"
            className="group flex items-center gap-3 rounded-2xl bg-slate-900 p-5 text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <IkonNilai className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Lihat Nilai</span>
              <span className="mt-0.5 block text-xs text-slate-300">
                Rincian nilai + grafik per ulangan.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white"
            >
              →
            </span>
          </Link>

          <Link
            href="/siswa/tugas"
            className="group flex items-center gap-3 rounded-2xl bg-blue-600 p-5 text-white transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/25"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <IkonTugas className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Lihat Tugas</span>
              <span className="mt-0.5 block text-xs text-blue-100">
                Kumpulkan lewat link, foto, atau dokumen.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-blue-200 transition group-hover:translate-x-0.5 group-hover:text-white"
            >
              →
            </span>
          </Link>

          <Link
            href="/siswa/lab"
            className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-600/25"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <IkonLab className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Lab Coding</span>
              <span className="mt-0.5 block text-xs text-emerald-50">
                Latihan Python bertingkat di browser.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-emerald-100 transition group-hover:translate-x-0.5 group-hover:text-white"
            >
              →
            </span>
          </Link>

          <Link
            href="/siswa/komputer"
            className="group flex items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <IkonKomputer className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                Lab Komputer
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Praktik mouse &amp; klik, dinilai otomatis.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600"
            >
              →
            </span>
          </Link>

          <Link
            href="/siswa/absensi"
            className="group flex items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <IkonJam className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                Absensi
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Riwayat kehadiranmu per tanggal.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600"
            >
              →
            </span>
          </Link>

          <Link
            href="/siswa/profil"
            className="group flex items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <IkonGembok className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                Profil &amp; Password
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Identitas, kelas, ganti password, dan tampilan.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
