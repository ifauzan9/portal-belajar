// ============================================================================
// Lab Coding — Web Worker (module worker) untuk menjalankan Pyodide.
//
// Pyodide 314 tidak mendukung classic worker, jadi worker ini bertipe
// "module". Pyodide dimuat dari /pyodide/ (self-host); kalau tidak ada,
// fallback ke CDN jsDelivr.
//
// Pesan masuk : { id, kode, analisis? }
// Pesan keluar: { id, status: "loading" }           → sedang menyiapkan Python
//               { id, status: "running" }            → sedang menjalankan kode
//               { id, status: "result", stdout, stderr, error, analisis }
// ============================================================================

const VERSI = "314.0.7";
const LOKAL = "/pyodide/";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${VERSI}/full/`;

let janjiPyodide = null;
let pyodide = null;

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
        "variabel_didefinisikan": [],
        "variabel_tak_dipakai": [],
    }
    try:
        tree = ast.parse(src)
    except SyntaxError:
        hasil["error"] = "syntax"
        return json.dumps(hasil)

    assigned = {}
    used = set()
    jumlah_print = 0

    for node in ast.walk(tree):
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
            for target in node.targets:
                if isinstance(target, ast.Name):
                    assigned[target.id] = jenis
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "print"
        ):
            jumlah_print += 1
            for arg in node.args:
                for sub in ast.walk(arg):
                    if isinstance(sub, ast.Name) and isinstance(sub.ctx, ast.Load):
                        used.add(sub.id)

    hasil["jumlah_variabel"] = len(assigned)
    hasil["variabel_teks"] = sum(1 for v in assigned.values() if v == "teks")
    hasil["variabel_angka"] = sum(1 for v in assigned.values() if v == "angka")
    hasil["jumlah_print"] = jumlah_print
    hasil["variabel_didefinisikan"] = sorted(assigned.keys())
    hasil["variabel_tak_dipakai"] = [n for n in assigned if n not in used]
    hasil["ok"] = True
    return json.dumps(hasil)

__analisis_lab__(__src__)
`;

async function muatPyodide() {
  const kandidat = [
    { indexURL: LOKAL, modul: `${LOKAL}pyodide.mjs` },
    { indexURL: CDN, modul: `${CDN}pyodide.mjs` },
  ];

  let galatTerakhir = null;
  for (const pilihan of kandidat) {
    try {
      const modul = await import(/* webpackIgnore: true */ pilihan.modul);
      const instance = await modul.loadPyodide({ indexURL: pilihan.indexURL });
      // Tidak mendukung input() interaktif — kembalikan string kosong.
      try {
        instance.setStdin({ stdin: () => "" });
      } catch {
        // abaikan kalau API tidak tersedia
      }
      return instance;
    } catch (galat) {
      galatTerakhir = galat;
    }
  }

  throw galatTerakhir ?? new Error("Pyodide tidak dapat dimuat.");
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

  let stdout = "";
  let stderr = "";

  pyodide.setStdout({ batched: (teks) => (stdout += `${teks}\n`) });
  pyodide.setStderr({ batched: (teks) => (stderr += `${teks}\n`) });

  self.postMessage({ id, status: "running" });

  // Setiap percobaan harus dijalankan di namespace BERSIH.
  // Kalau memakai pyodide.globals yang persisten, variabel dari run
  // sebelumnya (mis. `angkas = 2`) masih terbaca di run berikutnya,
  // padahal kode barunya tidak lagi mendefinisikannya.
  let namespaceRun = null;
  try {
    namespaceRun = pyodide.globals.get("dict")();
    await pyodide.runPythonAsync(data.kode, { globals: namespaceRun });
  } catch (galat) {
    self.postMessage({
      id,
      status: "result",
      stdout,
      stderr,
      error: galat && galat.message ? galat.message : String(galat),
      analisis: null,
    });
    return;
  } finally {
    if (namespaceRun && typeof namespaceRun.destroy === "function") {
      namespaceRun.destroy();
    }
  }

  // Analisis kode (opsional) untuk tantangan "karya bebas".
  let analisis = null;
  if (data.analisis) {
    try {
      pyodide.globals.set("__src__", data.kode);
      const jsonHasil = await pyodide.runPythonAsync(ANALYZER);
      analisis = JSON.parse(jsonHasil);
    } catch {
      analisis = {
        ok: false,
        error: "analysis_failed",
        jumlah_variabel: 0,
        variabel_teks: 0,
        variabel_angka: 0,
        jumlah_print: 0,
        variabel_didefinisikan: [],
        variabel_tak_dipakai: [],
      };
    }
  }

  self.postMessage({ id, status: "result", stdout, stderr, error: null, analisis });
};
