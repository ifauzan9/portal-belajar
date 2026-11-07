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

export type BobotNilaiKode = {
  output?: number;
  output_uji?: number;
  variabel?: number;
  jumlah?: number;
};

export type AturanBebas = {
  // Bobot penilaian parsial soal ulangan jenis kode (opsional).
  bobot?: BobotNilaiKode;
  min_variabel?: number;
  min_teks?: number;
  min_angka?: number;
  min_print?: number;
  min_baris?: number;
  min_input?: number;
  maks_input?: number;
  variabel_wajib?: string[];
  // Variabel yang nilainya ditulis langsung di kode (bukan dari input()).
  // Contoh: { ruang: "Lab Komputer 1", tanggal: "10 November 2026" }.
  variabel_tetap?: Record<string, string>;
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

  // --- Pesan khusus tugas praktik (opsional) ---
  // Kalau diisi, teks ini dipakai apa adanya sebagai pesan hasil, menggantikan
  // pesan bawaan. Dibiarkan kosong untuk modul lama supaya pesannya tidak
  // berubah.
  pesan_benar?: string;
  pesan_salah?: string;
  // Ditampilkan saat input yang dipakai bukan input wajib.
  pesan_input_salah?: string;
  // Soal yang menganjurkan input("Teks: "). Kalau true, petunjuk "jangan
  // menulis teks di dalam input()" dimatikan karena justru menyesatkan.
  izinkan_prompt?: boolean;
};

// Pesan baku untuk tugas praktik. Dipakai sebagai nilai bawaan kalau `aturan`
// tidak menyebutkan pesan sendiri.
export const PESAN_TUGAS_BENAR =
  "Selamat! Program berhasil dan seluruh ketentuan tugas telah terpenuhi.";
export const PESAN_TUGAS_SALAH =
  "Program belum sesuai. Periksa kembali penggunaan input(), variabel, dan print().";
export const PESAN_INPUT_SALAH =
  "Input belum sesuai. Gunakan data yang diminta pada soal.";

