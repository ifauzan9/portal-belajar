import Link from "next/link";
import { redirect } from "next/navigation";
import { BarisPengumuman } from "@/components/baris-pengumuman";
import { KepalaUrut } from "@/components/kepala-urut";
import { TambahPengumumanForm } from "@/components/tambah-pengumuman-form";
import { createClient } from "@/lib/supabase/server";
import {
  bacaArah,
  bacaUrutPengumuman,
  filterPengumuman,
  urutkanPengumuman,
  type Arah,
  type UrutPengumuman,
} from "@/lib/urutkan-pengumuman";

type KelasRow = { id: string; nama_kelas: string };
type PengumumanRow = {
  id: string;
  judul: string;
  isi: string;
  created_at: string | null;
  mulai_pada: string | null;
  // Daftar nama kelas yang berlaku untuk pengumuman ini
  daftarKelasNama: string[];
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

function buatUrl(urut: UrutPengumuman, arah: Arah, cari: string) {
  const params = new URLSearchParams();
  params.set("urut", urut);
  params.set("arah", arah);
  if (cari) params.set("cari", cari);
  return `/guru/pengumuman?${params.toString()}`;
}

// Klik kolom yang sama akan membalik arah, kolom baru mulai dari naik.
function urlKlik(
  kolom: UrutPengumuman,
  urut: UrutPengumuman,
  arah: Arah,
  cari: string,
) {
  const arahBaru: Arah = urut === kolom && arah === "asc" ? "desc" : "asc";
  return buatUrl(kolom, arahBaru, cari);
}

export default async function PengumumanPage(
  props: PageProps<"/guru/pengumuman">,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const urut = bacaUrutPengumuman(searchParams.urut);
  const arah = bacaArah(searchParams.arah);
  const cari =
    typeof searchParams.cari === "string" ? searchParams.cari.trim() : "";

  // Daftar kelas untuk form tambah/ubah
  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  const kelasList: KelasRow[] = kelasData ?? [];
  const namaKelas = new Map(
    kelasList.map((kelas) => [kelas.id, kelas.nama_kelas]),
  );

  // Pengumuman + hubungan pengumuman-kelas (join banyak-ke-banyak)
  const { data: pengumumanData, error } = await supabase
    .from("announcements")
    .select(
      "id, judul, isi, created_at, mulai_pada, announcement_classes(kelas_id)",
    );

  const semua: PengumumanRow[] = (pengumumanData ?? []).map((row) => {
    const daftarKelasId =
      (row as { announcement_classes?: { kelas_id: string }[] })
        .announcement_classes?.map((hub) => hub.kelas_id) ?? [];

    return {
      id: row.id,
      judul: row.judul,
      isi: row.isi,
      created_at: row.created_at,
      mulai_pada: row.mulai_pada,
      daftarKelasNama: daftarKelasId.map(
        (idKelas) => namaKelas.get(idKelas) ?? "Kelas tidak ditemukan",
      ),
    };
  });

  const hasil = urutkanPengumuman(
    filterPengumuman(semua, cari, (row) => row.daftarKelasNama),
    urut,
    arah,
  );

  const urlTanpaCari = buatUrl(urut, arah, "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Papan Pengumuman
        </h1>
      </div>

      <TambahPengumumanForm kelasList={kelasList} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          method="get"
          action="/guru/pengumuman"
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="urut" value={urut} />
          <input type="hidden" name="arah" value={arah} />

          <input
            type="search"
            name="cari"
            defaultValue={cari}
            placeholder="Cari judul atau kelas..."
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
            ? `Menampilkan ${hasil.length} dari ${semua.length} pengumuman`
            : `${semua.length} pengumuman`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {hasil.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="w-12 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    No
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Judul &amp; Isi
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Berlaku Untuk
                  </th>
                  <KepalaUrut
                    label="Dibuat"
                    href={urlKlik("tanggal", urut, arah, cari)}
                    aktif={urut === "tanggal"}
                    arah={arah}
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hasil.map((item, index) => (
                  <BarisPengumuman
                    key={item.id}
                    nomor={index + 1}
                    id={item.id}
                    judul={item.judul}
                    isi={item.isi}
                    daftarKelasNama={item.daftarKelasNama}
                    tanggal={tanggalPendek(item.created_at)}
                    mulaiPada={item.mulai_pada}
                    kelasList={kelasList}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : cari ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
            <p>
              Tidak ada pengumuman yang cocok dengan{" "}
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
            Belum ada pengumuman.
          </p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600">
          Gagal memuat pengumuman: {error.message}
        </p>
      ) : null}
    </div>
  );
}
