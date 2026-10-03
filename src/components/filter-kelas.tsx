"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Arah, Urut } from "@/lib/urutkan-siswa";

type Kelas = { id: string; nama_kelas: string };

export function FilterKelas({
  kelasList,
  active,
  urut,
  arah,
  cari,
}: {
  kelasList: Kelas[];
  active: string;
  urut: Urut;
  arah: Arah;
  cari: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Urutan dan kata pencarian tetap dipertahankan saat filter kelas diganti.
  function ganti(nilai: string) {
    const params = new URLSearchParams();
    if (nilai) params.set("kelas", nilai);
    params.set("urut", urut);
    params.set("arah", arah);
    if (cari) params.set("cari", cari);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={active}
      onChange={(event) => ganti(event.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-48"
    >
      <option value="">Semua kelas</option>
      <option value="tanpa">Belum ada kelas</option>
      {kelasList.map((kelas) => (
        <option key={kelas.id} value={kelas.id}>
          {kelas.nama_kelas}
        </option>
      ))}
    </select>
  );
}
