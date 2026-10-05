"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function kunciRuteSekarang(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

// Memberi tahu siswa bahwa klik/tombol sudah diterima dan halaman berikutnya
// sedang dimuat. Muncul saat menavigasi ke halaman lain (termasuk lewat
// tombol/link) dan berhenti otomatis ketika rute sudah berganti.
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kunciSekarang = kunciRuteSekarang(pathname, searchParams.toString());

  // Rute tempat navigasi dimulai. Selama rute sekarang masih sama, berarti
  // navigasi belum selesai -> indikator aktif.
  const [ruteAwal, setRuteAwal] = useState<string | null>(null);
  const [mulaiPil, setMulaiPil] = useState(false);
  const aktif = ruteAwal !== null && ruteAwal === kunciSekarang;

  const batasRef = useRef<number | null>(null);
  const pilRef = useRef<number | null>(null);

  useEffect(() => {
    function mulai() {
      setRuteAwal(
        kunciRuteSekarang(window.location.pathname, window.location.search),
      );
      setMulaiPil(false);

      // Batas aman kalau navigasi gagal/tidak jadi.
      if (batasRef.current) window.clearTimeout(batasRef.current);
      batasRef.current = window.setTimeout(() => {
        setRuteAwal(null);
        setMulaiPil(false);
      }, 12000);

      // Pil teks muncul setelah jeda singkat agar tidak berkedip pada
      // navigasi yang cepat.
      if (pilRef.current) window.clearTimeout(pilRef.current);
      pilRef.current = window.setTimeout(() => setMulaiPil(true), 180);
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      mulai();
    }

    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", mulai);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", mulai);
      if (batasRef.current) window.clearTimeout(batasRef.current);
      if (pilRef.current) window.clearTimeout(pilRef.current);
    };
  }, []);

  return (
    <>
      {/* Bilah tipis di paling atas */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-150 ${
          aktif ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="nav-progress-bar h-full w-1/3 rounded-full bg-emerald-500" />
      </div>

      {/* Pil kecil sebagai penanda "sedang memuat" */}
      <div
        aria-hidden={!(aktif && mulaiPil)}
        className={`pointer-events-none fixed top-3 left-1/2 z-[100] -translate-x-1/2 transition-opacity duration-150 ${
          aktif && mulaiPil ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="flex items-center gap-2 rounded-full bg-slate-900/95 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Memuat halaman...
        </span>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {aktif ? "Memuat halaman..." : ""}
      </p>
    </>
  );
}