// Gabungkan pesan pokok dengan petunjuk spesifik, tanpa mengulang titik.
export function gabungPesan(pokok: string, petunjuk: string | null): string {
  if (!petunjuk) return pokok;
  const bersih = petunjuk.trim();
  if (!bersih) return pokok;
  return `${pokok} ${bersih}`;
}

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
  opsi?: { dariInput?: boolean; bukanDariInput?: boolean },
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
  const salahDariInput =
    opsi?.bukanDariInput === true
      ? wajib.filter((nama) => terdefinisi.has(nama) && dariInput.has(nama))
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
    salahDariInput.length === 0 &&
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
  if (salahDariInput.length > 0) {
    pesan.push(
      `tulis langsung nilai variabel ini di kode, jangan dari input(): ${salahDariInput.join(", ")}`,
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

// ============================================================================
// Ketentuan jumlah perintah/variabel yang berlaku untuk KEDUA jenis latihan.
//
// Sebelumnya hanya dipakai "karya bebas". Sekarang tugas praktik bertarget
// output juga perlu memastikan siswa benar-benar memakai variabel dan
// memanggil input()/print() sesuai ketentuan soal.
//
// Sengaja TIDAK memeriksa variabel yang tidak terpakai secara bawaan, supaya
// latihan lama (jenis "output") tidak berubah penilaiannya hanya karena
// variabel bantu yang tidak dicetak.
// ============================================================================
export function cekKetentuanKode(
  analisis: AnalisisBebas | null | undefined,
  keluaran: string,
  aturan: AturanBebas,
  opsi?: { wajibSemuaDipakai?: boolean },
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
  const maksInput = aturan.maks_input ?? 0;

  if (analisis.jumlah_variabel < minVariabel) {
    gagal.push(`buat minimal ${minVariabel} variabel`);
  }
  if ((analisis.jumlah_input ?? 0) < minInput) {
    gagal.push(`pakai minimal ${minInput} perintah input()`);
  }
  if (maksInput > 0 && (analisis.jumlah_input ?? 0) > maksInput) {
    gagal.push(`pakai maksimal ${maksInput} perintah input()`);
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
  if (opsi?.wajibSemuaDipakai && analisis.variabel_tak_dipakai.length > 0) {
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

export function cekKaryaBebas(
  analisis: AnalisisBebas | null | undefined,
  keluaran: string,
  aturan: AturanBebas,
): { benar: boolean; petunjuk: string | null } {
  // Karya bebas tetap menuntut semua variabel ditampilkan (perilaku lama).
  return cekKetentuanKode(analisis, keluaran, aturan, {
    wajibSemuaDipakai: true,
  });
}

// ============================================================================
// Penilaian parsial soal ulangan jenis "kode".
//
// Skor dihitung dari ketentuan yang terpenuhi, bukan benar/salah total:
//   1. output utama (input wajib + keluaran_diharapkan)
//   2. output uji (input berbeda, kalau dikonfigurasi)
//   3. variabel wajib (dibuat, dari input(), ditampilkan)
//   4. jumlah input()/print() sesuai ketentuan
//
// Bobot bawaan 50/20/20/10. Ketentuan yang tidak dikonfigurasi tidak ikut
// dihitung, sehingga bobotnya otomatis dinormalisasi ke `poin` soal.
// ============================================================================
export type RincianNilaiKode = {
  output_utama: boolean;
  output_uji: boolean | null;
  variabel: boolean;
  jumlah: boolean;
};

export type HasilNilaiKode = {
  nilai: number;
  rincian: RincianNilaiKode;
  bobotDipakai: BobotNilaiKode;
  /** Ketentuan yang terpenuhi, untuk ditampilkan ke guru/siswa. */
  terpenuhi: string[];
  /** Ketentuan yang belum terpenuhi. */
  belum: string[];
};

const BOBOT_BAWAAN: Required<BobotNilaiKode> = {
  output: 50,
  output_uji: 20,
  variabel: 20,
  jumlah: 10,
};

export function hitungNilaiKodeUjian(args: {
  keluaran: string;
  keluaranDiharapkan: string;
  keluaranUji: string | null;
  keluaranUjiDiharapkan: string | null;
  masukanDipakai: string[] | null | undefined;
  masukan: string[];
  analisis: AnalisisBebas | null | undefined;
  aturan: AturanBebas;
  poin: number;
}): HasilNilaiKode {
  const { aturan } = args;
  const bobot = {
    output: aturan.bobot?.output ?? BOBOT_BAWAAN.output,
    output_uji: aturan.bobot?.output_uji ?? BOBOT_BAWAAN.output_uji,
    variabel: aturan.bobot?.variabel ?? BOBOT_BAWAAN.variabel,
    jumlah: aturan.bobot?.jumlah ?? BOBOT_BAWAAN.jumlah,
  };

  const inputCocok = inputSesuaiWajib(
    args.masukanDipakai,
    args.masukan ?? [],
  );
  const outputUtama =
    inputCocok &&
    keluaranCocok(args.keluaran, args.keluaranDiharapkan ?? "");

  const adaUji = Boolean(
    args.keluaranUjiDiharapkan &&
      args.keluaranUjiDiharapkan.trim().length > 0,
  );
  const outputUji = adaUji
    ? args.keluaranUji !== null &&
      keluaranCocok(args.keluaranUji, args.keluaranUjiDiharapkan ?? "")
    : null;

  const wajib = aturan.variabel_wajib ?? [];
  const tetap = Object.keys(aturan.variabel_tetap ?? {});
  const wajibDariInput = wajib.filter((nama) => !tetap.includes(nama));
  const adaVariabel = wajib.length > 0;
  const cekSemua = cekVariabelWajib(args.analisis, wajib, { dariInput: false });
  const cekInput = wajibDariInput.length > 0
    ? cekVariabelWajib(args.analisis, wajibDariInput, {
        dariInput: aturan.dari_input !== false,
      })
    : { benar: true, petunjuk: null };
  const cekTetap = tetap.length > 0
    ? cekVariabelWajib(args.analisis, tetap, { bukanDariInput: true })
    : { benar: true, petunjuk: null };
  const variabel = adaVariabel
    ? cekSemua.benar && cekInput.benar && cekTetap.benar
    : false;

  const minInput = aturan.min_input ?? 0;
  const maksInput = aturan.maks_input ?? 0;
  const minPrint = aturan.min_print ?? 0;
  const adaJumlah = minInput > 0 || minPrint > 0 || maksInput > 0;
  const jumlah = adaJumlah
    ? Boolean(args.analisis?.ok) &&
      (args.analisis?.jumlah_input ?? 0) >= minInput &&
      (maksInput === 0 || (args.analisis?.jumlah_input ?? 0) <= maksInput) &&
      (args.analisis?.jumlah_print ?? 0) >= minPrint
    : false;

  // Ketentuan yang benar-benar dinilai + bobotnya.
  const aktif: { kunci: keyof BobotNilaiKode; benar: boolean; bobot: number }[] =
    [];
  aktif.push({ kunci: "output", benar: outputUtama, bobot: bobot.output });
  if (adaUji) {
    aktif.push({
      kunci: "output_uji",
      benar: outputUji === true,
      bobot: bobot.output_uji,
    });
  }
  if (adaVariabel) {
    aktif.push({ kunci: "variabel", benar: variabel, bobot: bobot.variabel });
  }
  if (adaJumlah) {
    aktif.push({ kunci: "jumlah", benar: jumlah, bobot: bobot.jumlah });
  }

  const totalBobot = aktif.reduce((akum, item) => akum + item.bobot, 0);
  const dapatBobot = aktif
    .filter((item) => item.benar)
    .reduce((akum, item) => akum + item.bobot, 0);

  const poin = Math.max(0, Math.floor(args.poin || 0));
  const nilai =
    totalBobot > 0
      ? Math.min(poin, Math.round((poin * dapatBobot) / totalBobot))
      : outputUtama
        ? poin
        : 0;

  const label: Record<string, string> = {
    output: "Output utama sesuai",
    output_uji: "Output uji (input berbeda) sesuai",
    variabel: "Variabel wajib dipakai dengan benar",
    jumlah: "Jumlah input()/print() memenuhi ketentuan",
  };
  const terpenuhi = aktif
    .filter((item) => item.benar)
    .map((item) => label[item.kunci]);
  const belum = aktif
    .filter((item) => !item.benar)
    .map((item) => label[item.kunci]);

  return {
    nilai,
    rincian: {
      output_utama: outputUtama,
      output_uji: outputUji,
      variabel,
      jumlah,
    },
    bobotDipakai: {
      output: bobot.output,
      output_uji: adaUji ? bobot.output_uji : undefined,
      variabel: adaVariabel ? bobot.variabel : undefined,
      jumlah: adaJumlah ? bobot.jumlah : undefined,
    },
    terpenuhi,
    belum,
  };
}
