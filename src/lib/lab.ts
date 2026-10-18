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

// ============================================================================
// Perbandingan per baris untuk petunjuk yang spesifik.
// Spasi di ujung baris dan line ending diabaikan; spasi di AWAL baris dan
// huruf besar/kecil tetap dianggap bermakna.
// ============================================================================
export type HasilBanding = {
  cocok: boolean;
  /** Nomor baris (1-based) pertama yang berbeda, null kalau cocok. */
  barisBeda: number | null;
  jenis: "cocok" | "kurang" | "lebih" | "teks" | "spasi-awal";
  jumlahHasil: number;
  jumlahTarget: number;
};

export function bandingkanPerBaris(
  hasil: string,
  diharapkan: string,
): HasilBanding {
  const a = normalisasiKeluaran(hasil).split("\n");
  const b = normalisasiKeluaran(diharapkan).split("\n");
  const kosong = normalisasiKeluaran(hasil) === "" && normalisasiKeluaran(diharapkan) === "";
  if (kosong) {
    return { cocok: true, barisBeda: null, jenis: "cocok", jumlahHasil: 0, jumlahTarget: 0 };
  }

  // Sesuai urutan pemeriksaan: jumlah baris dulu, lalu isi baris.
  if (a.length < b.length) {
    return {
      cocok: false,
      barisBeda: a.length + 1,
      jenis: "kurang",
      jumlahHasil: a.length,
      jumlahTarget: b.length,
    };
  }
  if (a.length > b.length) {
    return {
      cocok: false,
      barisBeda: b.length + 1,
      jenis: "lebih",
      jumlahHasil: a.length,
      jumlahTarget: b.length,
    };
  }

  const jumlah = Math.min(a.length, b.length);
  for (let i = 0; i < jumlah; i++) {
    if (a[i] === b[i]) continue;
    const samaTanpaSpasi = a[i].trimStart() === b[i].trimStart();
    return {
      cocok: false,
      barisBeda: i + 1,
      jenis: samaTanpaSpasi ? "spasi-awal" : "teks",
      jumlahHasil: a.length,
      jumlahTarget: b.length,
    };
  }

  return {
    cocok: true,
    barisBeda: null,
    jenis: "cocok",
    jumlahHasil: a.length,
    jumlahTarget: b.length,
  };
}

// Pesan bantuan berdasarkan hasil perbandingan. Tidak pernah memuat isi
// target, supaya siswa tetap harus membaca dan memperbaiki sendiri.
export function pesanBanding(banding: HasilBanding): string {
  switch (banding.jenis) {
    case "kurang":
      return `Program baru menampilkan ${banding.jumlahHasil} baris, target ${banding.jumlahTarget} baris. Baris ke-${banding.barisBeda} belum ada.`;
    case "lebih":
      return `Program menampilkan ${banding.jumlahHasil} baris, target ${banding.jumlahTarget} baris. Ada baris tambahan mulai baris ke-${banding.barisBeda}.`;
    case "spasi-awal":
      return `Baris ke-${banding.barisBeda} isinya hampir sama, tetapi spasi di depannya berbeda.`;
    case "teks":
      return `Output baris ke-${banding.barisBeda} belum sesuai dengan target.`;
    default:
      return "Output sudah sesuai.";
  }
}

// Pecah input wajib (satu baris per input()) menjadi daftar baris.
// Baris kosong di akhir dibuang karena hanya artefak penyimpanan.
export function pecahInput(teks: string | null | undefined): string[] {
  if (!teks) return [];
  const baris = String(teks).replace(/\r\n/g, "\n").split("\n");
  while (baris.length > 0 && baris[baris.length - 1].trim() === "") baris.pop();
  return baris;
}

// Apakah input yang benar-benar dipakai siswa sama dengan input wajib?
// Seluruh baris wajib harus dipakai; baris tambahan (cadangan level bebas)
// tidak diwajibkan. Dipakai untuk menolak jawaban yang mengubah input wajib
// supaya cocok dengan target.
export function inputSesuaiWajib(
  dipakai: string[] | null | undefined,
  wajib: string[],
): boolean {
  if (wajib.length === 0) return true;
  if (!Array.isArray(dipakai) || dipakai.length < wajib.length) return false;
  return wajib.every((nilai, i) => String(dipakai[i]) === nilai);
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
  jumlah_input?: number;
  jumlah_loop?: number;
  input_berprompt?: number;
  variabel_didefinisikan: string[];
  variabel_input?: string[];
  variabel_tak_dipakai: string[];
  /** Variabel yang diisi input() lalu ditimpa nilai tetap. */
  variabel_ditimpa?: string[];
  /** Variabel yang print()-nya muncul sebelum input()-nya. */
  variabel_print_sebelum_input?: string[];
  /** Teks pertanyaan tiap input(), sesuai urutan pemanggilan. */
  input_pertanyaan?: string[];
};

