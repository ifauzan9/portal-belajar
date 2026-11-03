"use client";

import { useEffect, useRef } from "react";
import { simpanLokasiSiswa } from "@/app/siswa/actions";

// ============================================================================
// Pelacak lokasi siswa (GPS perangkat).
//
// Dipasang di dashboard siswa dan berjalan SEKALI per pemuatan halaman.
// Tidak menampilkan apa pun dan tidak pernah menghalangi siswa:
//  - izin dikabulkan  → koordinat + akurasi dikirim ke server
//  - izin ditolak     → dicatat "ditolak"
//  - browser tak dukung / gagal → dicatat apa adanya
//
// Semua pengiriman memakai Server Action, jadi sesi siswa tetap diverifikasi
// di server (browser hanya menyuplai angka, bukan identitas).
//
// Catatan: browser hanya memberi lokasi lewat HTTPS (atau localhost).
// Di HTTP biasa (mis. diakses dari HP via IP LAN) statusnya "tidak_didukung".
// ============================================================================

export function PelacakLokasi() {
  // Cegah kirim dobel saat React me-remount komponen di mode ketat dev.
  const sudahJalan = useRef(false);

  useEffect(() => {
    if (sudahJalan.current) return;
    sudahJalan.current = true;

    // Browser tanpa Geolocation API (atau halaman non-HTTPS).
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation ||
      !window.isSecureContext
    ) {
      void simpanLokasiSiswa("tidak_didukung", null, null, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posisi) => {
        const { latitude, longitude, accuracy } = posisi.coords;
        void simpanLokasiSiswa("diizinkan", latitude, longitude, accuracy);
      },
      (galat) => {
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (galat.code === galat.PERMISSION_DENIED) {
          void simpanLokasiSiswa("ditolak", null, null, null);
        } else {
          void simpanLokasiSiswa("gagal", null, null, null);
        }
      },
      {
        // Akurasi terbaik yang tersedia; tunggu sampai 15 detik.
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    );
  }, []);

  return null;
}
