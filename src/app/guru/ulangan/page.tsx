import Link from "next/link";
import { redirect } from "next/navigation";
import { BarisUlangan } from "@/components/baris-ulangan";
import { KepalaUrut } from "@/components/kepala-urut";
import { TambahUlanganForm } from "@/components/tambah-ulangan-form";
import { createClient } from "@/lib/supabase/server";
import { hitungRataRata, tampilkanRataRata } from "@/lib/rata-rata";
import {
  ambilKelasUlangan,
  namaKelasDariIds,
} from "@/lib/ambil-kelas-ulangan";
import {
  bacaArah,
  bacaUrutUlangan,
  filterUlangan,
  urutkanUlangan,
  type Arah,
  type UrutUlangan,
} from "@/lib/urutkan-ulangan";
import { tenggatSudahLewat } from "@/lib/deadline";

type KelasRow = { id: string; nama_kelas: string };
type UlanganRow = {
  id: string;
  judul: string;
  // Daftar id kelas (gabungan legacy + relasi)
  daftarKelasId: string[];
  tanggal: string | null;
  // Kode akses yang diatur guru (null = tanpa kode)
  access_code: string | null;
  // Nilai-nilai yang sudah diinput untuk ulangan ini
  nilaiSudah: number[];
  // Status ulangan: "akan" (bersoal) atau "sudah" (manual)
  status: "akan" | "sudah";
  // Tenggat waktu (ISO) — hanya untuk status "akan"
  tenggat: string | null;
  // Durasi pengerjaan dalam menit (null = tanpa timer, pakai tenggat saja)
  durasi: number | null;
  // Tampilkan nilai langsung setelah submit (default true)
  nilaiDitampilkan: boolean;
  // Ulangan dibuka/ditutup oleh guru (default true)
  dibuka: boolean;
  // Jumlah soal di ulangan ini
  jumlahSoal: number;
};

function tanggalPendek(iso: string | null): string {
  if (!iso) return "-";
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(tanggal);
}

function buatUrl(urut: UrutUlangan, arah: Arah, cari: string) {
  const params = new URLSearchParams();
  params.set("urut", urut);
  params.set("arah", arah);
  if (cari) params.set("cari", cari);
  return `/guru/ulangan?${params.toString()}`;
}

// Klik kolom yang sama akan membalik arah, kolom baru mulai dari naik.
function urlKlik(
  kolom: UrutUlangan,
  urut: UrutUlangan,
  arah: Arah,
  cari: string,
) {
  const arahBaru: Arah = urut === kolom && arah === "asc" ? "desc" : "asc";
  return buatUrl(kolom, arahBaru, cari);
}

