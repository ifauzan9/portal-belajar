// ============================================================================
// Lab Coding — Web Worker (module worker) untuk menjalankan Pyodide.
//
// Pyodide 314 tidak mendukung classic worker, jadi worker ini bertipe
// "module". Pyodide dimuat dari /pyodide/ (self-host); kalau tidak ada,
// fallback ke CDN jsDelivr.
//
// Pesan masuk : { id, kode, stdin?, stdinUji?, analisis? }
//   - stdin     : daftar baris input untuk run utama (feed ke input())
//   - stdinUji  : daftar baris input untuk run uji (input berbeda)
// Pesan keluar: { id, status: "loading" }           → sedang menyiapkan Python
//               { id, status: "running" }            → sedang menjalankan kode
//               { id, status: "result", stdout, stderr, error,
//                 stdinDipakai, stdoutUji, stderrUji, errorUji, analisis }
//   - stdinDipakai : baris input yang benar-benar dikonsumsi input() pada run
//                    utama. Dipakai untuk memastikan siswa tidak mengubah
//                    input wajib, dan untuk menampilkan input yang dipakai.
// ============================================================================

const VERSI = "314.0.7";
const LOKAL = "/pyodide/";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${VERSI}/full/`;

let janjiPyodide = null;
let pyodide = null;

// Coba muat dari folder lokal (public/pyodide/) lebih dulu, lalu CDN.
// Folder lokal hanya dipakai kalau benar-benar lengkap: sebagian salinan
// hanya berisi pyodide.mjs/.wasm tanpa isi python_stdlib.zip, sehingga
// Python gagal start ("No module named 'encodings'"). Kalau tidak lengkap,
// CDN langsung dipakai supaya lab tetap bisa dijalankan.
async function muatPyodide() {
  const kandidat = [];
  if (await lokalLengkap()) kandidat.push({ indexURL: LOKAL, modul: `${LOKAL}pyodide.mjs` });
  kandidat.push({ indexURL: CDN, modul: `${CDN}pyodide.mjs` });

  let galatTerakhir = null;
  for (const pilihan of kandidat) {
    try {
      const modul = await import(/* webpackIgnore: true */ pilihan.modul);
      const hasil = await modul.loadPyodide({ indexURL: pilihan.indexURL });
      // Uji cepat: stdlib harus benar-benar bisa diimpor.
      await hasil.runPythonAsync("import encodings");
      return hasil;
    } catch (galat) {
      galatTerakhir = galat;
    }
  }

  throw galatTerakhir ?? new Error("Pyodide tidak dapat dimuat.");
}

// Cek keberadaan python_stdlib.zip lokal (berkas wajib untuk start Python).
// Diberi batas waktu supaya permintaan yang menggantung tidak menahan lab.
let lengkap = null;
async function lokalLengkap() {
  if (lengkap !== null) return lengkap;
  const batal = new AbortController();
  const timer = setTimeout(() => batal.abort(), 3000);
  try {
    const jawab = await fetch(`${LOKAL}python_stdlib.zip`, {
      method: "HEAD",
      cache: "no-store",
      signal: batal.signal,
    });
    // Beberapa server menjawab 204 untuk berkas yang belum ada.
    lengkap = jawab.ok && jawab.status === 200;
  } catch {
    lengkap = false;
  } finally {
    clearTimeout(timer);
  }
  return lengkap;
}

// Program analisis statis (AST) untuk tantangan "karya bebas".
// Membaca global __src__, mengembalikan JSON berisi hitungan variabel/print.
const ANALYZER = `
import ast, json

