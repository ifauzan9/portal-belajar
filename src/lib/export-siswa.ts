import writeXlsxFile from "write-excel-file/node";

export type BarisSiswaExport = {
  nis: string | null;
  nama_siswa: string;
  kelas: string;
};

// Menulis daftar siswa menjadi data .xlsx (kolom: No, NIS, Nama, Kelas).
export async function buatXlsxSiswa(rows: BarisSiswaExport[]) {
  const hasil = await writeXlsxFile([
    ["No", "NIS", "Nama", "Kelas"],
    ...rows.map((row, index) => [
      index + 1,
      row.nis ?? "",
      row.nama_siswa,
      row.kelas,
    ]),
  ]);

  return hasil.toBuffer();
}