export default async function UlanganPage(
  props: PageProps<"/guru/ulangan">,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const urut = bacaUrutUlangan(searchParams.urut);
  const arah = bacaArah(searchParams.arah);
  const cari =
    typeof searchParams.cari === "string" ? searchParams.cari.trim() : "";

  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  const kelasList: KelasRow[] = kelasData ?? [];
  const namaKelas = new Map(
    kelasList.map((kelas) => [kelas.id, kelas.nama_kelas]),
  );

  const { data: ulanganData, error } = await supabase
    .from("exams")
    .select(
      "id, judul, kelas_id, tanggal, access_code, status, tenggat, durasi, nilai_ditampilkan, dibuka, exam_scores(nilai), exam_classes(kelas_id)",
    );

  const semua: UlanganRow[] = (ulanganData ?? []).map((row) => {
    const dataRow = row as {
      id: string;
      judul: string;
      kelas_id: string | null;
      tanggal: string | null;
      access_code: string | null;
      status: "akan" | "sudah";
      tenggat: string | null;
      durasi: number | null;
      nilai_ditampilkan: boolean;
      dibuka: boolean;
      exam_scores?: { nilai: number }[];
      exam_classes?: { kelas_id: string }[];
    };

    const daftarKelasId = ambilKelasUlangan(dataRow);

    return {
      id: dataRow.id,
      judul: dataRow.judul,
      daftarKelasId,
      tanggal: dataRow.tanggal,
      access_code: dataRow.access_code,
      nilaiSudah:
        dataRow.exam_scores?.map((item) => item.nilai) ?? [],
      status: dataRow.status ?? "sudah",
      tenggat: dataRow.tenggat,
      durasi: dataRow.durasi ?? null,
      nilaiDitampilkan: dataRow.nilai_ditampilkan ?? true,
      // Kolom baru `dibuka` default true; jika DDL Tahap 12 belum
      // dijalankan nilainya null → anggap dibuka (tidak menghalangi).
      dibuka: dataRow.dibuka !== false,
      // jumlahSoal diisi terpisah karena perlu query ke exam_questions
      jumlahSoal: 0,
    };
  });

  // Hitung jumlah soal per ulangan (hanya untuk status "akan")
  const ulanganBersoal = semua.filter((u) => u.status === "akan");
  if (ulanganBersoal.length > 0) {
    const { data: soalData } = await supabase
      .from("exam_questions")
      .select("exam_id")
      .in(
        "exam_id",
        ulanganBersoal.map((u) => u.id),
      );
    const countSoal = new Map<string, number>();
    for (const row of soalData ?? []) {
      const r = row as { exam_id: string };
      countSoal.set(r.exam_id, (countSoal.get(r.exam_id) ?? 0) + 1);
    }
    for (const u of ulanganBersoal) {
      u.jumlahSoal = countSoal.get(u.id) ?? 0;
    }
  }

  // Rata-rata dihitung di server agar kolomnya benar-benar akurat.
  const hasil = urutkanUlangan(
    filterUlangan(semua, cari),
    urut,
    arah,
  );

  const urlTanpaCari = buatUrl(urut, arah, "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Ulangan
        </h1>
      </div>

      <TambahUlanganForm kelasList={kelasList} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          method="get"
          action="/guru/ulangan"
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="urut" value={urut} />
          <input type="hidden" name="arah" value={arah} />

          <input
            type="search"
            name="cari"
            defaultValue={cari}
            placeholder="Cari judul ulangan..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:max-w-xs"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Cari
          </button>
          {cari ? (
            <Link
              href={urlTanpaCari}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Hapus pencarian
            </Link>
          ) : null}
        </form>

        <p className="text-sm text-slate-500">
          {cari
            ? `Menampilkan ${hasil.length} dari ${semua.length} ulangan`
            : `${semua.length} ulangan`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {hasil.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="w-12 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    No
                  </th>
                  <KepalaUrut
                    label="Judul"
                    href={urlKlik("judul", urut, arah, cari)}
                    aktif={urut === "judul"}
                    arah={arah}
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Kelas
                  </th>
                  <KepalaUrut
                    label="Tanggal"
                    href={urlKlik("tanggal", urut, arah, cari)}
                    aktif={urut === "tanggal"}
                    arah={arah}
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-medium text-slate-500 sm:px-5"
                  >
                    Rata-rata
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Kode
                  </th>
                  <th
                    scope="col"
                    className="w-40 px-4 py-3 text-right font-medium text-slate-500 sm:px-5"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hasil.map((item, index) => (
                  <BarisUlangan
                    key={item.id}
                    nomor={index + 1}
                    id={item.id}
                    judul={item.judul}
                    daftarKelasNama={namaKelasDariIds(
                      item.daftarKelasId,
                      namaKelas,
                    )}
                    tanggal={tanggalPendek(item.tanggal)}
                    rataRata={tampilkanRataRata(hitungRataRata(item.nilaiSudah))}
                    kelasList={kelasList}
                    kodeAkses={item.access_code}
                    status={item.status}
                    tenggat={item.tenggat}
                    durasi={item.durasi}
                    nilaiDitampilkan={item.nilaiDitampilkan}
                    jumlahSoal={item.jumlahSoal}
                    deadlineLewat={tenggatSudahLewat(item.tenggat)}
                    dibuka={item.dibuka}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : cari ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
            <p>
              Tidak ada ulangan yang cocok dengan{" "}
              <b className="text-slate-700">&ldquo;{cari}&rdquo;</b>.
            </p>
            <Link
              href={urlTanpaCari}
              className="mt-2 inline-block font-medium text-slate-900 underline"
            >
              Hapus pencarian
            </Link>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
            Belum ada ulangan.
          </p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600">
          Gagal memuat ulangan: {error.message}
        </p>
      ) : null}
    </div>
  );
}
