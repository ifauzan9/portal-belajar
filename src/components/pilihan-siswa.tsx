"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  aksiSiswaBanyak,
  type HasilAksiSiswaBanyak,
} from "@/app/guru/siswa/actions";

// ============================================================================
// Pilihan siswa untuk aksi massal (dipakai di halaman Data Siswa).
// Provider menyimpan daftar id terpilih; header & baris memakai konteks ini.
// ============================================================================

type NilaiPilihan = {
  dipilih: string[];
  semuaDipilih: boolean;
  toggle: (id: string) => void;
  pilihSemua: (checked: boolean) => void;
};

const Konteks = createContext<NilaiPilihan | null>(null);

export function usePilihanSiswa() {
  return useContext(Konteks);
}

export function PilihanSiswa({
  semuaId,
  children,
}: {
  semuaId: string[];
  children: ReactNode;
}) {
  const [dipilih, setDipilih] = useState<string[]>([]);

  const [state, formAction, pending] = useActionState<
    HasilAksiSiswaBanyak,
    FormData
  >(aksiSiswaBanyak, { message: null, sukses: false, info: null });

  // Setelah aksi sukses, kosongkan pilihan.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.sukses) setDipilih([]);
  }, [state]);

  const toggle = useCallback((id: string) => {
    setDipilih((sekarang) =>
      sekarang.includes(id)
        ? sekarang.filter((nilai) => nilai !== id)
        : [...sekarang, id],
    );
  }, []);

  const pilihSemua = useCallback(
    (checked: boolean) => {
      setDipilih(checked ? [...semuaId] : []);
    },
    [semuaId],
  );

  const semuaDipilih =
    semuaId.length > 0 && semuaId.every((id) => dipilih.includes(id));

  const nilai = useMemo<NilaiPilihan>(
    () => ({ dipilih, semuaDipilih, toggle, pilihSemua }),
    [dipilih, semuaDipilih, toggle, pilihSemua],
  );

  return (
    <Konteks.Provider value={nilai}>
      {dipilih.length > 0 ? (
        <form
          action={formAction}
          className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-3 text-sm text-white"
        >
          {dipilih.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}

          <span className="mr-1 font-semibold">
            {dipilih.length} siswa dipilih
          </span>

          <button
            type="submit"
            name="aksi"
            value="aktifkan"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Aktifkan akun
          </button>
          <button
            type="submit"
            name="aksi"
            value="nonaktifkan"
            disabled={pending}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Nonaktifkan akun
          </button>
          <button
            type="submit"
            name="aksi"
            value="hapus-akun"
            disabled={pending}
            onClick={(event) => {
              if (
                !confirm(
                  `Hapus akun login ${dipilih.length} siswa terpilih? Siswa tetap ada, hanya akunnya yang dihapus.`,
                )
              ) {
                event.preventDefault();
              }
            }}
            className="rounded-lg border border-red-400/50 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hapus akun login
          </button>
          <button
            type="submit"
            name="aksi"
            value="hapus-siswa"
            disabled={pending}
            onClick={(event) => {
              if (
                !confirm(
                  `Hapus ${dipilih.length} siswa terpilih beserta SEMUA nilainya? Tindakan ini tidak bisa dibatalkan.`,
                )
              ) {
                event.preventDefault();
              }
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hapus siswa
          </button>

          <button
            type="button"
            onClick={() => setDipilih([])}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
          >
            Batal pilih
          </button>

          {pending ? (
            <span className="text-xs text-slate-300">Memproses...</span>
          ) : null}
          {state.message ? (
            <span className="text-xs text-red-300">{state.message}</span>
          ) : null}
        </form>
      ) : null}

      {state.info ? (
        <p className="mb-2 text-sm text-emerald-600">{state.info}</p>
      ) : null}

      {children}
    </Konteks.Provider>
  );
}

// Checkbox "pilih semua" untuk header tabel.
export function PilihSemuaCheckbox() {
  const konteks = usePilihanSiswa();
  if (!konteks) return null;

  return (
    <input
      type="checkbox"
      checked={konteks.semuaDipilih}
      onChange={(event) => konteks.pilihSemua(event.target.checked)}
      aria-label="Pilih semua siswa"
      className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
    />
  );
}

// Checkbox per baris siswa.
export function KotakPilihSiswa({
  id,
  label,
}: {
  id: string;
  label?: string;
}) {
  const konteks = usePilihanSiswa();
  if (!konteks) return null;

  return (
    <input
      type="checkbox"
      checked={konteks.dipilih.includes(id)}
      onChange={() => konteks.toggle(id)}
      aria-label={label ?? "Pilih siswa"}
      className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
    />
  );
}
