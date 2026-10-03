"use client";

import Link from "next/link";
import type { Arah } from "@/lib/urutkan-siswa";

// Judul kolom yang bisa diklik untuk mengubah urutan.
// Klik kolom yang sama akan membalik arah.
export function KepalaUrut({
  label,
  href,
  aktif,
  arah,
  align = "left",
}: {
  label: string;
  href: string;
  aktif: boolean;
  arah: Arah;
  // Perataan tombol urut ke header (default kiri).
  align?: "left" | "right";
}) {
  const alignClass =
    align === "right"
      ? "text-right"
      : "text-left";

  return (
    <th
      scope="col"
      className={`px-4 py-3 font-medium sm:px-5 ${alignClass}`}
    >
      <Link
        href={href}
        title={
          aktif && arah === "asc"
            ? "Sedang urut naik, klik untuk urut turun"
            : "Klik untuk urutkan"
        }
        className={`-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 transition ${
          aktif
            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
            : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
        } ${align === "right" ? "float-right" : ""}`}
      >
        {label}
        <span aria-hidden="true" className="text-xs">
          {aktif ? (arah === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}
