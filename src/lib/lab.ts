// ============================================================================
// Helper fitur Lab Coding (Tahap 17).
// ============================================================================

// Normalisasi keluaran untuk perbandingan otomatis:
// - samakan akhir baris (\r\n → \n)
// - buang spasi/tab di ujung tiap baris
// - buang baris kosong di awal & akhir
export function normalisasiKeluaran(teks: string): string {
  return teks
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((baris) => baris.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

export function keluaranCocok(hasil: string, diharapkan: string): boolean {
  return normalisasiKeluaran(hasil) === normalisasiKeluaran(diharapkan);
}

// Jumlah baris untuk tampilan ringkas.
export function jumlahBaris(teks: string): number {
  if (!teks) return 0;
  return teks.replace(/\r\n/g, "\n").split("\n").length;
}

// ============================================================================
// Penguncian tantangan berurutan.
// Level pertama selalu terbuka; level berikutnya terbuka hanya kalau level
// sebelumnya sudah pernah benar. Mengembalikan daftar level yang terkunci.
// ============================================================================
export function hitungLevelTerkunci(
  levels: number[],
  selesai: Set<number>,
): number[] {
  const urut = [...levels].sort((a, b) => a - b);
  const terkunci: number[] = [];
  let terbuka = true;

  for (const level of urut) {
    if (!terbuka) {
      terkunci.push(level);
      continue;
    }
    // Level ini terbuka; level setelahnya baru terbuka kalau ini sudah benar.
    terbuka = selesai.has(level);
  }

  return terkunci;
}

// ============================================================================
// Validasi "karya bebas" (tantangan tanpa target output tetap).
// Hasil analisis kode datang dari worker Pyodide (AST), bukan dari jawaban.
// ============================================================================
export type AnalisisBebas = {
  ok: boolean;
  error?: string | null;
  jumlah_variabel: number;
  variabel_teks: number;
  variabel_angka: number;
  jumlah_print: number;
  variabel_didefinisikan: string[];
  variabel_tak_dipakai: string[];
};

export type AturanBebas = {
  min_variabel?: number;
  min_teks?: number;
  min_angka?: number;
  min_print?: number;
  min_baris?: number;
  variabel_wajib?: string[];
  // Penanda tantangan puncak (mis. level 15 "FINAL BOSS").
  final_boss?: boolean;
  // Badge yang diberikan saat tantangan puncak berhasil (mis. "PRINT MASTER").
  badge?: string;
};

// Cek variabel wajib: setiap nama harus dibuat dan dipakai di print().
// Dipakai untuk tantangan 1-14 (selain output harus cocok).
export function cekVariabelWajib(
  analisis: AnalisisBebas | null | undefined,
  wajib: string[],
): { benar: boolean; petunjuk: string | null } {
  if (wajib.length === 0) return { benar: true, petunjuk: null };

  if (!analisis || !analisis.ok) {
    return {
      benar: false,
      petunjuk:
        "Kode belum bisa dianalisis. Pastikan tidak ada kesalahan penulisan, lalu coba lagi.",
    };
  }

  const terdefinisi = new Set(analisis.variabel_didefinisikan ?? []);
  const takDipakai = new Set(analisis.variabel_tak_dipakai ?? []);

  const belumDibuat = wajib.filter((nama) => !terdefinisi.has(nama));
  const belumDitampilkan = wajib.filter(
    (nama) => terdefinisi.has(nama) && takDipakai.has(nama),
  );

  if (belumDibuat.length === 0 && belumDitampilkan.length === 0) {
    return { benar: true, petunjuk: null };
  }

  const pesan: string[] = [];
  if (belumDibuat.length > 0) {
    pesan.push(`buat variabel: ${belumDibuat.join(", ")}`);
  }
  if (belumDitampilkan.length > 0) {
    pesan.push(`tampilkan variabel ini dengan print(): ${belumDitampilkan.join(", ")}`);
  }
  return {
    benar: false,
    petunjuk: `Tantangan ini harus memakai variabel. ${pesan.join("; ")}.`,
  };
}

export function cekKaryaBebas(
  analisis: AnalisisBebas | null | undefined,
  keluaran: string,
  aturan: AturanBebas,
): { benar: boolean; petunjuk: string | null } {
  if (!analisis || !analisis.ok) {
    return {
      benar: false,
      petunjuk:
        "Kode belum bisa dianalisis. Pastikan tidak ada kesalahan penulisan, lalu coba lagi.",
    };
  }

  const baris = normalisasiKeluaran(keluaran)
    .split("\n")
    .filter((b) => b.trim().length > 0).length;

  const gagal: string[] = [];
  const minVariabel = aturan.min_variabel ?? 0;
  const minTeks = aturan.min_teks ?? 0;
  const minAngka = aturan.min_angka ?? 0;
  const minPrint = aturan.min_print ?? 0;
  const minBaris = aturan.min_baris ?? 0;

  if (analisis.jumlah_variabel < minVariabel) {
    gagal.push(`buat minimal ${minVariabel} variabel`);
  }
  if (analisis.variabel_teks < minTeks) {
    gagal.push(`minimal ${minTeks} variabel berisi teks`);
  }
  if (analisis.variabel_angka < minAngka) {
    gagal.push(`minimal ${minAngka} variabel berisi angka`);
  }
  if (analisis.jumlah_print < minPrint) {
    gagal.push(`minimal ${minPrint} perintah print()`);
  }
  if (analisis.variabel_tak_dipakai.length > 0) {
    gagal.push(
      `tampilkan variabel ini dengan print(): ${analisis.variabel_tak_dipakai.join(", ")}`,
    );
  }
  if (!keluaran.trim()) {
    gagal.push("output tidak boleh kosong");
  }
  if (baris < minBaris) {
    gagal.push(`output minimal ${minBaris} baris`);
  }

  if (gagal.length === 0) return { benar: true, petunjuk: null };
  return { benar: false, petunjuk: `Belum lengkap: ${gagal.join("; ")}.` };
}
