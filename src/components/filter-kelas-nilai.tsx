"use client";

import { usePathname, useRouter } from "next/navigation";

type Kelas = { id: string; nama_kelas: string };

// Filter kelas untuk halaman input nilai ulangan.
// Hanya mengubah query `?kelas=...`; pilihan "Semua kelas" menghapus query.
export function FilterKelasNilai({
  kelasList,
  active,
  izinkanTanpaKelas = false,
}: {
  kelasList: Kelas[];
  active: string;
  izinkanTanpaKelas?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function ganti(nilai: string) {
    if (!nilai) {
      router.push(pathname);
      return;
    }
    router.push(`${pathname}?kelas=${encodeURIComponent(nilai)}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="filter-kelas-nilai"
        className="text-xs font-medium text-slate-600"
      >
        Kelas
      </label>
      <select
        id="filter-kelas-nilai"
        value={active}
        onChange={(event) => ganti(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-48"
      >
        <option value="">Semua kelas</option>
        {izinkanTanpaKelas ? (
          <option value="tanpa">Belum ada kelas</option>
        ) : null}
        {kelasList.map((kelas) => (
          <option key={kelas.id} value={kelas.id}>
            {kelas.nama_kelas}
          </option>
        ))}
      </select>
    </div>
  );
}