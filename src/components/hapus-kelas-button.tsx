"use client";

import { deleteKelas } from "@/app/guru/kelas/actions";

export function HapusKelasButton({ id, nama }: { id: string; nama: string }) {
  return (
    <div className="flex justify-end sm:justify-start">
      <form action={deleteKelas}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          onClick={(event) => {
            if (!confirm(`Yakin menghapus kelas ${nama}?`)) {
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