def __analisis_lab__(src):
    hasil = {
        "ok": False,
        "error": None,
        "jumlah_variabel": 0,
        "variabel_teks": 0,
        "variabel_angka": 0,
        "jumlah_print": 0,
        "jumlah_input": 0,
        "jumlah_loop": 0,
        "input_berprompt": 0,
        "variabel_didefinisikan": [],
        "variabel_input": [],
        "variabel_tak_dipakai": [],
        "variabel_ditimpa": [],
        "input_pertanyaan": [],
    }
    try:
        tree = ast.parse(src)
    except SyntaxError:
        hasil["error"] = "syntax"
        return json.dumps(hasil)

    assigned = {}
    used = {}
    dari_input_set = set()
    ditimpa = set()
    pertanyaan = []
    jumlah_print = 0
    jumlah_input = 0
    jumlah_loop = 0
    input_berprompt = 0

    # Catat nomor baris input() per variabel dan print() per variabel, agar
    # bisa dicek aliran data: input() → variabel → print() sesudahnya.
    baris_input_var = {}
    baris_print_var = {}

    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.While)):
            jumlah_loop += 1

        if isinstance(node, ast.Assign):
            nilai = node.value
            jenis = None

            if isinstance(nilai, ast.Constant):
                if isinstance(nilai.value, str):
                    jenis = "teks"
                elif isinstance(nilai.value, bool):
                    jenis = None
                elif isinstance(nilai.value, (int, float)):
                    jenis = "angka"

            # Dianggap berasal dari input() kalau ekspresinya memakai input()
            # di mana pun (mis. input(), input().strip(), str(input())).
            pakai_input = any(
                isinstance(sub, ast.Call)
                and isinstance(sub.func, ast.Name)
                and sub.func.id == "input"
                for sub in ast.walk(nilai)
            )

            for target in node.targets:
                if isinstance(target, ast.Name):
                    nama = target.id
                    # Kalau variabel ini pernah diisi input() lalu ditimpa
                    # dengan nilai tetap, aliran input() → variabel → print()
                    # sudah rusak (mis. nama = input(); nama = "Randi").
                    if nama in dari_input_set and not pakai_input:
                        ditimpa.add(nama)
                    assigned[nama] = jenis
                    if pakai_input:
                        dari_input_set.add(nama)
                        ditimpa.discard(nama)
                        baris_input_var[nama] = node.lineno

        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "print"
        ):
            jumlah_print += 1
            for arg in node.args:
                for sub in ast.walk(arg):
                    if isinstance(sub, ast.Name) and isinstance(sub.ctx, ast.Load):
                        used[sub.id] = min(used.get(sub.id, node.lineno), node.lineno)
                        # Simpan baris print() PERTAMA untuk variabel ini, agar
                        # print() sebelum input() tidak tertutupi print() lain.
                        sebelumnya = baris_print_var.get(sub.id)
                        if sebelumnya is None or node.lineno < sebelumnya:
                            baris_print_var[sub.id] = node.lineno

        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "input"
        ):
            jumlah_input += 1
            teks = ""
            if node.args:
                pertama = node.args[0]
                if isinstance(pertama, ast.Constant) and isinstance(pertama.value, str):
                    teks = pertama.value
            if node.args or node.keywords:
                input_berprompt += 1
            pertanyaan.append(teks)

    hasil["jumlah_variabel"] = len(assigned)
    hasil["variabel_teks"] = sum(1 for v in assigned.values() if v == "teks")
    hasil["variabel_angka"] = sum(1 for v in assigned.values() if v == "angka")
    hasil["jumlah_print"] = jumlah_print
    hasil["jumlah_input"] = jumlah_input
    hasil["jumlah_loop"] = jumlah_loop
    hasil["input_berprompt"] = input_berprompt
    hasil["variabel_didefinisikan"] = sorted(assigned.keys())
    hasil["variabel_input"] = sorted(dari_input_set)
    hasil["variabel_tak_dipakai"] = [n for n in assigned if n not in used]
    hasil["variabel_ditimpa"] = sorted(ditimpa)
    hasil["input_pertanyaan"] = pertanyaan
    # Variabel yang print()-nya berada SEBELUM input()-nya.
    hasil["variabel_print_sebelum_input"] = sorted(
        n for n in dari_input_set
        if n in baris_print_var
        and n in baris_input_var
        and baris_print_var[n] < baris_input_var[n]
    )
    hasil["ok"] = True
    return json.dumps(hasil)

