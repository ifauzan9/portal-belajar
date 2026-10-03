// Membaca array id kelas dari FormData (input checkbox bernama "kelas[]").
// Nilai yang tidak ada / kosong / bukan string → diabaikan.
export function bacaKelasDariForm(formData: FormData): string[] {
  const nilai = formData.getAll("kelas[]");
  const hasil: string[] = [];

  for (const item of nilai) {
    if (typeof item === "string") {
      const id = item.trim();
      if (id && !hasil.includes(id)) {
        hasil.push(id);
      }
    }
  }

  return hasil;
}

// Menyusun teks untuk tampilan kolom "Berlaku Untuk".
// Contoh: ["7A","7B","7C"] → "7A, 7B, +1" (maks. 3 nama, sisanya jadi +n).
// Array kosong → "Semua kelas".
export function ringkasKelas(daftarNama: string[], maksimal = 3): string {
  if (daftarNama.length === 0) {
    return "Semua kelas";
  }

  if (daftarNama.length <= maksimal) {
    return daftarNama.join(", ");
  }

  const tampil = daftarNama.slice(0, maksimal).join(", ");
  const sisa = daftarNama.length - maksimal;
  return `${tampil}, +${sisa}`;
}

// Nama-nama kelas yang ditampilkan bisa lebih dari `maksimal`,
// jadi tooltip butuh daftar lengkapnya. Dipisah agar fungsi
// ringkasKelas tetap satu tujuan dan mudah dites.
export function daftarSepenuhnya(daftarNama: string[]): string {
  if (daftarNama.length === 0) {
    return "Berlaku untuk semua kelas";
  }
  return daftarNama.join(", ");
}
