// ============================================================================
// Perhitungan progres Lab Coding untuk satu siswa.
// Dipakai bersama oleh dashboard siswa dan halaman daftar modul lab,
// supaya angkanya selalu sama di kedua tempat.
// ============================================================================

export type LessonProgres = {
  id: string;
  judul: string;
  urutan: number;
  total: number;
  selesai: number;
  // 0–100, dibulatkan. 0 kalau modul belum punya tantangan.
  persen: number;
};

export type HasilProgresLab = {
  // Hanya modul yang relevan untuk kelas siswa, urut sesuai `urutan`.
  modul: LessonProgres[];
  totalTantangan: number;
  totalSelesai: number;
  persen: number;
};

type LessonMasukan = {
  id: string;
  judul: string;
  urutan: number;
  coding_lesson_classes?: { kelas_id: string }[];
};

type LatihanMasukan = { id: string; lesson_id: string };

// Sebuah modul relevan kalau target kelasnya kosong (artinya "semua kelas")
// atau memuat kelas siswa. Sama dengan aturan di halaman lab.
export function hitungProgresLab(
  lessons: LessonMasukan[],
  latihan: LatihanMasukan[],
  selesaiIds: Set<string>,
  kelasIdSiswa: string | null,
): HasilProgresLab {
  const relevan = lessons.filter((lesson) => {
    const daftarKelasId =
      lesson.coding_lesson_classes?.map((hub) => hub.kelas_id) ?? [];
    if (daftarKelasId.length === 0) return true;
    return kelasIdSiswa !== null && daftarKelasId.includes(kelasIdSiswa);
  });

  const modul: LessonProgres[] = relevan
    .map((lesson) => {
      const latihanLesson = latihan.filter((l) => l.lesson_id === lesson.id);
      const total = latihanLesson.length;
      const selesai = latihanLesson.filter((l) => selesaiIds.has(l.id)).length;
      return {
        id: lesson.id,
        judul: lesson.judul,
        urutan: lesson.urutan,
        total,
        selesai,
        persen: total > 0 ? Math.round((selesai / total) * 100) : 0,
      };
    })
    .sort((a, b) => a.urutan - b.urutan);

  const totalTantangan = modul.reduce((jumlah, item) => jumlah + item.total, 0);
  const totalSelesai = modul.reduce((jumlah, item) => jumlah + item.selesai, 0);

  return {
    modul,
    totalTantangan,
    totalSelesai,
    persen:
      totalTantangan > 0
        ? Math.round((totalSelesai / totalTantangan) * 100)
        : 0,
  };
}
