// ============================================================================
// Pembacaan perintah input() untuk modal interaktif.
//
// Ini BUKAN interpretasi Python: hanya membaca urutan input() beserta teks
// pertanyaannya supaya modal bisa tampil satu per satu. Kode tetap dijalankan
// oleh Pyodide. Tidak memakai eval()/Function().
//
// Yang didukung: input(), input("Teks: "), input('Teks: ').
// Kalau ada input() yang tidak bisa dipastikan (mis. di dalam perulangan atau
// dibuat lewat ekspresi), `pasti` menjadi false dan UI memakai mode isi
// sekaligus.
// ============================================================================

export type PermintaanInput = {
  /** Teks pertanyaan dari input("..."). Kosong kalau input() tanpa teks. */
  pertanyaan: string;
  /** Nomor baris tempat input() muncul (1-based). */
  baris: number;
};

export type RencanaInput = {
  daftar: PermintaanInput[];
  /** false kalau ada input() yang tidak bisa dipetakan dengan pasti. */
  pasti: boolean;
  /** Jumlah input() yang terdeteksi. */
  jumlah: number;
  /** Alasan kalau tidak pasti (untuk catatan di modal). */
  catatan: string | null;
};

// Buang komentar dan isi string agar pencarian kata kunci tidak salah kena.
function pakaiTopeng(kode: string): { topeng: string; petaString: Map<number, string> } {
  const peta = new Map<number, string>();
  let hasil = "";
  let i = 0;
  const sumber = kode.replace(/\r\n/g, "\n");

  while (i < sumber.length) {
    const c = sumber[i];

    // Komentar sampai akhir baris.
    if (c === "#") {
      while (i < sumber.length && sumber[i] !== "\n") {
        hasil += " ";
        i += 1;
      }
      continue;
    }

    // String dengan kutip tunggal/ganda (termasuk triple quote sederhana).
    if (c === '"' || c === "'") {
      const kutip = c.repeat(3).startsWith(sumber.slice(i, i + 3)) ? c.repeat(3) : c;
      const mulai = i;
      i += kutip.length;
      const isi: string[] = [];
      while (i < sumber.length) {
        if (sumber.slice(i, i + kutip.length) === kutip) {
          i += kutip.length;
          break;
        }
        if (kutip.length === 1 && sumber[i] === "\\" && i + 1 < sumber.length) {
          isi.push(sumber[i + 1]);
          i += 2;
          continue;
        }
        isi.push(sumber[i]);
        i += 1;
      }
      peta.set(mulai, isi.join(""));
      hasil += "_".repeat(Math.max(1, i - mulai));
      continue;
    }

    hasil += c;
    i += 1;
  }

  return { topeng: hasil, petaString: peta };
}

function nomorBaris(teks: string, indeks: number): number {
  let baris = 1;
  for (let i = 0; i < indeks && i < teks.length; i += 1) {
    if (teks[i] === "\n") baris += 1;
  }
  return baris;
}

export function bacaInput(kode: string): RencanaInput {
  const { topeng, petaString } = pakaiTopeng(kode ?? "");
  const daftar: PermintaanInput[] = [];
  let pasti = true;
  let catatan: string | null = null;

  // Hitung berapa kali kode memakai perulangan/fungsi sendiri; itu tanda
  // bahwa jumlah input() saat dijalankan bisa berbeda dari yang tertulis.
  const adaLoop = /\b(for|while)\b/.test(topeng);

  const pola = /\binput\s*\(/g;
  let cocok: RegExpExecArray | null;
  while ((cocok = pola.exec(topeng)) !== null) {
    const buka = cocok.index + cocok[0].length - 1;
    let tutup = -1;
    let kedalaman = 0;
    for (let i = buka; i < topeng.length; i += 1) {
      if (topeng[i] === "(") kedalaman += 1;
      else if (topeng[i] === ")") {
        kedalaman -= 1;
        if (kedalaman === 0) {
          tutup = i;
          break;
        }
      }
    }

    const isi = tutup === -1 ? "" : topeng.slice(buka + 1, tutup).trim();
    let pertanyaan = "";

    if (isi !== "") {
      // Pertanyaan hanya bisa dibaca kalau argumennya satu string literal.
      const awalString = topeng.indexOf("_", buka + 1);
      const panjangString = isi.length;
      if (
        (isi.startsWith("_") || isi.startsWith("")) &&
        petaString.has(awalString) &&
        awalString + panjangString <= (tutup === -1 ? topeng.length : tutup)
      ) {
        pertanyaan = petaString.get(awalString) ?? "";
      } else {
        pasti = false;
        catatan =
          "Ada input() dengan pertanyaan yang tidak bisa dibaca langsung (mis. memakai variabel). Isi jawaban sesuai urutan yang diminta program.";
      }
    }

    daftar.push({ pertanyaan, baris: nomorBaris(topeng, cocok.index) });
    if (tutup === -1) {
      pasti = false;
      catatan = catatan ?? "Tanda kurung input() tidak lengkap. Periksa kembali kodenya.";
    }
  }

  if (adaLoop) {
    pasti = false;
    catatan =
      catatan ??
      "Kode memakai perulangan, jadi jumlah input() bisa berubah saat dijalankan.";
  }

  return { daftar, pasti, jumlah: daftar.length, catatan };
}
