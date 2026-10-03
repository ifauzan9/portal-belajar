"use client";

import { useActionState } from "react";
import { resetKegiatan, type HasilReset } from "@/app/guru/rekap/actions";

// Tombol reset kegiatan siswa. Destructive → selalu minta konfirmasi dulu.
export function TombolReset({
  jenis,
  siswaId,
  refId,
  label,
}: {
  jenis: "tugas" | "ulangan" | "lab_coding" | "lab_komputer";
  siswaId: string;
  refId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<HasilReset, FormData>(
    resetKegiatan,
    { message: null, berhasil: false },
  );

  return (
    <div className="flex flex-col items-end">
      <form action={formAction}>
        <input type="hidden" name="jenis" value={jenis} />
        <input type="hidden" name="siswa_id" value={siswaId} />
        <input type="hidden" name="ref_id" value={refId} />
        <button
          type="submit"
          disabled={pending}
          onClick={(event) => {
            if (
              !confirm(
                `Yakin reset "${label}" untuk siswa ini? Data pengerjaan akan dihapus dan siswa bisa mengerjakan ulang.`,
              )
            ) {
              event.preventDefault();
            }
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Mereset..." : "Reset"}
        </button>
      </form>
      {state.message && !state.berhasil ? (
        <p className="mt-1 max-w-[220px] text-right text-xs text-red-600">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
