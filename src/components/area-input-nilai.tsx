"use client";

import { useState } from "react";
import { ImportNilaiPanel } from "@/components/import-nilai-panel";
import { SimpanNilaiForm } from "@/components/simpan-nilai-form";
import type { InfoRanking } from "@/app/guru/ulangan/[id]/nilai/page";

type SiswaBaris = {
  id: string;
  nis: string | null;
  nama_siswa: string;
  nilai: number | null;
};

export function AreaInputNilai({
  examId,
  daftarSiswa,
  ranking,
  mapSiswaIdKeNamaKelas,
}: {
  examId: string;
  daftarSiswa: SiswaBaris[];
  ranking: Map<string, InfoRanking>;
  // Nama kelas per siswa (untuk kolom "Kelas" di tabel input nilai)
  mapSiswaIdKeNamaKelas: Map<string, string>;
}) {
  const [nilaiImport, setNilaiImport] = useState<Map<string, number> | null>(
    null,
  );

  // ImportNilaiPanel memanggil ini setelah guru klik "Simpan nilai ke form"
  const onSimpanPratinjau = (nilai: Map<string, number>) => {
    setNilaiImport(nilai);
  };

  // Setelah nilai di-commit ke DB, reset nilaiImport sehingga form
  // kembali menampilkan data dari DB dan pratinjau bisa ditutup dengan bersih.
  const onNilaiTersimpan = () => {
    setNilaiImport(null);
  };

  return (
    <div className="space-y-4">
      <ImportNilaiPanel examId={examId} onSimpanPratinjau={onSimpanPratinjau} />

      <SimpanNilaiForm
        examId={examId}
        daftarSiswa={daftarSiswa}
        nilaiImport={nilaiImport}
        onTersimpan={onNilaiTersimpan}
        ranking={ranking}
        mapSiswaIdKeNamaKelas={mapSiswaIdKeNamaKelas}
      />
    </div>
  );
}
