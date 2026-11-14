// ============================================================================
// Batas nilai dan status remedial ulangan.
//
// Skala nilai aplikasi adalah 0–100. Nilai 75 ke atas dianggap tidak
// remedial (tuntas); di bawah 75 remedial. Konstanta KKM dipakai bersama
// oleh halaman siswa dan guru supaya labelnya konsisten.
// ============================================================================

export const NILAI_MIN = 0;
export const NILAI_MAKS = 100;
export const KKM_ULANGAN = 75;

export type StatusNilaiView = {
  label: "Tidak remedial" | "Remedial";
  varian: "sukses" | "bahaya";
};

export type StatusLulusView = {
  label: "Lulus" | "Remedial";
  varian: "sukses" | "bahaya";
};

// Membulatkan ke bawah lalu menjepit ke rentang 0–100. Nilai bukan angka
// dianggap 0 supaya tidak ada angka NaN yang masuk ke database.
export function batasiNilai(nilai: number): number {
  if (!Number.isFinite(nilai)) return NILAI_MIN;
  return Math.max(NILAI_MIN, Math.min(NILAI_MAKS, Math.floor(nilai)));
}

export function statusNilai(
  nilai: number | null | undefined,
): StatusNilaiView | null {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) {
    return null;
  }

  return nilai >= KKM_ULANGAN
    ? { label: "Tidak remedial", varian: "sukses" }
    : { label: "Remedial", varian: "bahaya" };
}

// Varian label untuk halaman ranking: "Lulus" lebih ringkas daripada
// "Tidak remedial", tetapi aturan ambangnya sama.
export function statusLulus(
  nilai: number | null | undefined,
): StatusLulusView | null {
  const status = statusNilai(nilai);
  if (!status) return null;

  return status.label === "Tidak remedial"
    ? { label: "Lulus", varian: "sukses" }
    : { label: "Remedial", varian: "bahaya" };
}
