"use client";

import { deleteSiswa } from "@/app/guru/siswa/actions";

export function HapusSiswaButton({ id, nama }: { id: string; nama: string }) {
  return (
    <div className="flex justify-end sm:justify-start">
      <form action={deleteSiswa}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          onClick={(event) => {
            if (!confirm(`Yakin menghapus siswa ${nama}?`)) {
              event.preventDefault();
            }
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Hapus
        </button>
      </form>
    </div>
  );
}
