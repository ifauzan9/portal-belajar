import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hitungRataRata, tampilkanRataRata } from "@/lib/rata-rata";
import { ambilKelasUlangan } from "@/lib/ambil-kelas-ulangan";

type KelasRow = { id: string; nama_kelas: string };
type UlanganRow = {
  id: string;
  judul: string;
  // Daftar id kelas (gabungan legacy + relasi). [] = semua kelas.
  daftarKelasId: string[];
  tanggal: string | null;
  exam_scores?: { nilai: number }[];
};

// Rentang nilai untuk grafik distribusi.
const REENTANG_NILAI = [
  { label: "0–49", min: 0, max: 49 },
  { label: "50–69", min: 50, max: 69 },
  { label: "70–89", min: 70, max: 89 },
  { label: "90–100", min: 90, max: 100 },
];

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

function KartuStat({
  label,
  nilai,
  warna = "text-slate-900",
}: {
  label: string;
  nilai: string;
  warna?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warna}`}>
        {nilai}
      </p>
    </div>
  );
}

// Batang horizontal. Lebar dihitung dari proporsi (0–100 untuk nilai,
// atau jumlah/total untuk distribusi).
function Batang({
  label,
  teks,
  proporsi,
  warna,
}: {
  label: string;
  teks: string;
  proporsi: number; // 0–1
  warna: string;
}) {
  const lebar = Math.min(100, Math.max(0, proporsi * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
        <div
          className={`h-full ${warna} transition-all`}
          style={{ width: `${lebar}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-slate-600">
        {teks}
      </span>
    </div>
  );
}

