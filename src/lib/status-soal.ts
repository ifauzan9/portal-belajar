// ============================================================================
// Status akses soal ulangan untuk tampilan siswa.
//
// Dipakai bersama oleh daftar ulangan, dashboard, dan halaman nilai supaya
// badge "Soal dibuka" / "Soal ditutup" konsisten. Status ini terpisah dari
// status pengerjaan ("Sudah dikerjakan", "Sedang dikerjakan", dst.) karena
// siswa yang sudah selesai tetap perlu tahu apakah soal masih dibuka guru.
// ============================================================================

export type StatusAksesSoalView = {
  label: string;
  varian: "netral" | "info" | "sukses" | "bahaya" | "peringatan";
};

export function statusAksesSoal(u: {
  status: "akan" | "sudah";
  dibuka: boolean;
  bolehSoal: boolean;
  deadlineLewat: boolean;
  belumWaktunya: boolean;
}): StatusAksesSoalView | null {
  // Ulangan manual ("sudah") tidak punya soal online.
  if (u.status !== "akan") return null;

  if (!u.dibuka || !u.bolehSoal || u.deadlineLewat) {
    return { label: "Soal ditutup", varian: "bahaya" };
  }

  if (u.belumWaktunya) {
    return { label: "Soal belum dibuka", varian: "peringatan" };
  }

  return { label: "Soal dibuka", varian: "sukses" };
}
