// ============================================================================
// Draft nilai kode manual di browser (localStorage).
//
// Guru bisa mengetik nilai untuk beberapa siswa tanpa harus menyimpan satu per
// satu. Draft tetap ada saat halaman di-refresh, lalu dikirim sekaligus lewat
// tombol "Simpan Semua Nilai Kode".
//
// localStorage dipakai, bukan cookie: cookie terlalu kecil dan ikut terkirim
// ke server di setiap request. Semua fungsi aman dipanggil di server (SSR)
// karena akan mengembalikan nilai kosong bila `window` tidak tersedia.
// ============================================================================

export type DraftNilaiKode = Record<string, string>;

function kunciDraft(examId: string): string {
  return `draft:nilai-kode:${examId}`;
}

/** Baca draft satu ulangan. Nilai rusak / localStorage diblokir → {}. */
export function bacaDraftNilaiKode(examId: string): DraftNilaiKode {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(kunciDraft(examId));
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const hasil: DraftNilaiKode = {};
    for (const [siswaId, nilai] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      // Simpan sebagai string apa adanya. String kosong berarti "kembali ke
      // nilai otomatis", jadi jangan dibuang.
      if (typeof nilai === "string") hasil[siswaId] = nilai;
    }
    return hasil;
  } catch {
    return {};
  }
}

/** Tulis draft satu ulangan. Draft kosong → hapus key localStorage. */
export function tulisDraftNilaiKode(
  examId: string,
  draft: DraftNilaiKode,
): void {
  if (typeof window === "undefined") return;

  try {
    if (Object.keys(draft).length === 0) {
      window.localStorage.removeItem(kunciDraft(examId));
      return;
    }
    window.localStorage.setItem(kunciDraft(examId), JSON.stringify(draft));
  } catch {
    // localStorage bisa diblokir (mode privat / kebijakan browser).
  }
}
