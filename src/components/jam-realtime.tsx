"use client";

import { useSyncExternalStore } from "react";

// ============================================================================
// Jam realtime — menampilkan tanggal hari ini + jam (berdetak tiap detik).
//
// Memakai useSyncExternalStore agar tidak ada hydration mismatch dan tidak
// memanggil setState di dalam effect. Server merender placeholder "—",
// lalu klien mengisi waktu sebenarnya setelah mount.
// ============================================================================

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

// Snapshot berupa detik (stabil dalam 1 detik) supaya React bisa
// membandingkan nilai dan hanya re-render saat berubah.
function getSnapshot() {
  return Math.floor(Date.now() / 1000);
}

function getServerSnapshot() {
  return 0;
}

export function JamRealtime({ className = "" }: { className?: string }) {
  const detik = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (detik === 0) {
    return <span className={`tabular-nums ${className}`}>—</span>;
  }

  const sekarang = new Date(detik * 1000);

  const tanggal = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(sekarang);

  const jam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(sekarang);

  return (
    <span className={className}>
      {tanggal} · <span className="tabular-nums font-medium">{jam}</span>
    </span>
  );
}
