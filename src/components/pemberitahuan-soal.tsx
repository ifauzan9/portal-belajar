import { Notifikasi } from "@/components/ui/notifikasi";

// ============================================================================
// Banner "akses soal ditutup oleh guru" untuk portal siswa (Tahap 41).
//
// Hanya tampilan. Penegakan sebenarnya tetap di server: halaman menolak
// membuka soal dan Server Action menolak memulai/menyimpan.
// ============================================================================

export type JenisSoal = "ulangan" | "lab" | "keduanya";

const JUDUL: Record<JenisSoal, string> = {
  ulangan: "Akses soal ulangan ditutup oleh guru",
  lab: "Akses soal Lab Coding ditutup oleh guru",
  keduanya: "Akses soal ditutup oleh guru",
};

const KETERANGAN: Record<JenisSoal, string> = {
  ulangan:
    "Soal ulangan sementara tidak bisa dibuka atau dikerjakan. Nilai yang sudah ada tetap bisa kamu lihat.",
  lab: "Modul dan level Lab Coding sementara tidak bisa dibuka. Progres yang sudah tersimpan tidak hilang.",
  keduanya:
    "Soal ulangan dan Lab Coding sementara tidak bisa dibuka. Nilai serta progres yang sudah ada tetap aman.",
};

export function PemberitahuanSoalDitutup({
  jenis = "keduanya",
  pesan,
  className = "",
}: {
  jenis?: JenisSoal;
  /** Pesan dari guru. Kosong = pakai keterangan bawaan. */
  pesan?: string | null;
  className?: string;
}) {
  const teks = (pesan ?? "").trim() || KETERANGAN[jenis];

  return (
    <Notifikasi
      varian="peringatan"
      judul={JUDUL[jenis]}
      className={className}
    >
      <p>{teks}</p>
      {teks !== KETERANGAN[jenis] ? (
        <p className="mt-1 text-xs opacity-80">{KETERANGAN[jenis]}</p>
      ) : null}
    </Notifikasi>
  );
}
