-- ============================================================
-- RESET DATA OPERASIONAL (SATU KALI PAKAI)
-- ============================================================
-- Menghapus SEMUA data kecuali materi Lab Coding dan Lab Komputer.
--
-- DIPERTAHANKAN (materi):
--   - coding_lessons, coding_exercises
--   - komputer_lessons, komputer_challenges
--
-- DIPERTAHANKAN (konfigurasi):
--   - pengaturan_guru (saklar "tutup akses soal", Tahap 41)
--     Sengaja TIDAK dihapus: ini pengaturan, bukan data operasional.
--     Baris 1 direset ke default (akses soal terbuka) supaya siswa tidak
--     terjebak "ditutup guru" setelah reset.
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

-- Pengaturan portal: bukan data operasional, jadi barisnya dipertahankan.
-- Cukup kembalikan saklar ke default "terbuka".
do $$
begin
  if to_regclass('public.pengaturan_guru') is not null then
    update public.pengaturan_guru
       set tutup_soal_ulangan = false,
           tutup_soal_lab = false,
           pesan_tutup = null,
           diperbarui_at = now()
     where id = 1;
  end if;

  -- Modul lab: pastikan semua terbuka lagi setelah reset (Tahap 42).
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'coding_lessons'
       and column_name = 'dibuka'
  ) then
    update public.coding_lessons set dibuka = true;
  end if;
end $$;

commit;

-- Verifikasi: semua harus 0, kecuali materi lab.
-- select
--   (select count(*) from public.students) as siswa,
--   (select count(*) from public.classes) as kelas,
--   (select count(*) from public.coding_lessons) as modul_lab_coding,
--   (select count(*) from public.coding_exercises) as latihan_lab_coding,
--   (select count(*) from public.komputer_lessons) as modul_lab_komputer,
--   (select count(*) from public.komputer_challenges) as tantangan_lab_komputer;
