import { redirect } from "next/navigation";
import { FormAbsensi } from "@/components/form-absensi";
import { createClient } from "@/lib/supabase/server";
import {
  bacaStatusAbsensi,
  bacaTanggal,
  DAFTAR_STATUS,
  formatTanggal,
  hariIni,
  hitungRekap,
  LABEL_STATUS,
  type RekapAbsensi,
  type StatusAbsensi,
} from "@/lib/absensi";

type KelasRow = { id: string; nama_kelas: string };
type SiswaRow = { id: string; nis: string | null; nama_siswa: string };

export default async function AbsensiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const kelasId = typeof params.kelas === "string" ? params.kelas : "";
  const tanggal = bacaTanggal(params.tanggal) ?? hariIni();

  const { data: kelasData } = await supabase
    .from("classes")
    .select("id, nama_kelas")
    .order("nama_kelas", { ascending: true });

  const kelasList: KelasRow[] = kelasData ?? [];
  const kelasTerpilih = kelasList.find((k) => k.id === kelasId) ?? null;

  let siswa: SiswaRow[] = [];
  const awal: Record<string, StatusAbsensi> = {};
  let rekapPerSiswa: { siswa: SiswaRow; rekap: RekapAbsensi }[] = [];

  if (kelasTerpilih) {
    const { data: siswaData } = await supabase
      .from("students")
      .select("id, nis, nama_siswa")
      .eq("kelas_id", kelasTerpilih.id)
      .order("nama_siswa", { ascending: true });

    siswa = (siswaData ?? []) as SiswaRow[];

    // Nilai awal form: absensi yang sudah tercatat untuk tanggal ini.
    const { data: absensiTanggal } = await supabase
      .from("attendance")
      .select("siswa_id, status")
      .eq("kelas_id", kelasTerpilih.id)
      .eq("tanggal", tanggal);

    for (const row of absensiTanggal ?? []) {
      const isi = row as { siswa_id: string; status: string };
      const status = bacaStatusAbsensi(isi.status);
      if (status) awal[isi.siswa_id] = status;
    }

    // Rekap seluruh catatan kelas ini, dikelompokkan per siswa.
    const { data: semuaAbsensi } = await supabase
      .from("attendance")
      .select("siswa_id, status")
      .eq("kelas_id", kelasTerpilih.id);

    const perSiswa = new Map<string, { status: StatusAbsensi }[]>();
    for (const row of semuaAbsensi ?? []) {
      const isi = row as { siswa_id: string; status: string };
      const status = bacaStatusAbsensi(isi.status);
      if (!status) continue;
      const daftar = perSiswa.get(isi.siswa_id) ?? [];
      daftar.push({ status });
      perSiswa.set(isi.siswa_id, daftar);
    }

    rekapPerSiswa = siswa
      .map((s) => ({ siswa: s, rekap: hitungRekap(perSiswa.get(s.id) ?? []) }))
      .sort((a, b) => a.rekap.persenHadir - b.rekap.persenHadir);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Absensi Siswa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Catat kehadiran per kelas dan tanggal, lalu lihat rekapnya.
        </p>
      </div>

      <form
        method="get"
        action="/guru/absensi"
        className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-1">
            <label
              htmlFor="kelas"
              className="block text-sm font-medium text-slate-700"
            >
              Kelas
            </label>
            <select
              id="kelas"
              name="kelas"
              defaultValue={kelasId}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Pilih kelas…</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <label
              htmlFor="tanggal"
              className="block text-sm font-medium text-slate-700"
            >
              Tanggal
            </label>
            <input
              id="tanggal"
              name="tanggal"
              type="date"
              defaultValue={tanggal}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Tampilkan
          </button>
        </div>
      </form>

      {kelasList.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Belum ada kelas. Tambahkan kelas dulu di menu Kelas.
        </p>
      ) : !kelasTerpilih ? (
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Pilih kelas dan tanggal untuk mulai mencatat absensi.
        </p>
      ) : (
        <>
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
            <h2 className="font-semibold text-slate-900">
              {kelasTerpilih.nama_kelas} · {formatTanggal(tanggal)}
            </h2>
            <div className="mt-3">
              <FormAbsensi
                kelasId={kelasTerpilih.id}
                tanggal={tanggal}
                siswa={siswa}
                awal={awal}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <h2 className="font-semibold text-slate-900">Rekap Kehadiran</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Seluruh catatan absensi untuk kelas ini.
              </p>
            </div>

            {siswa.length > 0 ? (
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
                      <th
                        scope="col"
                        className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                      >
                        Nama
                      </th>
                      {DAFTAR_STATUS.map((st) => (
                        <th
                          key={st}
                          scope="col"
                          className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                        >
                          {LABEL_STATUS[st]}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                      >
                        % Hadir
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rekapPerSiswa.map((item, index) => {
                      const persen = item.rekap.persenHadir;
                      const warnaPersen =
                        item.rekap.total === 0
                          ? "text-slate-400"
                          : persen >= 75
                            ? "text-emerald-600"
                            : persen >= 50
                              ? "text-amber-600"
                              : "text-red-600";
                      return (
                        <tr
                          key={item.siswa.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 text-slate-400 tabular-nums sm:px-5">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 sm:px-5">
                            {item.siswa.nama_siswa}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600 sm:px-5">
                            {item.rekap.hadir}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600 sm:px-5">
                            {item.rekap.sakit}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600 sm:px-5">
                            {item.rekap.izin}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600 sm:px-5">
                            {item.rekap.alpa}
                          </td>
                          <td
                            className={`px-4 py-3 tabular-nums font-medium sm:px-5 ${warnaPersen}`}
                          >
                            {persen}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                Kelas ini belum punya siswa.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