export type AturanBebas = {
  min_variabel?: number;
  min_teks?: number;
  min_angka?: number;
  min_print?: number;
  min_baris?: number;
  min_input?: number;
  variabel_wajib?: string[];
  // Setiap variabel wajib harus berasal dari input(), bukan nilai tetap.
  dari_input?: boolean;
  // Larangan perulangan (for/while) untuk tantangan yang memintanya.
  tanpa_loop?: boolean;
  // Wajib punya satu baris garis/bingkai (simbol sama berulang).
  wajib_garis?: boolean;
  // Output dengan input berbeda harus ikut berubah (bukan jawaban hardcode).
  wajib_dinamis?: boolean;
  // Penanda tantangan puncak (mis. level 15 "FINAL BOSS").
  final_boss?: boolean;
  // Badge yang diberikan saat tantangan puncak berhasil (mis. "PRINT MASTER").
  badge?: string;
};

// Apakah output punya minimal satu baris garis/bingkai, mis. "========".
export function adaGarisBingkai(teks: string): boolean {
  return normalisasiKeluaran(teks)
    .split("\n")
    .some((baris) => {
      const isi = baris.trim();
      return (
        isi.length >= 5 &&
        /^(.)\1+$/.test(isi) &&
        /[^A-Za-z0-9\s]/.test(isi)
      );
    });
}

// Cek variabel wajib: setiap nama harus dibuat dan dipakai di print().
// Dipakai untuk tantangan 1-14 (selain output harus cocok).
// Kalau `dariInput` aktif, isi variabel juga harus berasal dari input().
export function cekVariabelWajib(
  analisis: AnalisisBebas | null | undefined,
  wajib: string[],
  opsi?: { dariInput?: boolean },
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
  const dariInput = new Set(analisis.variabel_input ?? []);
  const ditimpa = new Set(analisis.variabel_ditimpa ?? []);
  const printSebelumInput = new Set(
    analisis.variabel_print_sebelum_input ?? [],
  );

  const belumDibuat = wajib.filter((nama) => !terdefinisi.has(nama));
  const belumDitampilkan = wajib.filter(
    (nama) => terdefinisi.has(nama) && takDipakai.has(nama),
  );
  const belumDariInput =
    opsi?.dariInput === true
      ? wajib.filter((nama) => terdefinisi.has(nama) && !dariInput.has(nama))
      : [];
  // Aliran data: nilai dari input() harus tetap sampai ke print().
  const nilaiDitimpa = wajib.filter((nama) => ditimpa.has(nama));
  const urutanSalah = wajib.filter(
    (nama) => terdefinisi.has(nama) && printSebelumInput.has(nama),
  );

  if (
    belumDibuat.length === 0 &&
    belumDitampilkan.length === 0 &&
    belumDariInput.length === 0 &&
    nilaiDitimpa.length === 0 &&
    urutanSalah.length === 0
  ) {
    return { benar: true, petunjuk: null };
  }

  const pesan: string[] = [];
  if (belumDibuat.length > 0) {
    pesan.push(`buat variabel: ${belumDibuat.join(", ")}`);
  }
  if (belumDariInput.length > 0) {
    pesan.push(
      `isi variabel ini dari input(): ${belumDariInput.join(", ")}`,
    );
  }
  if (nilaiDitimpa.length > 0) {
    pesan.push(
      `jangan timpa variabel ${nilaiDitimpa.join(", ")} dengan nilai tetap setelah input()`,
    );
  }
  if (urutanSalah.length > 0) {
    pesan.push(
      `panggil print() untuk ${urutanSalah.join(", ")} setelah input()-nya`,
    );
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
  const minInput = aturan.min_input ?? 0;

  if (analisis.jumlah_variabel < minVariabel) {
    gagal.push(`buat minimal ${minVariabel} variabel`);
  }
  if ((analisis.jumlah_input ?? 0) < minInput) {
    gagal.push(`pakai minimal ${minInput} perintah input()`);
  }
  if (aturan.tanpa_loop && (analisis.jumlah_loop ?? 0) > 0) {
    gagal.push("jangan memakai perulangan (for/while)");
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
  if (aturan.wajib_garis && !adaGarisBingkai(keluaran)) {
    gagal.push("tambahkan garis/bingkai dari simbol berulang (mis. =====)");
  }

  if (gagal.length === 0) return { benar: true, petunjuk: null };
  return { benar: false, petunjuk: `Belum lengkap: ${gagal.join("; ")}.` };
}
