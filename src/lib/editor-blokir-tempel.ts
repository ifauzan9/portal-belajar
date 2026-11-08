import {
  EditorState,
  type Extension,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// Blokir paste dan drop dari luar editor Python.
// - Copy/cut lalu paste kembali di editor yang sama tetap boleh.
// - Paste dari luar (AI, browser, aplikasi lain) ditolak.
// - Drop dari luar ditolak, drag di dalam editor (`move.drop`) dibiarkan.
// - Tanpa pesan/notifikasi.

function normalisasiTeks(teks: string): string {
  return teks.replace(/\r\n/g, "\n");
}

// Samakan dengan isi clipboard yang dibuat CodeMirror saat copy/cut.
// Jika tidak ada seleksi, CodeMirror menyalin baris tempat kursor berada.
function ambilTeksInternal(view: EditorView): string {
  const { ranges } = view.state.selection;
  const potongan = ranges
    .filter((range) => !range.empty)
    .map((range) => view.state.sliceDoc(range.from, range.to));

  if (potongan.length > 0) {
    return potongan.join(view.state.lineBreak);
  }

  const nomorBaris = new Set<number>();
  const baris: string[] = [];

  for (const range of ranges) {
    const line = view.state.doc.lineAt(range.from);
    if (nomorBaris.has(line.number)) continue;
    nomorBaris.add(line.number);
    baris.push(line.text);
  }

  return baris.join(view.state.lineBreak);
}

export function buatEkstensiBlokirTempel(): Extension {
  // Buffer per instance editor. Copy/cut dari editor lain tidak bisa
  // dipakai untuk paste di sini.
  let teksInternal = "";

  return [
    EditorView.domEventHandlers({
      // Rekam teks yang disalin/dipotong. Jangan hentikan handler bawaan
      // CodeMirror agar clipboard tetap terisi.
      copy: (_event, view) => {
        teksInternal = normalisasiTeks(ambilTeksInternal(view));
      },
      cut: (_event, view) => {
        teksInternal = normalisasiTeks(ambilTeksInternal(view));
      },

      // Izinkan paste jika teksnya berasal dari copy/cut editor ini atau
      // sudah ada di dokumen saat ini (tidak menambah konten baru).
      paste: (event, view) => {
        const teks = normalisasiTeks(
          event.clipboardData?.getData("text/plain") ?? "",
        );

        if (
          teks.length > 0 &&
          (teks === teksInternal ||
            normalisasiTeks(view.state.doc.toString()).includes(teks))
        ) {
          return false;
        }

        return true;
      },
    }),

    // Cadangan: tolak drop dari luar. Filter `input.paste` sengaja tidak
    // dipakai karena akan ikut memblokir paste internal yang sudah diizinkan.
    // `move.drop` (drag di dalam editor) dibiarkan.
    EditorState.transactionFilter.of((tr) =>
      tr.isUserEvent("input.drop") ? [] : tr,
    ),
  ];
}