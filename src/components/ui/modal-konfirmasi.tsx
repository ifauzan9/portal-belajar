"use client";

import { useEffect, type ReactNode } from "react";

// ============================================================================
// ModalKonfirmasi — dialog konfirmasi terkontrol.
// Dipakai untuk aksi penting yang tidak bisa dibatalkan (mis. kumpulkan
// jawaban ulangan). Lebih kaya dari window.confirm karena bisa menampilkan
// ringkasan/peringatan tambahan lewat `children`.
// ============================================================================

export function ModalKonfirmasi({
  terbuka,
  judul,
  konfirmasiLabel = "Ya, lanjutkan",
  batalLabel = "Batal",
  varian = "bahaya",
  pending = false,
  onKonfirmasi,
  onBatal,
  children,
}: {
  terbuka: boolean;
  judul: string;
  konfirmasiLabel?: string;
  batalLabel?: string;
  varian?: "bahaya" | "netral";
  pending?: boolean;
  onKonfirmasi: () => void;
  onBatal: () => void;
  children?: ReactNode;
}) {
  // Kunci scroll + tutup via Escape saat modal terbuka.
  useEffect(() => {
    if (!terbuka) return;

    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onBatal();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = sebelumnya;
      window.removeEventListener("keydown", onKey);
    };
  }, [terbuka, pending, onBatal]);

  if (!terbuka) return null;

  const warnaTombol =
    varian === "bahaya"
      ? "bg-red-600 hover:bg-red-500"
      : "bg-slate-900 hover:bg-slate-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!pending) onBatal();
      }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-konfirmasi-judul"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="modal-konfirmasi-judul"
          className="text-base font-semibold text-slate-900"
        >
          {judul}
        </h2>

        {children ? (
          <div className="mt-3 text-sm text-slate-600">{children}</div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onBatal}
            disabled={pending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {batalLabel}
          </button>
          <button
            type="button"
            onClick={onKonfirmasi}
            disabled={pending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${warnaTombol}`}
          >
            {pending ? "Memproses..." : konfirmasiLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
