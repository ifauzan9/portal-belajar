"use client";

import type { ReactNode } from "react";

// Membungkus teks soal agar tidak bisa disalin saat guru mengaktifkan
// blokir copy-paste. Ini hanya pengaman di sisi browser, bukan keamanan
// absolut: devtools/OCR tetap bisa dipakai untuk mengambil teks.
export function TeksSoalTerlindungi({
  aktif,
  children,
  className = "",
}: {
  aktif: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${className}${aktif ? " select-none" : ""}`}
      onCopy={aktif ? (event) => event.preventDefault() : undefined}
      onCut={aktif ? (event) => event.preventDefault() : undefined}
      onContextMenu={
        aktif ? (event) => event.preventDefault() : undefined
      }
      onDragStart={aktif ? (event) => event.preventDefault() : undefined}
      onKeyDown={
        aktif
          ? (event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                ["a", "c", "x"].includes(event.key.toLowerCase())
              ) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
