// ============================================================================
// Helper & konstanta fitur Tugas (Tahap 16).
// Dipakai server action (validasi) dan halaman (tampilan).
// ============================================================================

export type MetodePengumpulan = "link" | "file" | "keduanya";

export const METODE_VALID: MetodePengumpulan[] = ["link", "file", "keduanya"];

export const LABEL_METODE: Record<MetodePengumpulan, string> = {
  link: "Link saja",
  file: "File saja",
  keduanya: "Link & file",
};

export function bacaMetode(nilai: unknown): MetodePengumpulan {
  const teks = String(nilai ?? "").trim();
  return (METODE_VALID as string[]).includes(teks)
    ? (teks as MetodePengumpulan)
    : "link";
}

export function metodeMengizinkanLink(metode: MetodePengumpulan): boolean {
  return metode === "link" || metode === "keduanya";
}

export function metodeMengizinkanFile(metode: MetodePengumpulan): boolean {
  return metode === "file" || metode === "keduanya";
}

// ---------------------------------------------------------------------------
// Berkas
// ---------------------------------------------------------------------------

export const BUCKET_TUGAS = "tugas";
export const MAKS_FILE_MB = 5;
export const MAKS_FILE = 5;

export type GrupFile = { id: string; label: string; ekstensi: string[] };

// Kelompok jenis file yang bisa dicentang guru di form tugas.
export const GRUP_FILE: GrupFile[] = [
  {
    id: "foto",
    label: "Foto (JPG/PNG)",
    ekstensi: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
  },
  { id: "pdf", label: "PDF", ekstensi: [".pdf"] },
  { id: "word", label: "Word (DOC/DOCX)", ekstensi: [".doc", ".docx"] },
  { id: "excel", label: "Excel (XLS/XLSX)", ekstensi: [".xls", ".xlsx"] },
  { id: "ppt", label: "PowerPoint (PPT/PPTX)", ekstensi: [".ppt", ".pptx"] },
  { id: "zip", label: "ZIP", ekstensi: [".zip"] },
];

// Daftar ekstensi aman bila guru tidak memilih jenis file apa pun.
export const EKSTENSI_AMAN: string[] = Array.from(
  new Set(GRUP_FILE.flatMap((grup) => grup.ekstensi)),
);

const EKSTENSI_FOTO = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".heic",
];

export function ekstensiDari(nama: string): string {
  const titik = nama.lastIndexOf(".");
  if (titik < 0) return "";
  return nama.slice(titik).toLowerCase();
}

// Klasifikasi foto vs dokumen (untuk pratinjau di sisi guru).
export function tipeDariNama(nama: string): "foto" | "dokumen" {
  return EKSTENSI_FOTO.includes(ekstensiDari(nama)) ? "foto" : "dokumen";
}

// Ekstensi yang diizinkan: pakai pilihan guru kalau ada; kalau kosong
// pakai daftar aman bawaan.
export function daftarEkstensiDiizinkan(
  fileDiizinkan: string[] | null | undefined,
): string[] {
  const bersih = (fileDiizinkan ?? [])
    .map((ekstensi) => ekstensi.toLowerCase())
    .filter(Boolean);
  return bersih.length > 0 ? bersih : EKSTENSI_AMAN;
}

export function fileDiizinkan(nama: string, daftar: string[]): boolean {
  return daftar.includes(ekstensiDari(nama));
}

// Membaca checkbox "file_diizinkan[]" dari FormData. Hanya ekstensi
// yang dikenal yang diterima.
export function bacaFileDiizinkan(formData: FormData): string[] {
  const nilai = formData.getAll("file_diizinkan[]");
  const hasil: string[] = [];

  for (const item of nilai) {
    if (typeof item !== "string") continue;
    const ekstensi = item.trim().toLowerCase();
    if (ekstensi && EKSTENSI_AMAN.includes(ekstensi) && !hasil.includes(ekstensi)) {
      hasil.push(ekstensi);
    }
  }

  return hasil;
}

// Nama file yang aman dipakai sebagai bagian path storage.
export function bersihkanNamaFile(nama: string): string {
  const dasar = nama.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return dasar || "berkas";
}

export function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Public URL berkas di bucket "tugas".
export function urlPublikBerkas(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${BUCKET_TUGAS}/${path}`;
}

// Daftar id kelas yang berlaku untuk sebuah tugas. [] = semua kelas.
export function ambilKelasTugas(row: {
  assignment_classes?: { kelas_id: string }[] | null;
}): string[] {
  const hasil: string[] = [];
  for (const hub of row.assignment_classes ?? []) {
    if (hub.kelas_id && !hasil.includes(hub.kelas_id)) hasil.push(hub.kelas_id);
  }
  return hasil;
}

// Normalisasi tautan siswa: tambah https:// kalau belum ada skema.
export function normalisasiTautan(tautan: string): string | null {
  const teks = tautan.trim();
  if (!teks) return null;
  if (/^https?:\/\//i.test(teks)) return teks;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(teks)) return `https://${teks}`;
  return teks;
}

// Tugas dianggap terbuka kecuali eksplisit ditutup guru (dibuka === false).
// Aman kalau kolom belum ada / null → dianggap terbuka.
export function tugasDibuka(row: { dibuka?: boolean | null }): boolean {
  return row.dibuka !== false;
}
