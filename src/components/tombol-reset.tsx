"use client";

import { useActionState } from "react";
import { resetKegiatan, type HasilReset } from "@/app/guru/rekap/actions";

// Tombol reset kegiatan siswa. Destructive → selalu minta konfirmasi dulu.
// `varian="outline"` dipakai untuk aksi yang lebih besar (mis. reset modul)
// supaya terlihat sebagai tombol utama, bukan tautan kecil.
export function TombolReset({
  jenis,
  siswaId,
  refId,
  label,
  varian = "ringkas",
  konfirmasi,
  teks,
}: {
  jenis:
    | "tugas"
    | "ulangan"
    | "lab_coding"
    | "lab_coding_modul"
    | "lab_komputer";
  siswaId: string;
  refId: string;
  label: string;
  varian?: "ringkas" | "outline";
  // Teks konfirmasi khusus. Kalau kosong, dipakai kalimat umum.
  konfirmasi?: string;
  // Label tombol. Default "Reset".
  teks?: string;
}) {
  const [state, formAction, pending] = useActionState<HasilReset, FormData>(
    resetKegiatan,
    { message: null, berhasil: false },
  );

  const kelasTombol =
    varian === "outline"
      ? "inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      : "rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60";

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
                konfirmasi ??
                  `Yakin reset "${label}" untuk siswa ini? Data pengerjaan akan dihapus dan siswa bisa mengerjakan ulang.`,
              )
            ) {
              event.preventDefault();
            }
          }}
          className={kelasTombol}
        >
          {varian === "outline" ? (
            <span
              aria-hidden="true"
              className="text-base leading-none"
            >
              ↺
            </span>
          ) : null}
          {pending ? "Mereset..." : (teks ?? "Reset")}
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