export default async function StatistikPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [hasilKelas, hasilUlangan] = await Promise.all([
    supabase.from("classes").select("id, nama_kelas").order("nama_kelas"),
    supabase
      .from("exams")
      .select("id, judul, kelas_id, tanggal, exam_scores(nilai), exam_classes(kelas_id)"),
  ]);

  const kelasList: KelasRow[] = hasilKelas.data ?? [];
  const namaKelas = new Map(kelasList.map((k) => [k.id, k.nama_kelas]));

  // Mapping: ulangan id → daftar kelas id (gabungan legacy + relasi)
  const ulanganDaftar: UlanganRow[] = (hasilUlangan.data ?? []).map(
    (row) => {
      const dataRow = row as {
        id: string;
        judul: string;
        kelas_id: string | null;
        tanggal: string | null;
        exam_scores?: { nilai: number }[];
        exam_classes?: { kelas_id: string }[];
      };
      return {
        id: dataRow.id,
        judul: dataRow.judul,
        daftarKelasId: ambilKelasUlangan(dataRow),
        tanggal: dataRow.tanggal,
        exam_scores: dataRow.exam_scores,
      };
    },
  );

  const galat =
    hasilKelas.error?.message ?? hasilUlangan.error?.message ?? null;

  // ---------- Ringkasan global ----------
  const semuaNilai = ulanganDaftar.flatMap((u) =>
    (u.exam_scores ?? []).map((n) => n.nilai),
  );
  const rataGlobal = hitungRataRata(semuaNilai);
  const tertinggiGlobal = semuaNilai.length ? Math.max(...semuaNilai) : null;
  const terendahGlobal = semuaNilai.length ? Math.min(...semuaNilai) : null;

  // ---------- Statistik per ulangan (yang sudah punya nilai) ----------
  const perUlangan = ulanganDaftar
    .map((u) => {
      const nilai = (u.exam_scores ?? []).map((n) => n.nilai);
      return {
        id: u.id,
        judul: u.judul,
        daftarKelasId: u.daftarKelasId,
        tanggal: u.tanggal,
        rata: hitungRataRata(nilai),
        tertinggi: nilai.length ? Math.max(...nilai) : null,
        terendah: nilai.length ? Math.min(...nilai) : null,
        jumlahSiswa: nilai.length,
      };
    })
    .filter((u) => u.jumlahSiswa > 0);

  // ---------- Distribusi nilai per kelas ----------
  // Sebuah ulangan multi-kelas ikut dihitung di tiap kelas yang
  // dicakupnya (nilai ulangan itu masuk ke distribusi kelas tersebut).
  // Ulangan tanpa kelas ("semua kelas") tidak masuk ke distribusi
  // per kelas (sudah dihitung di ringkasan global).
  const distribusiPerKelas = kelasList.map((kelas) => {
    const nilaiKelas = ulanganDaftar
      .filter((u) => u.daftarKelasId.includes(kelas.id))
      .flatMap((u) => (u.exam_scores ?? []).map((n) => n.nilai));
    const total = nilaiKelas.length;
    const rentang = REENTANG_NILAI.map((r) => ({
      label: r.label,
      jumlah: nilaiKelas.filter((n) => n >= r.min && n <= r.max).length,
    }));
    return { kelas, total, rata: hitungRataRata(nilaiKelas), rentang };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Papan Statistik
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Rekap nilai ulangan dan distribusi per kelas.
        </p>
      </div>

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat statistik: {galat}</p>
      ) : null}

      {/* Ringkasan global */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KartuStat label="Ulangan dinilai" nilai={String(perUlangan.length)} />
        <KartuStat
          label="Rata-rata global"
          nilai={tampilkanRataRata(rataGlobal)}
        />
        <KartuStat
          label="Nilai tertinggi"
          nilai={tertinggiGlobal === null ? "–" : String(tertinggiGlobal)}
          warna="text-emerald-600"
        />
        <KartuStat
          label="Nilai terendah"
          nilai={terendahGlobal === null ? "–" : String(terendahGlobal)}
          warna="text-red-600"
        />
      </div>

      {/* Grafik batang per ulangan */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          Rata-rata per Ulangan
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Batang rata-rata, tertinggi, dan terendah (skala 0–100).
        </p>

        {perUlangan.length > 0 ? (
          <div className="mt-4 space-y-5">
            {perUlangan.map((u) => (
              <div key={u.id}>
                <div className="flex items-center justify-between text-xs">
                  <Link
                    href={`/guru/ulangan/${u.id}/nilai`}
                    className="font-medium text-slate-700 transition hover:text-slate-900"
                  >
                    {u.judul}
                  </Link>
                  <span className="text-slate-400">
                    {u.daftarKelasId.length === 0
                      ? "Semua kelas"
                      : u.daftarKelasId
                          .map(
                            (idK) =>
                              namaKelas.get(idK) ??
                              "Kelas tak ditemukan",
                          )
                          .join(", ")}{" "}
                    · {tanggalPendek(u.tanggal)}
                  </span>
                </div>

                <div className="mt-2 space-y-1.5">
                  <Batang
                    label="Rata-rata"
                    teks={tampilkanRataRata(u.rata)}
                    proporsi={(u.rata ?? 0) / 100}
                    warna="bg-slate-900"
                  />
                  <Batang
                    label="Tertinggi"
                    teks={u.tertinggi === null ? "–" : String(u.tertinggi)}
                    proporsi={(u.tertinggi ?? 0) / 100}
                    warna="bg-emerald-500"
                  />
                  <Batang
                    label="Terendah"
                    teks={u.terendah === null ? "–" : String(u.terendah)}
                    proporsi={(u.terendah ?? 0) / 100}
                    warna="bg-red-400"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Belum ada ulangan yang punya nilai.
          </p>
        )}
      </section>

      {/* Distribusi nilai per kelas */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          Distribusi Nilai per Kelas
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Jumlah nilai di tiap rentang untuk semua ulangan kelas tersebut.
        </p>

        {distribusiPerKelas.some((d) => d.total > 0) ? (
          <div className="mt-4 space-y-5">
            {distribusiPerKelas
              .filter((d) => d.total > 0)
              .map((d) => (
                <div key={d.kelas.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {d.kelas.nama_kelas}
                    </span>
                    <span className="text-slate-400">
                      {d.total} nilai · rata-rata{" "}
                      {tampilkanRataRata(d.rata)}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {d.rentang.map((r) => (
                      <Batang
                        key={r.label}
                        label={r.label}
                        teks={String(r.jumlah)}
                        proporsi={d.total > 0 ? r.jumlah / d.total : 0}
                        warna="bg-sky-500"
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Belum ada nilai untuk kelas manapun.
          </p>
        )}
      </section>
    </div>
  );
}
