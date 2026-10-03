import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Izinkan upload file Excel & berkas tugas (default Next.js hanya 1 MB).
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  // Rute login siswa dipindah keluar dari /siswa/ agar tidak mewarisi
  // layout ber-sidebar. URL lama tetap diarahkan ke URL baru.
  async redirects() {
    return [
      {
        source: "/siswa/login",
        destination: "/login-siswa",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
