-- ============================================================
-- RESET DATA OPERASIONAL (SATU KALI PAKAI)
-- ============================================================
-- Menghapus SEMUA data kecuali materi Lab Coding dan Lab Komputer.
--
-- DIPERTAHANKAN (materi):
--   - coding_lessons, coding_exercises
--   - komputer_lessons, komputer_challenges
--
-- DIHAPUS:
--   - siswa & akun siswa, kelas
--   - ulangan + soal + jawaban + nilai + probe
--   - tugas + pengumpulan + berkas + target kelas
--   - absensi, pengumuman
--   - log login
--   - progres/hasil lab (coding_submissions, komputer_hasil)
--   - target kelas modul lab (coding_lesson_classes, komputer_lesson_classes)
--
-- PERINGATAN: tidak bisa dibatalkan. Jalankan di Supabase -> SQL Editor.
-- Akun guru (Supabase Auth) TIDAK dihapus.
--
-- Catatan: berkas di Supabase Storage (bucket "tugas") tidak terhapus oleh
-- SQL ini karena bukan baris tabel. Hapus manual lewat Storage bila perlu.

begin;

-- Progres & hasil lab (materi tetap ada)
delete from public.coding_submissions;
delete from public.coding_lesson_classes;
delete from public.komputer_hasil;
delete from public.komputer_lesson_classes;

-- Ulangan
delete from public.exam_answers;
delete from public.exam_essay_scores;
delete from public.exam_probes;
delete from public.exam_submissions;
delete from public.exam_questions;
delete from public.exam_scores;
delete from public.exam_classes;
delete from public.exams;

-- Tugas
delete from public.assignment_files;
delete from public.assignment_submissions;
delete from public.assignment_classes;
delete from public.assignments;

-- Absensi & pengumuman
delete from public.attendance;
delete from public.announcement_classes;
delete from public.announcements;

-- Log login
delete from public.login_logs;

-- Akun siswa & siswa
delete from public.student_accounts;
delete from public.students;

-- Kelas (terakhir; target kelas modul lab ikut terhapus)
delete from public.classes;

commit;

-- Verifikasi: semua harus 0, kecuali materi lab.
-- select
--   (select count(*) from public.students) as siswa,
--   (select count(*) from public.classes) as kelas,
--   (select count(*) from public.coding_lessons) as modul_lab_coding,
--   (select count(*) from public.coding_exercises) as latihan_lab_coding,
--   (select count(*) from public.komputer_lessons) as modul_lab_komputer,
--   (select count(*) from public.komputer_challenges) as tantangan_lab_komputer;
