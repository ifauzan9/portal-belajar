import writeXlsxFile from "write-excel-file/node";

export type BarisKredensialExport = {
  nama: string;
  nis: string;
  username: string;
  password: string;
};

// Menulis daftar kredensial siswa menjadi data .xlsx
// (kolom: Nama, NIS, Username, Password). Dipakai setelah "Buat Sekarang"
// supaya guru bisa mendistribusikan file ke siswa.
export async function buatXlsxKredensial(rows: BarisKredensialExport[]) {
  const hasil = await writeXlsxFile([
    ["Nama", "NIS", "Username", "Password"],
    ...rows.map((row) => [
      row.nama,
      row.nis,
      row.username,
      row.password,
    ]),
  ]);

  return hasil.toBuffer();
}
