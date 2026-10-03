import Link from "next/link";
import { redirect } from "next/navigation";
import { BarisKelas } from "@/components/baris-kelas";
import { KepalaUrut } from "@/components/kepala-urut";
import { TambahKelasForm } from "@/components/tambah-kelas-form";
import { createClient } from "@/lib/supabase/server";
import {
  bacaArah,
  bacaUrutKelas,
  filterKelas,
  tanggalPendek,
  urutkanKelas,
  type Arah,
  type UrutKelas,
} from "@/lib/urutkan-kelas";

type KelasRow = {
  id: string;
  nama_kelas: string;
  created_at: string | null;
};

function buatUrl(urut: UrutKelas, arah: Arah, cari: string) {
  const params = new URLSearchParams();
  params.set("urut", urut);
  params.set("arah", arah);
  if (cari) params.set("cari", cari);
  return `/guru/kelas?${params.toString()}`;
}

function urlKlik(kolom: UrutKelas, urut: UrutKelas, arah: Arah, cari: string) {
  const arahBaru: Arah = urut === kolom && arah === "asc" ? "desc" : "asc";
  return buatUrl(kolom, arahBaru, cari);
}

export default async function KelasPage(props: PageProps<"/guru/kelas">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const urut = bacaUrutKelas(searchParams.urut);
  const arah = bacaArah(searchParams.arah);
  const cari =
    typeof searchParams.cari === "string" ? searchParams.cari.trim() : "";

  const { data, error } = await supabase
    .from("classes")
    .select("id, nama_kelas, created_at");

  const semuaKelas: KelasRow[] = data ?? [];
  const hasil = urutkanKelas(filterKelas(semuaKelas, cari), urut, arah);
  const urlTanpaCari = buatUrl(urut, arah, "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Data Kelas</h1>
      </div>

      <TambahKelasForm />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          method="get"
          action="/guru/kelas"
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="urut" value={urut} />
          <input type="hidden" name="arah" value={arah} />

          <input
            type="search"
            name="cari"
            defaultValue={cari}
            placeholder="Cari nama kelas..."
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
            ? `Menampilkan ${hasil.length} dari ${semuaKelas.length} kelas`
            : `${semuaKelas.length} kelas`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {hasil.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="w-12 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    No
                  </th>
                  <KepalaUrut
                    label="Nama Kelas"
                    href={urlKlik("nama", urut, arah, cari)}
                    aktif={urut === "nama"}
                    arah={arah}
                  />
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
                  <BarisKelas
                    key={item.id}
                    nomor={index + 1}
                    id={item.id}
                    nama={item.nama_kelas}
                    tanggal={tanggalPendek(item.created_at)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : cari ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
            <p>
              Tidak ada kelas yang cocok dengan{" "}
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
            Belum ada kelas.
          </p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600">Gagal memuat kelas: {error.message}</p>
      ) : null}
    </div>
  );
}
