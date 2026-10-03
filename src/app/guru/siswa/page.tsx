import Link from "next/link";
import { redirect } from "next/navigation";
import { BarisSiswa } from "@/components/baris-siswa";
import { FilterKelas } from "@/components/filter-kelas";
import { KepalaUrut } from "@/components/kepala-urut";
import { PilihSemuaCheckbox, PilihanSiswa } from "@/components/pilihan-siswa";
import { TambahSiswaForm } from "@/components/tambah-siswa-form";
import { createClient } from "@/lib/supabase/server";
import {
  bacaArah,
  bacaUrut,
  filterSiswa,
  urutkanSiswa,
  type Arah,
  type Urut,
} from "@/lib/urutkan-siswa";

type KelasRow = { id: string; nama_kelas: string };
type SiswaRow = {
  id: string;
  nis: string | null;
  nama_siswa: string;
  kelas_id: string | null;
};

function buatUrl(kelasFilter: string, urut: Urut, arah: Arah, cari: string) {
  const params = new URLSearchParams();
  if (kelasFilter) params.set("kelas", kelasFilter);
  params.set("urut", urut);
  params.set("arah", arah);
  if (cari) params.set("cari", cari);
  return `/guru/siswa?${params.toString()}`;
}

// Klik kolom yang sama akan membalik arah, kolom baru mulai dari naik.
function urlKlik(
  kelasFilter: string,
  kolom: Urut,
  urut: Urut,
  arah: Arah,
  cari: string,
) {
  const arahBaru: Arah = urut === kolom && arah === "asc" ? "desc" : "asc";
  return buatUrl(kelasFilter, kolom, arahBaru, cari);
}