__analisis_lab__(__src__)
`;

// Jalankan kode satu kali di namespace bersih, dengan input() diisi dari
// daftar baris. Baris habis → stdin mengembalikan null → Pyodide menganggap
// EOF (input() berikutnya melempar EOFError, jadi siswa tahu inputnya kurang).
// Mengembalikan juga `dipakai`: baris yang benar-benar diminta input().
// Kalau `pemakaian` (array) diberikan, hasilnya dicatat ke situ SEBELUM
// namespace dihancurkan, karena objek hasil bisa jadi proxy yang mati.
async function jalankanSekali(kode, daftarBaris, pemakaian, daftarPromptKirim) {
  let stdout = "";
  let stderr = "";

  pyodide.setStdout({ batched: (teks) => (stdout += `${teks}\n`) });
  pyodide.setStderr({ batched: (teks) => (stderr += `${teks}\n`) });

  const antrean = Array.isArray(daftarBaris)
    ? daftarBaris.map((baris) => String(baris))
    : [];
  // Salinan biasa: `pemakaian` (kalau ada) diisi di akhir proses, di luar
  // proxy Pyodide, supaya strukturnya tetap bisa diserialisasi ke UI.
  const dipakai = [];
  // Prompt yang sudah muncul di stdin (mis. saat Pyodide menggemakan baris
  // input). Dipakai untuk memotongnya dari stdout.
  const promptAktif = [];

  try {
    // Teks di dalam input("...") adalah pertanyaan untuk modal, bukan bagian
    // output program. Pyodide menulis prompt ke stdout sebelum membaca baris,
    // jadi prompt itu dibuang lagi dari stdout di bawah.
    pyodide.setStdin({
      stdin: (pertanyaan) => {
        // Pyodide memberi argumen berupa teks prompt (kalau ada).
        if (typeof pertanyaan === "string" && pertanyaan.length > 0) {
          promptAktif.push(pertanyaan);
        }
        // null (bukan "") menandakan EOF. Kalau mengembalikan "", Pyodide
        // menganggapnya satu baris kosong dan input() tidak pernah berhenti.
        if (antrean.length === 0) return null;
        const baris = antrean.shift();
        dipakai.push(baris);
        return baris;
      },
      isatty: false,
      autoEOF: true,
    });
  } catch {
    // abaikan kalau API tidak tersedia
  }

  let namespaceRun = null;
  let error = null;
  try {
    // Setiap percobaan harus dijalankan di namespace BERSIH.
    // Kalau memakai pyodide.globals yang persisten, variabel dari run
    // sebelumnya (mis. `angkas = 2`) masih terbaca di run berikutnya,
    // padahal kode barunya tidak lagi mendefinisikannya.
    namespaceRun = pyodide.globals.get("dict")();
    await pyodide.runPythonAsync(kode, { globals: namespaceRun });
  } catch (galat) {
    error = galat && galat.message ? galat.message : String(galat);
  } finally {
    if (namespaceRun && typeof namespaceRun.destroy === "function") {
      namespaceRun.destroy();
    }
  }

  // Pastikan array benar-benar plain JS (bukan proxy) sebelum dikirim.
  const hasilDipakai = dipakai.map((baris) => String(baris));
  if (Array.isArray(pemakaian)) {
    pemakaian.length = 0;
    for (const baris of hasilDipakai) pemakaian.push(baris);
  }

  // Jaring pengaman: prompt yang dikenal (dari argumen stdin atau dari teks
  // input("...") di kode) dipotong dari stdout, beserta spasi setelahnya.
  const semuaPrompt = [
    ...promptAktif,
    ...(Array.isArray(daftarPromptKirim) ? daftarPromptKirim : []),
  ];
  const stdoutBersih = potongPrompt(stdout, semuaPrompt);

  return { stdout: stdoutBersih, stderr, error, dipakai: hasilDipakai };
}

// Buang teks prompt input("...") dari stdout. Pyodide menulis prompt ke
// stdout sebelum membaca baris, sehingga hasilnya bisa "Nama: Randi". Prompt
// hanya dibuang kalau muncul sebagai awalan sebuah baris, supaya isi print()
// siswa tidak ikut terpotong.
function potongPrompt(teks, daftarPrompt) {
  if (!Array.isArray(daftarPrompt) || daftarPrompt.length === 0) return teks;
  const daftar = daftarPrompt
    .filter((p) => typeof p === "string" && p.length > 0)
    // Prompt terpanjang lebih dulu supaya "Nama: " tidak memotong "Nama: X".
    .sort((a, b) => b.length - a.length);
  if (daftar.length === 0) return teks;

  const baris = teks.split("\n");
  for (let i = 0; i < baris.length; i += 1) {
    let isi = baris[i];
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const prompt of daftar) {
        if (!isi.startsWith(prompt)) continue;
        // Hanya potong kalau setelah prompt masih ada isi. Kalau prompt
        // mengisi satu baris penuh, itu kemungkinan baris yang memang
        // di-print() oleh siswa (mis. label target), jadi biarkan.
        const sisa = isi.slice(prompt.length);
        if (sisa.trim() === "") continue;
        isi = sisa;
        // Python menulis prompt lalu menunggu; spasi pemisah ikut tercetak.
        while (isi.startsWith(" ")) isi = isi.slice(1);
        berubah = true;
      }
    }
    baris[i] = isi;
  }
  return baris.join("\n");
}

self.onmessage = async (event) => {
  const data = event.data;
  if (!data || typeof data.kode !== "string") return;

  const id = data.id;

  if (!pyodide) {
    self.postMessage({ id, status: "loading" });
    try {
      if (!janjiPyodide) janjiPyodide = muatPyodide();
      pyodide = await janjiPyodide;
    } catch (galat) {
      janjiPyodide = null;
      self.postMessage({
        id,
        status: "result",
        stdout: "",
        stderr: "",
        error: `Gagal menyiapkan Python: ${
          galat && galat.message ? galat.message : String(galat)
        }`,
        analisis: null,
      });
      return;
    }
  }

  self.postMessage({ id, status: "running" });

  // Analisis dulu (murah, tanpa menjalankan kode siswa) supaya teks
  // input("...") sudah diketahui saat run utama. Prompt itu tidak boleh
  // menjadi bagian output.
  let analisis = null;
  let promptKode = [];
  if (data.analisis) {
    try {
      pyodide.globals.set("__src__", data.kode);
      const jsonHasil = await pyodide.runPythonAsync(ANALYZER);
      analisis = JSON.parse(jsonHasil);
      promptKode = Array.isArray(analisis.input_pertanyaan)
        ? analisis.input_pertanyaan
        : [];
    } catch {
      analisis = {
        ok: false,
        error: "analysis_failed",
        jumlah_variabel: 0,
        variabel_teks: 0,
        variabel_angka: 0,
        jumlah_print: 0,
        jumlah_input: 0,
        jumlah_loop: 0,
        input_berprompt: 0,
        variabel_didefinisikan: [],
        variabel_input: [],
        variabel_tak_dipakai: [],
      };
    }
  }

  // Teks prompt dari kode siswa + dari UI (kalau ada).
  const daftarPrompt = [
    ...promptKode,
    ...(Array.isArray(data.prompt) ? data.prompt : []),
  ];

  // Catat pemakaian input di variabel luar (plain JS) supaya tetap utuh
  // walaupun Pyodide membungkus array Python sebagai proxy.
  const pemakaian = [];
  const utama = await jalankanSekali(data.kode, data.stdin, pemakaian, daftarPrompt);

  if (utama.error) {
    self.postMessage({
      id,
      status: "result",
      stdout: utama.stdout,
      stderr: utama.stderr,
      error: utama.error,
      stdinDipakai: pemakaian.slice(),
      stdoutUji: null,
      stderrUji: null,
      errorUji: null,
      analisis: null,
    });
    return;
  }

  // Run uji dengan input berbeda: membuktikan output benar-benar berasal dari
  // input(), bukan dari jawaban yang ditulis langsung di kode.
  let uji = null;
  if (Array.isArray(data.stdinUji) && data.stdinUji.length > 0) {
    uji = await jalankanSekali(data.kode, data.stdinUji, null, daftarPrompt);
  }

  self.postMessage({
    id,
    status: "result",
    stdout: utama.stdout,
    stderr: utama.stderr,
    error: null,
    stdinDipakai: pemakaian.slice(),
    stdoutUji: uji ? uji.stdout : null,
    stderrUji: uji ? uji.stderr : null,
    errorUji: uji ? uji.error : null,
    analisis,
  });
};
