// ============================================================================
// Lab Coding — Web Worker (module worker) untuk menjalankan Pyodide.
//
// Pyodide 314 tidak mendukung classic worker, jadi worker ini bertipe
// "module". Pyodide dimuat dari /pyodide/ (self-host); kalau tidak ada,
// fallback ke CDN jsDelivr.
//
// Pesan masuk : { id, kode }
// Pesan keluar: { id, status: "loading" }           → sedang menyiapkan Python
//               { id, status: "running" }            → sedang menjalankan kode
//               { id, status: "result", stdout, stderr, error }
// ============================================================================

const VERSI = "314.0.7";
const LOKAL = "/pyodide/";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${VERSI}/full/`;

let janjiPyodide = null;
let pyodide = null;

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
      });
      return;
    }
  }

  let stdout = "";
  let stderr = "";

  pyodide.setStdout({ batched: (teks) => (stdout += `${teks}\n`) });
  pyodide.setStderr({ batched: (teks) => (stderr += `${teks}\n`) });

  self.postMessage({ id, status: "running" });

  try {
    await pyodide.runPythonAsync(data.kode);
    self.postMessage({ id, status: "result", stdout, stderr, error: null });
  } catch (galat) {
    self.postMessage({
      id,
      status: "result",
      stdout,
      stderr,
      error: galat && galat.message ? galat.message : String(galat),
    });
  }
};