export default async function SiswaPage(props: PageProps<"/guru/siswa">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const kelasFilter =
    typeof searchParams.kelas === "string" ? searchParams.kelas : "";
  const urut = bacaUrut(searchParams.urut);
  const arah = bacaArah(searchParams.arah);
  const cari =
    typeof searchParams.cari === "string" ? searchParams.cari.trim() : "";

  // Daftar kelas untuk dropdown (tambah, ubah, filter)
  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  const kelasList: KelasRow[] = kelasData ?? [];
  const namaKelas = new Map(
    kelasList.map((kelas) => [kelas.id, kelas.nama_kelas]),
  );

  // Daftar siswa, sesuai filter kelas
  let siswaQuery;
  if (kelasFilter === "tanpa") {
    siswaQuery = supabase
      .from("students")
      .select("id, nis, nama_siswa, kelas_id")
      .is("kelas_id", null);
  } else if (kelasFilter) {
    siswaQuery = supabase
      .from("students")
      .select("id, nis, nama_siswa, kelas_id")
      .eq("kelas_id", kelasFilter);
  } else {
    siswaQuery = supabase.from("students").select("id, nis, nama_siswa, kelas_id");
  }

  const { data: siswaData, error } = await siswaQuery;
  const semuaSiswa: SiswaRow[] = siswaData ?? [];

  // Map username akun login per siswa (untuk kolom "Akun Login").
  // Jika kolom `is_active` belum ada di DB (migration belum dijalankan),
  // query akan gagal → fallback ke semua akun dianggap aktif.
  const { data: akunData, error: akunError } = await supabase
    .from("student_accounts")
    .select("siswa_id, username, is_active");
  const akunPerSiswa = akunError ? new Map<string, { username: string; isActive: boolean }>() : new Map(
    (akunData ?? []).map((a) => [
      (a as { siswa_id: string }).siswa_id,
      {
        username: (a as { username: string }).username,
        isActive: (a as { is_active: boolean }).is_active,
      },
    ]),
  );
  if (akunError) {
    console.error("Gagal memuat student_accounts dengan is_active, mencoba fallback:", akunError.message);
    const { data: akunDataLama } = await supabase
      .from("student_accounts")
      .select("siswa_id, username");
    akunPerSiswa.clear();
    for (const a of akunDataLama ?? []) {
      akunPerSiswa.set((a as { siswa_id: string }).siswa_id, {
        username: (a as { username: string }).username,
        isActive: true,
      });
    }
  }

  const hasil = urutkanSiswa<SiswaRow>(
    filterSiswa(semuaSiswa, cari),
    namaKelas,
    urut,
    arah,
  );

  const urlTanpaCari = buatUrl(kelasFilter, urut, arah, "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data Siswa</h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/guru/siswa/import"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Import Excel
          </Link>
          <Link
            href="/guru/siswa/kredensial"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Kredensial
          </Link>
          <Link
            href="/guru/siswa/export"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Export Excel
          </Link>
          <FilterKelas
            kelasList={kelasList}
            active={kelasFilter}
            urut={urut}
            arah={arah}
            cari={cari}
          />
        </div>
      </div>

      <TambahSiswaForm kelasList={kelasList} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          method="get"
          action="/guru/siswa"
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
        >
          {kelasFilter ? (
            <input type="hidden" name="kelas" value={kelasFilter} />
          ) : null}
          <input type="hidden" name="urut" value={urut} />
          <input type="hidden" name="arah" value={arah} />

          <input
            type="search"
            name="cari"
            defaultValue={cari}
            placeholder="Cari NIS atau nama..."
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
            ? `Menampilkan ${hasil.length} dari ${semuaSiswa.length} siswa`
            : `${semuaSiswa.length} siswa`}
        </p>
      </div>

      <PilihanSiswa semuaId={hasil.map((item) => item.id)}>
        <ul className="space-y-3 lg:hidden">
          {hasil.map((item, index) => (
            <BarisSiswa
              key={item.id}
              tampilan="kartu"
              nomor={index + 1}
              id={item.id}
              nis={item.nis}
              nama={item.nama_siswa}
              kelasId={item.kelas_id}
              namaKelas={
                item.kelas_id
                  ? (namaKelas.get(item.kelas_id) ?? "Kelas tidak ditemukan")
                  : "Belum ada kelas"
              }
              kelasList={kelasList}
              usernameAkun={akunPerSiswa.get(item.id)?.username ?? null}
              akunAktif={akunPerSiswa.get(item.id)?.isActive ?? false}
            />
          ))}
        </ul>
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {hasil.length > 0 ? (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="w-10 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    <PilihSemuaCheckbox />
                  </th>
                  <th
                    scope="col"
                    className="w-12 px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    No
                  </th>
                  <KepalaUrut
                    label="NIS"
                    href={urlKlik(kelasFilter, "nis", urut, arah, cari)}
                    aktif={urut === "nis"}
                    arah={arah}
                  />
                  <KepalaUrut
                    label="Nama"
                    href={urlKlik(kelasFilter, "nama", urut, arah, cari)}
                    aktif={urut === "nama"}
                    arah={arah}
                  />
                  <KepalaUrut
                    label="Kelas"
                    href={urlKlik(kelasFilter, "kelas", urut, arah, cari)}
                    aktif={urut === "kelas"}
                    arah={arah}
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Akun Login
                  </th>
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
                  <BarisSiswa
                    key={item.id}
                    nomor={index + 1}
                    id={item.id}
                    nis={item.nis}
                    nama={item.nama_siswa}
                    kelasId={item.kelas_id}
                    namaKelas={
                      item.kelas_id
                        ? (namaKelas.get(item.kelas_id) ??
                          "Kelas tidak ditemukan")
                        : "Belum ada kelas"
                    }
                    kelasList={kelasList}
                    usernameAkun={
                      akunPerSiswa.get(item.id)?.username ?? null
                    }
                    akunAktif={akunPerSiswa.get(item.id)?.isActive ?? false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : cari ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
            <p>
              Tidak ada siswa yang cocok dengan{" "}
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
            Tidak ada siswa.
          </p>
        )}
        </div>
      </PilihanSiswa>

      {error ? (
        <p className="text-sm text-red-600">
          Gagal memuat siswa: {error.message}
        </p>
      ) : null}
    </div>
  );
}
