import { redirect } from "next/navigation";
import { BarisTugas } from "@/components/baris-tugas";
import { FormTugas } from "@/components/form-tugas";
import { createClient } from "@/lib/supabase/server";
import { hitungRataRata, tampilkanRataRata } from "@/lib/rata-rata";
import {
  LABEL_METODE,
  ambilKelasTugas,
  bacaMetode,
  tugasDibuka,
  type MetodePengumpulan,
} from "@/lib/tugas";

type KelasRow = { id: string; nama_kelas: string };
type SiswaRow = { id: string; kelas_id: string | null };

type TugasRow = {
  id: string;
  judul: string;
  deskripsi: string;
  tenggat: string | null;
  metode: MetodePengumpulan;
  fileDiizinkan: string[];
  daftarKelasId: string[];
  daftarKelasNama: string[];
  terkumpul: number;
  totalSiswa: number;
  rataRata: string;
  dibuka: boolean;
};

function tenggatPendek(iso: string | null): string {
  if (!iso) return "Tanpa tenggat";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(t);
}

export default async function TugasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [hasilKelas, hasilTugas, hasilSiswa] = await Promise.all([
    supabase
      .from("classes")
      .select("id, nama_kelas")
      .order("nama_kelas", { ascending: true }),
    supabase
      .from("assignments")
      .select(
        "id, judul, deskripsi, tenggat, metode, file_diizinkan, dibuka, created_at, assignment_classes(kelas_id), assignment_submissions(nilai)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("students").select("id, kelas_id"),
  ]);

  const kelasList: KelasRow[] = hasilKelas.data ?? [];
  const namaKelas = new Map(
    kelasList.map((kelas) => [kelas.id, kelas.nama_kelas]),
  );
  const semuaSiswa: SiswaRow[] = hasilSiswa.data ?? [];

  const daftar: TugasRow[] = (hasilTugas.data ?? []).map((row) => {
    const data = row as {
      id: string;
      judul: string;
      deskripsi: string | null;
      tenggat: string | null;
      metode: string;
      file_diizinkan: string[] | null;
      dibuka: boolean | null;
      assignment_classes?: { kelas_id: string }[];
      assignment_submissions?: { nilai: number | null }[];
    };

    const daftarKelasId = ambilKelasTugas(data);
    const submissions = data.assignment_submissions ?? [];
    const totalSiswa =
      daftarKelasId.length === 0
        ? semuaSiswa.length
        : semuaSiswa.filter(
            (siswa) =>
              siswa.kelas_id !== null &&
              daftarKelasId.includes(siswa.kelas_id),
          ).length;

    const nilaiList = submissions
      .map((s) => s.nilai)
      .filter((n): n is number => typeof n === "number");

    return {
      id: data.id,
      judul: data.judul,
      deskripsi: data.deskripsi ?? "",
      tenggat: data.tenggat,
      metode: bacaMetode(data.metode),
      fileDiizinkan: data.file_diizinkan ?? [],
      daftarKelasId,
      daftarKelasNama: daftarKelasId.map(
        (idKelas) => namaKelas.get(idKelas) ?? "Kelas tak ditemukan",
      ),
      terkumpul: submissions.length,
      totalSiswa,
      rataRata: tampilkanRataRata(hitungRataRata(nilaiList)),
      dibuka: tugasDibuka(data),
    };
  });

  const galat =
    hasilKelas.error?.message ??
    hasilTugas.error?.message ??
    hasilSiswa.error?.message ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tugas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat tugas dan tentukan bentuk pengumpulannya: link, file, atau
          keduanya.
        </p>
      </div>

      <FormTugas kelasList={kelasList} />

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {daftar.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
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
                    Judul
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Kelas
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Metode
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Tenggat
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-slate-500 sm:px-5"
                  >
                    Terkumpul
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-medium text-slate-500 sm:px-5"
                  >
                    Rata-rata
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-medium text-slate-500 sm:px-5"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.map((item, index) => (
                  <BarisTugas
                    key={item.id}
                    nomor={index + 1}
                    id={item.id}
                    judul={item.judul}
                    deskripsi={item.deskripsi}
                    daftarKelasNama={item.daftarKelasNama}
                    daftarKelasId={item.daftarKelasId}
                    metode={item.metode}
                    fileDiizinkan={item.fileDiizinkan}
                    metodeLabel={LABEL_METODE[item.metode]}
                    tenggat={tenggatPendek(item.tenggat)}
                    tenggatIso={item.tenggat}
                    terkumpul={item.terkumpul}
                    totalSiswa={item.totalSiswa}
                    rataRata={item.rataRata}
                    kelasList={kelasList}
                    dibuka={item.dibuka}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
            Belum ada tugas.
          </p>
        )}
      </div>

      {galat ? (
        <p className="text-sm text-red-600">Gagal memuat tugas: {galat}</p>
      ) : null}
    </div>
  );
}
