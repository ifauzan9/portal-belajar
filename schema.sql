-- ============================================================
-- Portal Pembelajaran - Tahap 1
-- Jalankan sekali saja di: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- 1. Tabel kelas (satu-satunya tabel pada tahap ini)
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  nama_kelas text not null,
  created_at timestamptz not null default now()
);

-- 2. Aktifkan Row Level Security
--    Tanpa ini, Supabase menolak semua akses walaupun sudah login.
alter table public.classes enable row level security;

-- 3. Izinkan guru yang sudah login membaca / menambah / menghapus kelas
--    (drop policy if exists supaya script ini aman dijalankan berulang)
drop policy if exists "Guru bisa membaca kelas" on public.classes;
create policy "Guru bisa membaca kelas"
  on public.classes for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah kelas" on public.classes;
create policy "Guru bisa menambah kelas"
  on public.classes for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa menghapus kelas" on public.classes;
create policy "Guru bisa menghapus kelas"
  on public.classes for delete
  to authenticated
  using (true);

drop policy if exists "Guru bisa mengubah kelas" on public.classes;
create policy "Guru bisa mengubah kelas"
  on public.classes for update
  to authenticated
  using (true)
  with check (true);

-- 4. Beri izin akses (GRANT) ke user yang sudah login.
--    Tanpa ini muncul error: "permission denied for table classes".
grant usage on schema public to authenticated;
grant all on table public.classes to authenticated;

-- ============================================================
-- TAHAP 2: DATA SISWA
-- ============================================================

-- 5. Tabel siswa. kelas_id mengikuti kelas; kalau kelas dihapus,
--    siswa tetap ada dan kolom kelas menjadi kosong (on delete set null).
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nama_siswa text not null,
  kelas_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 6. Aktifkan Row Level Security untuk tabel siswa
alter table public.students enable row level security;

-- 7. Izinkan guru yang sudah login mengelola siswa
drop policy if exists "Guru bisa membaca siswa" on public.students;
create policy "Guru bisa membaca siswa"
  on public.students for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah siswa" on public.students;
create policy "Guru bisa menambah siswa"
  on public.students for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa mengubah siswa" on public.students;
create policy "Guru bisa mengubah siswa"
  on public.students for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Guru bisa menghapus siswa" on public.students;
create policy "Guru bisa menghapus siswa"
  on public.students for delete
  to authenticated
  using (true);

-- 8. Izin akses (GRANT) ke user yang sudah login
grant usage on schema public to authenticated;
grant all on table public.students to authenticated;

-- 9. NIS (Nomor Induk Siswa) sebagai identitas siswa yang tampil.
--    Kolom boleh kosong agar data siswa lama tidak error; NIS wajib
--    diisi lewat form. NIS tidak boleh sama (unik).
alter table public.students add column if not exists nis text;
create unique index if not exists students_nis_unik on public.students (nis);

-- ============================================================
-- TAHAP 3: PAPAN PENGUMUMAN
-- ============================================================

-- 10. Tabel pengumuman. kelas_id boleh kosong (null) = berlaku untuk
--     semua kelas. Kalau kelas dihapus, pengumuman tetap ada
--     (on delete set null) dan menjadi "Semua kelas".
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  kelas_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. Aktifkan Row Level Security untuk tabel pengumuman
alter table public.announcements enable row level security;

-- 12. Izinkan guru yang sudah login mengelola pengumuman
drop policy if exists "Guru bisa membaca pengumuman" on public.announcements;
create policy "Guru bisa membaca pengumuman"
  on public.announcements for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah pengumuman" on public.announcements;
create policy "Guru bisa menambah pengumuman"
  on public.announcements for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa mengubah pengumuman" on public.announcements;
create policy "Guru bisa mengubah pengumuman"
  on public.announcements for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Guru bisa menghapus pengumuman" on public.announcements;
create policy "Guru bisa menghapus pengumuman"
  on public.announcements for delete
  to authenticated
  using (true);

-- 13. Izin akses (GRANT) ke user yang sudah login
grant usage on schema public to authenticated;
grant all on table public.announcements to authenticated;

-- ============================================================
-- TAHAP 4: PENGUMUMAN UNTUK BEBERAPA KELAS
-- ============================================================

-- 14. Tabel hubungan: satu pengumuman bisa berlaku untuk beberapa
--     kelas sekaligus. "Semua kelas" = tidak ada baris di tabel ini.
--     Kalau pengumuman atau kelas dihapus, baris hubungannya ikut
--     terhapus (on delete cascade).
create table if not exists public.announcement_classes (
  pengumuman_id uuid references public.announcements(id) on delete cascade,
  kelas_id uuid references public.classes(id) on delete cascade,
  primary key (pengumuman_id, kelas_id)
);

-- 15. Aktifkan Row Level Security untuk tabel hubungan
alter table public.announcement_classes enable row level security;

-- 16. Izinkan guru yang sudah login membaca dan mengelola hubungan
drop policy if exists "Guru bisa membaca pengumuman-kelas" on public.announcement_classes;
create policy "Guru bisa membaca pengumuman-kelas"
  on public.announcement_classes for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah hubungan pengumuman-kelas" on public.announcement_classes;
create policy "Guru bisa menambah hubungan pengumuman-kelas"
  on public.announcement_classes for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa menghapus hubungan pengumuman-kelas" on public.announcement_classes;
create policy "Guru bisa menghapus hubungan pengumuman-kelas"
  on public.announcement_classes for delete
  to authenticated
  using (true);

-- 17. Izin akses (GRANT) ke user yang sudah login
grant usage on schema public to authenticated;
grant all on table public.announcement_classes to authenticated;

-- ============================================================
-- TAHAP 5: ULANGAN & NILAI
-- ============================================================

-- 18. Tabel ulangan (ujian). Satu ulangan diadakan di satu kelas
--     (kelas_id boleh kosong = belum ditentukan).
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  kelas_id uuid references public.classes(id) on delete set null,
  tanggal date,
  created_at timestamptz not null default now()
);

-- 19. Nilai per siswa untuk satu ulangan. Nomor induk siswa (NIS)
--     tidak disimpan di sini — hanya id-nya, supaya kalau NIS berubah
--     nilainya tidak ikut rusak.
create table if not exists public.exam_scores (
  exam_id uuid references public.exams(id) on delete cascade,
  siswa_id uuid references public.students(id) on delete cascade,
  nilai int not null check (nilai >= 0 and nilai <= 100),
  primary key (exam_id, siswa_id)
);

-- 20. Aktifkan Row Level Security
alter table public.exams enable row level security;
alter table public.exam_scores enable row level security;

-- 21. Izinkan guru yang sudah login mengelola ulangan & nilai
drop policy if exists "Guru bisa membaca ulangan" on public.exams;
create policy "Guru bisa membaca ulangan"
  on public.exams for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah ulangan" on public.exams;
create policy "Guru bisa menambah ulangan"
  on public.exams for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa mengubah ulangan" on public.exams;
create policy "Guru bisa mengubah ulangan"
  on public.exams for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Guru bisa menghapus ulangan" on public.exams;
create policy "Guru bisa menghapus ulangan"
  on public.exams for delete
  to authenticated
  using (true);

drop policy if exists "Guru bisa membaca nilai" on public.exam_scores;
create policy "Guru bisa membaca nilai"
  on public.exam_scores for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah nilai" on public.exam_scores;
create policy "Guru bisa menambah nilai"
  on public.exam_scores for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa mengubah nilai" on public.exam_scores;
create policy "Guru bisa mengubah nilai"
  on public.exam_scores for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Guru bisa menghapus nilai" on public.exam_scores;
create policy "Guru bisa menghapus nilai"
  on public.exam_scores for delete
  to authenticated
  using (true);

-- 22. Izin akses (GRANT) ke user yang sudah login
grant usage on schema public to authenticated;
grant all on table public.exams to authenticated;
grant all on table public.exam_scores to authenticated;

-- ============================================================
-- TAHAP 6: AKUN SISWA (LOGIN KUSTOM) & KODE ULANGAN
-- ============================================================
-- Siswa login pakai username + password (dibatasi oleh guru).
-- Password disimpan sebagai hash PBKDF2 (salt + hash + iterasi),
-- bukan teks biasa. Username unik untuk semua siswa.
--
-- Catatan keamanan:
--  - Sesi login siswa disimpan di cookie kustom (bukan cookie Supabase).
--  - Halaman siswa hanya bisa diakses setelah login berhasil.
--  - Kredensial dibuat/diubah oleh guru lewat dashboard siswa.

-- 23. Tabel kredensial siswa (1 siswa bisa punya 1 akun).
create table if not exists public.student_accounts (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null unique references public.students(id) on delete cascade,
  username text not null,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Kolom is_active untuk nonaktifkan/aktifkan akun tanpa menghapus data.
-- Jika sudah ada tabel lama, tambahkan kolom ini (idempotent).
alter table public.student_accounts add column if not exists is_active boolean not null default true;

-- Username unik (case-insensitive) supaya tidak ada 2 akun sama.
create unique index if not exists student_accounts_username_unik
  on public.student_accounts (lower(username));

-- 24. Kode akses per ulangan: guru atur kode, siswa input kode
--     untuk membuka detail ulangan (supaya tidak bisa diakses bebas).
alter table public.exams add column if not exists access_code text;

-- 25. Aktifkan Row Level Security untuk tabel akun
alter table public.student_accounts enable row level security;

-- 26. Guru mengelola akun (CRUD penuh)
drop policy if exists "Guru bisa membaca akun siswa" on public.student_accounts;
create policy "Guru bisa membaca akun siswa"
  on public.student_accounts for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah akun siswa" on public.student_accounts;
create policy "Guru bisa menambah akun siswa"
  on public.student_accounts for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa mengubah akun siswa" on public.student_accounts;
create policy "Guru bisa mengubah akun siswa"
  on public.student_accounts for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Guru bisa menghapus akun siswa" on public.student_accounts;
create policy "Guru bisa menghapus akun siswa"
  on public.student_accounts for delete
  to authenticated
  using (true);

-- 27. Izin akses (GRANT) ke user yang sudah login
grant all on table public.student_accounts to authenticated;

-- ============================================================
-- TAHAP 7: AKSES ANON UNTUK PORTAL SISWA
-- ============================================================
-- Portal siswa TIDAK memakai Supabase Auth — sesi disimpan di
-- cookie kustom, jadi semua query dari sisi siswa berjalan dengan
-- role "anon". Tanpa GRANT + policy anon di bawah ini, muncul
-- error "permission denied for table ...".
--
-- Catatan keamanan: policy anon ini membuat SEMUA baris tabel
-- terkait bisa dibaca siapa pun tanpa login. Cocok untuk project
-- belajar/lokal. Untuk produksi, gunakan RPC security definer
-- (service role) atau pindahkan siswa ke Supabase Auth.

-- 28. Anon boleh BACA (SELECT) tabel-tabel yang dipakai portal siswa.
grant select on table public.student_accounts to anon;
grant select on table public.students to anon;
grant select on table public.classes to anon;
grant select on table public.exams to anon;
grant select on table public.exam_scores to anon;
grant select on table public.announcements to anon;
grant select on table public.announcement_classes to anon;

-- 29. Anon boleh UBAH (UPDATE) password sendiri.
grant update on table public.student_accounts to anon;

-- 30. Policy anon — bisa dibaca siapa pun.
drop policy if exists "Anon bisa baca akun siswa" on public.student_accounts;
create policy "Anon bisa baca akun siswa"
  on public.student_accounts for select
  to anon
  using (true);

drop policy if exists "Anon bisa ubah password akun siswa" on public.student_accounts;
create policy "Anon bisa ubah password akun siswa"
  on public.student_accounts for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Anon bisa baca siswa" on public.students;
create policy "Anon bisa baca siswa"
  on public.students for select
  to anon
  using (true);

drop policy if exists "Anon bisa baca kelas" on public.classes;
create policy "Anon bisa baca kelas"
  on public.classes for select
  to anon
  using (true);

drop policy if exists "Anon bisa baca ulangan" on public.exams;
create policy "Anon bisa baca ulangan"
  on public.exams for select
  to anon
  using (true);

drop policy if exists "Anon bisa baca nilai" on public.exam_scores;
create policy "Anon bisa baca nilai"
  on public.exam_scores for select
  to anon
  using (true);

drop policy if exists "Anon bisa baca pengumuman" on public.announcements;
create policy "Anon bisa baca pengumuman"
  on public.announcements for select
  to anon
  using (true);

drop policy if exists "Anon bisa baca pengumuman-kelas" on public.announcement_classes;
create policy "Anon bisa baca pengumuman-kelas"
  on public.announcement_classes for select
  to anon
  using (true);

-- ============================================================
-- TAHAP 8: ULANGAN UNTUK BEBERAPA KELAS
-- ============================================================
-- Mirip pengumuman: satu ulangan bisa berlaku untuk beberapa kelas
-- sekaligus. "Semua kelas" = tidak ada baris di tabel ini.
-- Ulangan lama yang masih memakai kolom exams.kelas_id TIDAK
-- otomatis dipindahkan — kode akan menggabungkan kedua sumber.

-- 31. Tabel hubungan: satu ulangan bisa mencakup beberapa kelas.
create table if not exists public.exam_classes (
  ulangan_id uuid references public.exams(id) on delete cascade,
  kelas_id uuid references public.classes(id) on delete cascade,
  primary key (ulangan_id, kelas_id)
);

-- 32. Aktifkan Row Level Security
alter table public.exam_classes enable row level security;

-- 33. Guru mengelola hubungan ulangan-kelas
drop policy if exists "Guru bisa membaca ulangan-kelas" on public.exam_classes;
create policy "Guru bisa membaca ulangan-kelas"
  on public.exam_classes for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah hubungan ulangan-kelas" on public.exam_classes;
create policy "Guru bisa menambah hubungan ulangan-kelas"
  on public.exam_classes for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa menghapus hubungan ulangan-kelas" on public.exam_classes;
create policy "Guru bisa menghapus hubungan ulangan-kelas"
  on public.exam_classes for delete
  to authenticated
  using (true);

-- 34. Izin akses (GRANT) ke user yang sudah login
grant usage on schema public to authenticated;
grant all on table public.exam_classes to authenticated;

-- 35. Portal siswa membaca (anon)
grant select on table public.exam_classes to anon;

drop policy if exists "Anon bisa baca ulangan-kelas" on public.exam_classes;
create policy "Anon bisa baca ulangan-kelas"
  on public.exam_classes for select
  to anon
  using (true);

-- ============================================================
-- TAHAP 9: ULANGAN BERSOAL (AKAN DILAKSANAKAN) & SUBMIT SISWA
-- ============================================================
-- Guru bisa membuat ulangan berstatus "akan dilaksanakan" yang
-- berisi soal (pilihan ganda + esai). Siswa mengerjakan online
-- sebelum tenggat; PG dinilai otomatis, esai dinilai manual guru.
-- Ulangan berstatus "sudah dilaksanakan" tetap memakai alur
-- input nilai manual yang sudah ada.

-- 36. Kolom status + tenggat waktu di tabel exams.
--     status: 'akan' = bersoal (siswa submit), 'sudah' = manual (default,
--     kompatibel data lama).
alter table public.exams add column if not exists status text not null default 'sudah'
  check (status in ('akan', 'sudah'));
alter table public.exams add column if not exists tenggat timestamptz;

-- 37. Tabel soal per ulangan.
create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  soal text not null,
  jenis text not null check (jenis in ('pg', 'esai')),
  -- Pilihan PG: array teks (["A. ...", "B. ..."]). null untuk esai.
  pilihan text[],
  -- Kunci jawaban PG (huruf, misal "B"). null untuk esai.
  kunci text,
  poin int not null default 0 check (poin >= 0),
  urutan int not null default 0,
  created_at timestamptz not null default now()
);

-- 38. Tabel submit jawaban siswa (1 siswa : 1 ulangan = 1 baris).
create table if not exists public.exam_submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  siswa_id uuid not null references public.students(id) on delete cascade,
  nilai_pg int not null default 0 check (nilai_pg >= 0),
  nilai_esai int not null default 0 check (nilai_esai >= 0),
  nilai_total int not null default 0 check (nilai_total >= 0),
  disubmit_at timestamptz not null default now(),
  unique (exam_id, siswa_id)
);

-- 39. Tabel detail jawaban per siswa per soal.
create table if not exists public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.exam_submissions(id) on delete cascade,
  soal_id uuid not null references public.exam_questions(id) on delete cascade,
  -- Jawaban siswa: huruf (PG) atau teks (esai)
  jawaban text not null,
  unique (submission_id, soal_id)
);

-- 40. Aktifkan RLS
alter table public.exam_questions enable row level security;
alter table public.exam_submissions enable row level security;
alter table public.exam_answers enable row level security;

-- 41. Guru: kelola soal
drop policy if exists "Guru bisa membaca soal" on public.exam_questions;
create policy "Guru bisa membaca soal"
  on public.exam_questions for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah soal" on public.exam_questions;
create policy "Guru bisa menambah soal"
  on public.exam_questions for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa mengubah soal" on public.exam_questions;
create policy "Guru bisa mengubah soal"
  on public.exam_questions for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Guru bisa menghapus soal" on public.exam_questions;
create policy "Guru bisa menghapus soal"
  on public.exam_questions for delete
  to authenticated
  using (true);

-- 42. Guru: kelola submit & jawaban
drop policy if exists "Guru bisa membaca submit" on public.exam_submissions;
create policy "Guru bisa membaca submit"
  on public.exam_submissions for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah submit" on public.exam_submissions;
create policy "Guru bisa menambah submit"
  on public.exam_submissions for insert
  to authenticated
  with check (true);

drop policy if exists "Guru bisa mengubah submit" on public.exam_submissions;
create policy "Guru bisa mengubah submit"
  on public.exam_submissions for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Guru bisa membaca jawaban" on public.exam_answers;
create policy "Guru bisa membaca jawaban"
  on public.exam_answers for select
  to authenticated
  using (true);

drop policy if exists "Guru bisa menambah jawaban" on public.exam_answers;
create policy "Guru bisa menambah jawaban"
  on public.exam_answers for insert
  to authenticated
  with check (true);

-- 43. Izin akses (GRANT) guru
grant usage on schema public to authenticated;
grant all on table public.exam_questions to authenticated;
grant all on table public.exam_submissions to authenticated;
grant all on table public.exam_answers to authenticated;

-- 44. Siswa (anon): baca soal, submit jawaban sendiri, baca jawaban sendiri
--     Catatan: policy anon `using (true)` membuat semua baris terbaca
--     tanpa login — konsisten dengan pola portal siswa yang sudah ada
--     di project ini (project belajar/lokal). Untuk produksi, batasi
--     lewat RPC security definer atau Supabase Auth.
grant select on table public.exam_questions to anon;
grant select on table public.exam_submissions to anon;
grant select on table public.exam_answers to anon;
-- Insert ke exam_submissions + exam_answers (hasil submit via RPC anon)
grant insert on table public.exam_submissions to anon;
grant insert on table public.exam_answers to anon;

drop policy if exists "Anon bisa baca soal" on public.exam_questions;
create policy "Anon bisa baca soal"
  on public.exam_questions for select
  to anon
  using (true);

drop policy if exists "Anon bisa submit ulangan" on public.exam_submissions;
create policy "Anon bisa submit ulangan"
  on public.exam_submissions for insert
  to anon
  with check (true);

drop policy if exists "Anon bisa baca jawaban sendiri" on public.exam_answers;
create policy "Anon bisa baca jawaban sendiri"
  on public.exam_answers for select
  to anon
  using (true);

drop policy if exists "Anon bisa tambah jawaban" on public.exam_answers;
create policy "Anon bisa tambah jawaban"
  on public.exam_answers for insert
  to anon
  with check (true);

drop policy if exists "Anon bisa baca submit" on public.exam_submissions;
create policy "Anon bisa baca submit"
  on public.exam_submissions for select
  to anon
  using (true);

-- ============================================================
-- Selesai. Cek: Table Editor harus menampilkan tabel
-- "classes", "students", "announcements", "announcement_classes",
-- "exams", "exam_scores", "student_accounts", "exam_classes",
-- "exam_questions", "exam_submissions", dan "exam_answers".
-- Kolom "status" dan "tenggat" ada di tabel "exams".
-- ============================================================

-- ============================================================
-- TAHAP 10: TIMER PENGERJAAN, KUNCI HALAMAN, & PILIHAN TAMPIL NILAI
-- ============================================================
-- 1) durasi (menit): batasan waktu mengerjakan per ulangan bersoal.
--    null = tanpa timer (pakai tenggat saja).
-- 2) nilai_ditampilkan: pilihan guru apakah hasil langsung
--    kelihatan oleh siswa setelah submit (default ya) atau
--    ditahan sampai guru menandai "selesai dinilai".
-- 3) nilai_selesai: guru menekan tombol "Selesai" → nilai
--    terbuka untuk semua siswa ulangan tersebut.
alter table public.exams add column if not exists durasi int
  check (durasi is null or durasi > 0);
alter table public.exams add column if not exists nilai_ditampilkan boolean
  not null default true;
alter table public.exams add column if not exists nilai_selesai boolean
  not null default false;

-- Catatan:
-- durasi: durasi pengerjaan (menit) — null = tanpa timer
-- nilai_ditampilkan: false = nilai ditahan sampai nilai_selesai=true
-- nilai_selesai: guru menandai "selesai dinilai" → nilai terbuka
--   untuk semua siswa ulangan ini.

-- Guru boleh mengubah ketiga kolom baru itu (pakai policy update
-- yang sudah ada — policy `using (true)` mencakup semua kolom).
-- Untuk kolom baru, Postgres otomatis memakai policy update yang
-- sudah ada karena with check (true). Tidak perlu policy baru.

grant usage on schema public to authenticated;
-- (grant all sudah dilakukan di tahap sebelumnya untuk table exams)

-- ============================================================
-- Selesai Tahap 10. Jalankan seluruh file ini di SQL Editor
-- (idempotent; tabel & kolom lama tidak terpengaruh).
-- ============================================================

-- ============================================================
-- TAHAP 11: PELACAK "PROBE" (BERAPA KALI SISWA KELUAR HALAMAN)
-- ============================================================
-- Setiap kali siswa pindah tab, minimize browser, atau kehilangan
-- fokus window selama mengerjakan ulangan, satu baris tercatat
-- di tabel ini. Digunakan guru untuk monitoring kejujuran.
--   jenis:
--     'blur'       = window kehilangan fokus (pindah tab/aplikasi)
--     'visibility' = document.visibilityState → hidden (minimize/lock)
--     'freeze'     = Page Visibility Level 2 (OS membekukan tab)
create table if not exists public.exam_probes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  siswa_id uuid not null references public.students(id) on delete cascade,
  jenis text not null check (jenis in ('blur', 'visibility', 'freeze')),
  tercatat_at timestamptz not null default now()
);

-- RLS
alter table public.exam_probes enable row level security;

-- Guru (authenticated) bisa baca semua probe
drop policy if exists "Guru bisa baca probe" on public.exam_probes;
create policy "Guru bisa baca probe"
  on public.exam_probes for select
  to authenticated
  using (true);

-- Anon (siswa): insert probe. Identitas siswa divalidasi
-- server-side di action `catatProbe` sebelum insert, jadi
-- policy anon cukup with check (true).
drop policy if exists "Anon bisa tambah probe" on public.exam_probes;
create policy "Anon bisa tambah probe"
  on public.exam_probes for insert
  to anon
  with check (true);

grant select on table public.exam_probes to authenticated;
grant insert on table public.exam_probes to anon;
grant usage on schema public to authenticated, anon;

-- ============================================================
-- Selesai Tahap 11. Tabel baru: "exam_probes".
-- ============================================================

-- ============================================================
-- TAHAP 12: KONTROL BUKA/TUTUP ULANGAN OLEH GURU
-- ============================================================
-- Kolom `dibuka` di tabel exams:
--   true  = ulangan terbuka untuk siswa (default)
--   false = ditutup oleh guru — siswa tidak bisa mengakses
--           jawaban soal (status "akan") / halaman nilai.
-- Guru bisa membalik flag ini kapan saja dari daftar ulangan.
alter table public.exams add column if not exists dibuka boolean
  not null default true;

-- Catatan:
-- Untuk status "akan": dibuka=false → siswa tidak bisa membuka
--   form jawaban ulangan; yang sudah submit tetap bisa melihat
--   hasil (sesuai aturan nilai_ditampilkan/nilai_selesai).
-- Untuk status "sudah": dibuka=false → halaman detail nilai
--   ditutup (siswa perlu menunggu guru membuka lagi).
-- Kolom ini diupdate lewat policy update `using (true)` yang
-- sudah ada, jadi tidak perlu policy baru.

-- ============================================================
-- Selesai Tahap 12. Kolom baru: "exams.dibuka".
-- ============================================================

-- ============================================================
-- TAHAP 13: NILAI ESAI PER SOAL
-- ============================================================
-- Sebelum Tahap 13, nilai esai hanya satu angka total per siswa
-- (disimpan di exam_submissions.nilai_esai). Sekarang guru menilai
-- setiap soal esai terpisah, dan totalnya dihitung dari jumlah
-- nilai per soal.
-- Tabel ini menyimpan nilai per soal per siswa per ulangan:
--   (exam_id, siswa_id, soal_id) unik → nilai 0–100
-- RLS: guru (authenticated) baca-tulis; siswa tidak perlu akses
-- langsung (mengakses via UI guru).
create table if not exists public.exam_essay_scores (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  siswa_id uuid not null references public.students(id) on delete cascade,
  soal_id uuid not null references public.exam_questions(id) on delete cascade,
  nilai integer not null check (nilai >= 0 and nilai <= 100),
  tercatat_at timestamptz not null default now(),
  constraint unik_esai_per_siswa_soal
    unique (exam_id, siswa_id, soal_id)
);

create index if not exists idx_exam_essay_scores_exam
  on public.exam_essay_scores (exam_id);
create index if not exists idx_exam_essay_scores_siswa
  on public.exam_essay_scores (siswa_id);

alter table public.exam_essay_scores enable row level security;

drop policy if exists "Guru kelola nilai esai per soal"
  on public.exam_essay_scores;
create policy "Guru kelola nilai esai per soal"
  on public.exam_essay_scores
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete
  on public.exam_essay_scores to authenticated;

-- ============================================================
-- Selesai Tahap 13. Tabel baru: "exam_essay_scores".
-- ============================================================

-- ============================================================
-- TAHAP 14: PENGUMUMAN TERJADWAL
-- ============================================================
-- mulai_pada: waktu pengumuman mulai tampil untuk siswa.
--   null   = langsung tampil (perilaku lama, tetap kompatibel)
--   terisi = disembunyikan dari siswa sampai waktunya tiba;
--            di portal guru tetap terlihat dengan penanda "Terjadwal".
alter table public.announcements add column if not exists mulai_pada timestamptz;

-- Catatan:
-- Tidak perlu policy/grant baru. GRANT yang sudah ada (authenticated:
-- `grant all`, anon: `grant select`) berlaku untuk semua kolom, dan
-- RLS bekerja di level baris (bukan kolom). Filter waktu dilakukan
-- saat halaman siswa dirender (tidak ada scheduler/cron).

-- ============================================================
-- Selesai Tahap 14. Kolom baru: "announcements.mulai_pada".
-- ============================================================

-- ============================================================
-- TAHAP 15: ABSENSI SISWA
-- ============================================================
-- Kehadiran siswa per kelas per tanggal.
--   status: 'hadir' | 'sakit' | 'izin' | 'alpa'
-- unik (siswa_id, tanggal): satu siswa satu status per hari sehingga
-- guru bisa menyimpan ulang (upsert) tanpa membuat baris ganda.
-- kelas_id disimpan agar rekap tetap benar walau siswa pindah kelas.
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  kelas_id uuid not null references public.classes(id) on delete cascade,
  siswa_id uuid not null references public.students(id) on delete cascade,
  tanggal date not null,
  status text not null check (status in ('hadir', 'sakit', 'izin', 'alpa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unik_absensi_per_siswa_tanggal unique (siswa_id, tanggal)
);

create index if not exists idx_attendance_kelas_tanggal
  on public.attendance (kelas_id, tanggal);
create index if not exists idx_attendance_siswa
  on public.attendance (siswa_id);

alter table public.attendance enable row level security;

-- Guru (authenticated) kelola penuh
drop policy if exists "Guru kelola absensi" on public.attendance;
create policy "Guru kelola absensi"
  on public.attendance
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.attendance to authenticated;

-- Anon (siswa): hanya baca. Identitas siswa divalidasi di halaman
-- (requireSiswa) dan query difilter `siswa_id = sesi`.
grant select on table public.attendance to anon;

drop policy if exists "Anon bisa baca absensi" on public.attendance;
create policy "Anon bisa baca absensi"
  on public.attendance for select
  to anon
  using (true);

-- ============================================================
-- Selesai Tahap 15. Tabel baru: "attendance".
-- ============================================================

-- ============================================================
-- TAHAP 16: TUGAS & PENGUMPULAN (LINK / FOTO / DOKUMEN)
-- ============================================================
-- Guru membuat tugas, lalu menentukan METODE pengumpulan:
--   'link'      = siswa mengirim tautan (URL)
--   'file'      = siswa mengunggah berkas (foto/dokumen)
--   'keduanya'  = tautan + berkas
-- Guru juga bisa memilih jenis file yang diizinkan (file_diizinkan,
-- daftar ekstensi mis. {'.pdf','.docx'}). Kosong = semua jenis aman.
-- Berkas disimpan di Supabase Storage bucket "tugas" (public read).

-- 45. Tabel tugas.
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  deskripsi text not null default '',
  tenggat timestamptz,
  metode text not null default 'link'
    check (metode in ('link', 'file', 'keduanya')),
  file_diizinkan text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kolom baru (idempotent kalau tabel sudah ada).
alter table public.assignments add column if not exists metode text not null default 'link';
alter table public.assignments add column if not exists file_diizinkan text[];

-- 46. Hubungan tugas-kelas. Kosong = berlaku untuk semua kelas.
create table if not exists public.assignment_classes (
  tugas_id uuid references public.assignments(id) on delete cascade,
  kelas_id uuid references public.classes(id) on delete cascade,
  primary key (tugas_id, kelas_id)
);

-- 47. Pengumpulan per siswa (1 siswa : 1 tugas = 1 baris).
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  tugas_id uuid not null references public.assignments(id) on delete cascade,
  siswa_id uuid not null references public.students(id) on delete cascade,
  tautan text,
  catatan text,
  nilai integer check (nilai is null or (nilai >= 0 and nilai <= 100)),
  umpan_balik text,
  dinilai_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unik_pengumpulan_per_siswa_tugas unique (tugas_id, siswa_id)
);

-- 48. Berkas pengumpulan (foto/dokumen) di storage.
create table if not exists public.assignment_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  tipe text not null check (tipe in ('foto', 'dokumen')),
  nama_file text not null,
  path text not null,
  ukuran integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignment_files_submission
  on public.assignment_files (submission_id);
create index if not exists idx_assignment_submissions_tugas
  on public.assignment_submissions (tugas_id);
create index if not exists idx_assignment_submissions_siswa
  on public.assignment_submissions (siswa_id);

-- 49. Aktifkan RLS.
alter table public.assignments enable row level security;
alter table public.assignment_classes enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_files enable row level security;

-- 50. Guru (authenticated): kelola penuh.
drop policy if exists "Guru kelola tugas" on public.assignments;
create policy "Guru kelola tugas"
  on public.assignments for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola tugas-kelas" on public.assignment_classes;
create policy "Guru kelola tugas-kelas"
  on public.assignment_classes for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola pengumpulan tugas" on public.assignment_submissions;
create policy "Guru kelola pengumpulan tugas"
  on public.assignment_submissions for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola berkas tugas" on public.assignment_files;
create policy "Guru kelola berkas tugas"
  on public.assignment_files for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.assignment_classes to authenticated;
grant select, insert, update, delete on public.assignment_submissions to authenticated;
grant select, insert, update, delete on public.assignment_files to authenticated;

-- 51. Siswa (anon): baca tugas, kirim/ubah pengumpulan sendiri.
--     Identitas siswa divalidasi di server action sebelum menulis.
grant select on table public.assignments to anon;
grant select on table public.assignment_classes to anon;
grant select on table public.assignment_submissions to anon;
grant select on table public.assignment_files to anon;
grant insert, update, delete on table public.assignment_submissions to anon;
grant insert, update, delete on table public.assignment_files to anon;

drop policy if exists "Anon baca tugas" on public.assignments;
create policy "Anon baca tugas"
  on public.assignments for select to anon using (true);

drop policy if exists "Anon baca tugas-kelas" on public.assignment_classes;
create policy "Anon baca tugas-kelas"
  on public.assignment_classes for select to anon using (true);

drop policy if exists "Anon baca pengumpulan" on public.assignment_submissions;
create policy "Anon baca pengumpulan"
  on public.assignment_submissions for select to anon using (true);

drop policy if exists "Anon kirim pengumpulan" on public.assignment_submissions;
create policy "Anon kirim pengumpulan"
  on public.assignment_submissions for insert to anon with check (true);

drop policy if exists "Anon ubah pengumpulan" on public.assignment_submissions;
create policy "Anon ubah pengumpulan"
  on public.assignment_submissions for update to anon
  using (true) with check (true);

drop policy if exists "Anon hapus pengumpulan" on public.assignment_submissions;
create policy "Anon hapus pengumpulan"
  on public.assignment_submissions for delete to anon using (true);

drop policy if exists "Anon baca berkas tugas" on public.assignment_files;
create policy "Anon baca berkas tugas"
  on public.assignment_files for select to anon using (true);

drop policy if exists "Anon tambah berkas tugas" on public.assignment_files;
create policy "Anon tambah berkas tugas"
  on public.assignment_files for insert to anon with check (true);

drop policy if exists "Anon ubah berkas tugas" on public.assignment_files;
create policy "Anon ubah berkas tugas"
  on public.assignment_files for update to anon
  using (true) with check (true);

drop policy if exists "Anon hapus berkas tugas" on public.assignment_files;
create policy "Anon hapus berkas tugas"
  on public.assignment_files for delete to anon using (true);

-- 52. Storage bucket "tugas" + policy.
--     Bucket public supaya berkas bisa ditampilkan lewat public URL.
insert into storage.buckets (id, name, public)
values ('tugas', 'tugas', true)
on conflict (id) do nothing;

drop policy if exists "Guru kelola berkas storage tugas" on storage.objects;
create policy "Guru kelola berkas storage tugas"
  on storage.objects for all to authenticated
  using (bucket_id = 'tugas') with check (bucket_id = 'tugas');

drop policy if exists "Anon baca berkas storage tugas" on storage.objects;
create policy "Anon baca berkas storage tugas"
  on storage.objects for select to anon using (bucket_id = 'tugas');

drop policy if exists "Anon upload berkas storage tugas" on storage.objects;
create policy "Anon upload berkas storage tugas"
  on storage.objects for insert to anon with check (bucket_id = 'tugas');

drop policy if exists "Anon ubah berkas storage tugas" on storage.objects;
create policy "Anon ubah berkas storage tugas"
  on storage.objects for update to anon
  using (bucket_id = 'tugas') with check (bucket_id = 'tugas');

drop policy if exists "Anon hapus berkas storage tugas" on storage.objects;
create policy "Anon hapus berkas storage tugas"
  on storage.objects for delete to anon using (bucket_id = 'tugas');

-- ============================================================
-- Selesai Tahap 16. Tabel baru: "assignments", "assignment_classes",
-- "assignment_submissions", "assignment_files". Bucket storage: "tugas".
-- ============================================================

-- ============================================================
-- TAHAP 17: LAB CODING PYTHON (PYODIDE)
-- ============================================================
-- Guru menyediakan materi (modul) berisi level latihan. Siswa menulis
-- kode Python di editor, menjalankan lewat Pyodide di browser, dan
-- dinilai otomatis dengan mencocokkan output.
-- Modul punya target kelas (kosong = semua kelas).
-- Hasil terakhir tiap latihan disimpan (unique per siswa+latihan), dan
-- flag pernah_benar dipakai untuk progres.

-- 53. Modul materi.
create table if not exists public.coding_lessons (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  urutan int not null default 0,
  isi text not null default '',
  created_at timestamptz not null default now()
);

-- 54. Level latihan per modul. `level` = nomor urut tantangan.
create table if not exists public.coding_exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.coding_lessons(id) on delete cascade,
  level int not null,
  judul text not null,
  penjelasan text not null default '',
  contoh_kode text,
  instruksi text not null,
  kode_awal text,
  keluaran_diharapkan text not null,
  poin int not null default 10,
  urutan int not null default 0,
  created_at timestamptz not null default now(),
  constraint unik_level_per_modul unique (lesson_id, level)
);

-- 55. Hasil terakhir tiap siswa per latihan.
create table if not exists public.coding_submissions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.coding_exercises(id) on delete cascade,
  siswa_id uuid not null references public.students(id) on delete cascade,
  kode text not null default '',
  keluaran text not null default '',
  benar boolean not null default false,
  pernah_benar boolean not null default false,
  percobaan int not null default 0,
  updated_at timestamptz not null default now(),
  constraint unik_lab_per_siswa_latihan unique (exercise_id, siswa_id)
);

-- 56. Target kelas per modul (kosong = semua kelas).
create table if not exists public.coding_lesson_classes (
  lesson_id uuid references public.coding_lessons(id) on delete cascade,
  kelas_id uuid references public.classes(id) on delete cascade,
  primary key (lesson_id, kelas_id)
);

create index if not exists idx_coding_exercises_lesson
  on public.coding_exercises (lesson_id);
create index if not exists idx_coding_submissions_siswa
  on public.coding_submissions (siswa_id);
create index if not exists idx_coding_submissions_exercise
  on public.coding_submissions (exercise_id);
create index if not exists idx_coding_lesson_classes_kelas
  on public.coding_lesson_classes (kelas_id);

-- 57. Aktifkan RLS.
alter table public.coding_lessons enable row level security;
alter table public.coding_exercises enable row level security;
alter table public.coding_submissions enable row level security;
alter table public.coding_lesson_classes enable row level security;

-- 58. Guru (authenticated): kelola penuh.
drop policy if exists "Guru kelola modul lab" on public.coding_lessons;
create policy "Guru kelola modul lab"
  on public.coding_lessons for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola latihan lab" on public.coding_exercises;
create policy "Guru kelola latihan lab"
  on public.coding_exercises for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola hasil lab" on public.coding_submissions;
create policy "Guru kelola hasil lab"
  on public.coding_submissions for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola kelas lab" on public.coding_lesson_classes;
create policy "Guru kelola kelas lab"
  on public.coding_lesson_classes for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.coding_lessons to authenticated;
grant select, insert, update, delete on public.coding_exercises to authenticated;
grant select, insert, update, delete on public.coding_submissions to authenticated;
grant select, insert, update, delete on public.coding_lesson_classes to authenticated;

-- 59. Siswa (anon): baca materi/latihan, tulis hasil sendiri
--     (identitas divalidasi di server action).
grant select on table public.coding_lessons to anon;
grant select on table public.coding_exercises to anon;
grant select on table public.coding_submissions to anon;
grant select on table public.coding_lesson_classes to anon;
grant insert, update on table public.coding_submissions to anon;

drop policy if exists "Anon baca modul lab" on public.coding_lessons;
create policy "Anon baca modul lab"
  on public.coding_lessons for select to anon using (true);

drop policy if exists "Anon baca latihan lab" on public.coding_exercises;
create policy "Anon baca latihan lab"
  on public.coding_exercises for select to anon using (true);

drop policy if exists "Anon baca kelas lab" on public.coding_lesson_classes;
create policy "Anon baca kelas lab"
  on public.coding_lesson_classes for select to anon using (true);

drop policy if exists "Anon baca hasil lab" on public.coding_submissions;
create policy "Anon baca hasil lab"
  on public.coding_submissions for select to anon using (true);

drop policy if exists "Anon kirim hasil lab" on public.coding_submissions;
create policy "Anon kirim hasil lab"
  on public.coding_submissions for insert to anon with check (true);

drop policy if exists "Anon ubah hasil lab" on public.coding_submissions;
create policy "Anon ubah hasil lab"
  on public.coding_submissions for update to anon
  using (true) with check (true);

-- 60. SEED Modul 1 (idempoten).
insert into public.coding_lessons (judul, urutan, isi)
select
  $j$Modul 1 — Mencetak & Variabel$j$,
  1,
  $i$Selamat datang di Lab Coding Python!

Di modul ini kamu belajar menampilkan teks dengan print(), lalu menyimpan teks ke dalam variabel. Setiap level punya penjelasan singkat sebelum tantangan.

Cara kerja:
1. Baca penjelasan dan contohnya.
2. Tulis kode Python di editor.
3. Klik "Jalankan" untuk menguji. Output kodemu dibandingkan otomatis dengan output yang diharapkan.

Selamat mencoba!$i$
where not exists (
  select 1 from public.coding_lessons where judul = $j$Modul 1 — Mencetak & Variabel$j$
);

-- 61. SEED 15 level latihan Modul 1 (hanya disisipkan kalau belum ada).
insert into public.coding_exercises
  (lesson_id, level, judul, penjelasan, contoh_kode, instruksi, kode_awal, keluaran_diharapkan, poin, urutan)
select
  l.id, v.level, v.judul, v.penjelasan, v.contoh_kode, v.instruksi, v.kode_awal, v.keluaran_diharapkan, v.poin, v.level
from public.coding_lessons l
cross join (values
  (1,
   $j$Mencetak teks$j$,
   $p$Python menjalankan program baris per baris. Perintah print() menampilkan sesuatu ke layar. Teks harus diapit tanda kutip, bisa "..." atau '...' .$p$,
   $c$print("Selamat pagi")$c$,
   $t$Cetak tepat: Halo, Python!$t$,
   $k$# Cetak Halo, Python!$k$,
   $o$Halo, Python!$o$, 5),
  (2,
   $j$Mencetak kalimat$j$,
   $p$Teks boleh berisi spasi dan tanda baca. Yang penting tetap diapit tanda kutip.$p$,
   $c$print("Hari ini cerah sekali!")$c$,
   $t$Cetak: Saya sedang belajar Python$t$,
   $k$# Cetak kalimat berikut$k$,
   $o$Saya sedang belajar Python$o$, 5),
  (3,
   $j$Beberapa baris$j$,
   $p$Satu print() menghasilkan satu baris. Untuk beberapa baris, tulis beberapa print(). Tiap perintah menulis ke baris baru.$p$,
   $c$print("Baris pertama")
print("Baris kedua")$c$,
   $t$Cetak tiga baris: Nama: Andi, lalu Kelas: 7A, lalu Sekolah: SMP Nusantara$t$,
   $k$# Cetak tiga baris$k$,
   $o$Nama: Andi
Kelas: 7A
Sekolah: SMP Nusantara$o$, 10),
  (4,
   $j$Banyak argumen (koma)$j$,
   $p$print() bisa menerima beberapa bagian dipisah koma, dan Python otomatis menyisipkan satu spasi di antaranya.$p$,
   $c$print("Halo", "dunia")$c$,
   $t$Dengan satu print() dan tanda koma, cetak: Nama: Andi$t$,
   $k$# Gunakan satu print() dan tanda koma$k$,
   $o$Nama: Andi$o$, 10),
  (5,
   $j$Tanda kutip di dalam teks$j$,
   $p$Kalau teks ingin memuat tanda kutip ganda, bungkus dengan tanda kutip tunggal (dan sebaliknya). Ini supaya Python tahu mana awal dan akhir teks.$p$,
   $c$print('Dia berkata "Halo"')$c$,
   $t$Cetak: Dia berkata "Halo"$t$,
   $k$# Cetak kalimat di atas$k$,
   $o$Dia berkata "Halo"$o$, 10),
  (6,
   $j$Baris baru (\n)$j$,
   $p$\n adalah kode khusus untuk "pindah baris". Bisa dipakai agar satu print() menghasilkan beberapa baris.$p$,
   $c$print("Atas\nBawah")$c$,
   $t$Dengan satu print() dan \n, hasilkan dua baris: Baris 1 dan Baris 2$t$,
   $k$# Gunakan \n dalam satu print()$k$,
   $o$Baris 1
Baris 2$o$, 10),
  (7,
   $j$Variabel menyimpan teks$j$,
   $p$Variabel adalah wadah untuk menyimpan nilai. Tanda = berarti "isi variabel dengan". Nama variabel ditulis tanpa spasi. Isinya bisa dicetak.$p$,
   $c$sapaan = "Halo"
print(sapaan)$c$,
   $t$Buat variabel sapaan = "Halo", lalu cetak isinya.$t$,
   $k$sapaan = "Halo"$k$,
   $o$Halo$o$, 10),
  (8,
   $j$Dua variabel$j$,
   $p$Kamu boleh punya banyak variabel. Beberapa variabel bisa ditampilkan sekaligus dengan print(v1, v2).$p$,
   $c$kata1 = "Selamat"
kata2 = "malam"
print(kata1, kata2)$c$,
   $t$Buat kata1 = "Selamat" dan kata2 = "pagi", lalu cetak keduanya dengan koma.$t$,
   $k$kata1 = "Selamat"
kata2 = "pagi"$k$,
   $o$Selamat pagi$o$, 10),
  (9,
   $j$Variabel + teks$j$,
   $p$Isi variabel bisa digabung dengan teks biasa dalam satu print, dipisah koma. Tanda kutip hanya untuk teks yang kamu tulis langsung.$p$,
   $c$nama = "Siti"
print("Halo,", nama)$c$,
   $t$Buat nama = "Andi", lalu cetak: Halo, Andi$t$,
   $k$nama = "Andi"$k$,
   $o$Halo, Andi$o$, 15),
  (10,
   $j$Kartu nama sederhana$j$,
   $p$Gabungkan beberapa print(), variabel, dan teks menjadi keluaran yang rapi.$p$,
   null,
   $t$Buat nama = "Andi" dan kelas = "7A", lalu cetak 4 baris: ==========, Nama: Andi, Kelas: 7A, ==========$t$,
   $k$nama = "Andi"
kelas = "7A"$k$,
   $o$==========
Nama: Andi
Kelas: 7A
==========$o$, 15),
  (11,
   $j$Tiga variabel$j$,
   $p$Kamu bisa memakai lebih dari dua variabel, dan semuanya dapat dicetak sekaligus.$p$,
   $c$a = "A"
b = "B"
c = "C"
print(a, b, c)$c$,
   $t$Buat a = "Python", b = "itu", c = "menyenangkan", lalu cetak: Python itu menyenangkan$t$,
   $k$a = "Python"
b = "itu"
c = "menyenangkan"$k$,
   $o$Python itu menyenangkan$o$, 15),
  (12,
   $j$Mengubah isi variabel$j$,
   $p$Isi variabel bisa diganti kapan saja dengan =. Nilai lama akan tertimpa. Urutan perintah penting karena print() menampilkan nilai saat itu.$p$,
   null,
   $t$Mulai warna = "merah", cetak. Lalu ubah isinya menjadi "biru", cetak lagi.$t$,
   $k$warna = "merah"$k$,
   $o$merah
biru$o$, 15),
  (13,
   $j$Menukar isi dua variabel$j$,
   $p$Untuk menukar isi, gunakan variabel bantu: sementara = a, a = b, b = sementara. Cara singkatnya: a, b = b, a.$p$,
   null,
   $t$Buat a = "kiri" dan b = "kanan". Tukar isinya, lalu cetak a dan b.$t$,
   $k$a = "kiri"
b = "kanan"$k$,
   $o$kanan kiri$o$, 20),
  (14,
   $j$Variabel teks multi-baris$j$,
   $p$Variabel bisa menyimpan teks yang berisi \n, sehingga satu print menghasilkan beberapa baris.$p$,
   null,
   $t$Buat variabel puisi berisi teks dua baris: Baris pertama lalu Baris kedua (gunakan \n), lalu cetak.$t$,
   $k$puisi = "Baris pertama\nBaris kedua"$k$,
   $o$Baris pertama
Baris kedua$o$, 20),
  (15,
   $j$Kartu data diri$j$,
   $p$Latihan puncak: gabungkan variabel, teks, dan beberapa baris menjadi keluaran yang rapi.$p$,
   null,
   $t$Buat nama = "Andi", kelas = "7A", sekolah = "SMP Nusantara", lalu cetak 5 baris: ==========, Nama: Andi, Kelas: 7A, Sekolah: SMP Nusantara, ==========$t$,
   $k$nama = "Andi"
kelas = "7A"
sekolah = "SMP Nusantara"$k$,
   $o$==========
Nama: Andi
Kelas: 7A
Sekolah: SMP Nusantara
==========$o$, 25)
) as v(level, judul, penjelasan, contoh_kode, instruksi, kode_awal, keluaran_diharapkan, poin)
where l.judul = $j$Modul 1 — Mencetak & Variabel$j$
  and not exists (
    select 1 from public.coding_exercises e
    where e.lesson_id = l.id and e.level = v.level
  );

-- 62. SEED target kelas Modul 1 → kelas 9 (kalau ada).
insert into public.coding_lesson_classes (lesson_id, kelas_id)
select l.id, c.id
from public.coding_lessons l
join public.classes c
  on (c.nama_kelas ilike '9%' or c.nama_kelas ilike 'kelas 9%' or c.nama_kelas ilike 'ix%')
where l.judul = $j$Modul 1 — Mencetak & Variabel$j$
on conflict do nothing;

-- ============================================================
-- Selesai Tahap 17. Tabel baru: "coding_lessons", "coding_exercises",
-- "coding_submissions", "coding_lesson_classes".
-- ============================================================

-- ============================================================
-- TAHAP 18: LOG LOGIN SISWA
-- ============================================================
-- Mencatat setiap percobaan login siswa (berhasil/gagal) agar bisa
-- dipantau guru: siapa, kapan, dari IP mana, dan alasannya kalau gagal.
create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  -- siswa_id null kalau username tidak ditemukan (percobaan gagal).
  siswa_id uuid references public.students(id) on delete set null,
  username text not null,
  berhasil boolean not null default false,
  -- alasan gagal: 'password_salah' | 'akun_nonaktif' |
  -- 'username_tidak_ditemukan' | 'diblokir'. null = berhasil.
  alasan text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_logs_created
  on public.login_logs (created_at desc);
create index if not exists idx_login_logs_siswa
  on public.login_logs (siswa_id);

alter table public.login_logs enable row level security;

-- Guru (authenticated): baca & hapus log.
drop policy if exists "Guru baca log login" on public.login_logs;
create policy "Guru baca log login"
  on public.login_logs for select to authenticated
  using (true);

drop policy if exists "Guru hapus log login" on public.login_logs;
create policy "Guru hapus log login"
  on public.login_logs for delete to authenticated
  using (true);

grant select, delete on public.login_logs to authenticated;

-- Anon (aksi login siswa): hanya boleh menyisipkan log.
grant insert on public.login_logs to anon;

drop policy if exists "Anon tambah log login" on public.login_logs;
create policy "Anon tambah log login"
  on public.login_logs for insert to anon
  with check (true);

-- ============================================================
-- Selesai Tahap 18. Tabel baru: "login_logs".
-- ============================================================

-- ============================================================
-- TAHAP 19: LAB KOMPUTER (PRAKTIK DASAR — MOUSE)
-- ============================================================
-- Tantangan interaktif dasar komputer yang dinilai otomatis:
-- klik, klik kanan, klik ganda, hover (arahkan), drag & drop, scroll,
-- seleksi teks, dan kuis. Struktur generik: kolom `jenis` + `konfigurasi`
-- (jsonb), sehingga mudah ditambah jenis lain (keyboard/shortcut) nanti.
-- Modul punya target kelas (kosong = semua kelas).

-- 63. Modul (bagian) praktik.
create table if not exists public.komputer_lessons (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  urutan int not null default 0,
  isi text not null default '',
  created_at timestamptz not null default now()
);

-- 64. Tantangan per modul.
create table if not exists public.komputer_challenges (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.komputer_lessons(id) on delete cascade,
  level int not null,
  judul text not null,
  jenis text not null check (jenis in (
    'klik', 'klik_kanan', 'klik_ganda', 'hover',
    'drag', 'scroll', 'seleksi', 'kuis'
  )),
  penjelasan text not null default '',
  contoh text,
  instruksi text not null,
  konfigurasi jsonb not null default '{}'::jsonb,
  poin int not null default 5,
  urutan int not null default 0,
  created_at timestamptz not null default now(),
  constraint unik_level_komputer unique (lesson_id, level)
);

-- 65. Hasil terakhir tiap siswa per tantangan.
create table if not exists public.komputer_hasil (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.komputer_challenges(id) on delete cascade,
  siswa_id uuid not null references public.students(id) on delete cascade,
  benar boolean not null default false,
  pernah_benar boolean not null default false,
  percobaan int not null default 0,
  updated_at timestamptz not null default now(),
  constraint unik_komputer_per_siswa_latihan unique (challenge_id, siswa_id)
);

-- 66. Target kelas per modul (kosong = semua kelas).
create table if not exists public.komputer_lesson_classes (
  lesson_id uuid references public.komputer_lessons(id) on delete cascade,
  kelas_id uuid references public.classes(id) on delete cascade,
  primary key (lesson_id, kelas_id)
);

create index if not exists idx_komputer_challenges_lesson
  on public.komputer_challenges (lesson_id);
create index if not exists idx_komputer_hasil_siswa
  on public.komputer_hasil (siswa_id);
create index if not exists idx_komputer_hasil_challenge
  on public.komputer_hasil (challenge_id);

-- 67. Aktifkan RLS.
alter table public.komputer_lessons enable row level security;
alter table public.komputer_challenges enable row level security;
alter table public.komputer_hasil enable row level security;
alter table public.komputer_lesson_classes enable row level security;

-- 68. Guru (authenticated): kelola penuh.
drop policy if exists "Guru kelola modul komputer" on public.komputer_lessons;
create policy "Guru kelola modul komputer"
  on public.komputer_lessons for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola tantangan komputer" on public.komputer_challenges;
create policy "Guru kelola tantangan komputer"
  on public.komputer_challenges for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola hasil komputer" on public.komputer_hasil;
create policy "Guru kelola hasil komputer"
  on public.komputer_hasil for all to authenticated
  using (true) with check (true);

drop policy if exists "Guru kelola kelas komputer" on public.komputer_lesson_classes;
create policy "Guru kelola kelas komputer"
  on public.komputer_lesson_classes for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.komputer_lessons to authenticated;
grant select, insert, update, delete on public.komputer_challenges to authenticated;
grant select, insert, update, delete on public.komputer_hasil to authenticated;
grant select, insert, update, delete on public.komputer_lesson_classes to authenticated;

-- 69. Siswa (anon): baca modul/tantangan, tulis hasil sendiri.
grant select on table public.komputer_lessons to anon;
grant select on table public.komputer_challenges to anon;
grant select on table public.komputer_hasil to anon;
grant select on table public.komputer_lesson_classes to anon;
grant insert, update on table public.komputer_hasil to anon;

drop policy if exists "Anon baca modul komputer" on public.komputer_lessons;
create policy "Anon baca modul komputer"
  on public.komputer_lessons for select to anon using (true);

drop policy if exists "Anon baca tantangan komputer" on public.komputer_challenges;
create policy "Anon baca tantangan komputer"
  on public.komputer_challenges for select to anon using (true);

drop policy if exists "Anon baca kelas komputer" on public.komputer_lesson_classes;
create policy "Anon baca kelas komputer"
  on public.komputer_lesson_classes for select to anon using (true);

drop policy if exists "Anon baca hasil komputer" on public.komputer_hasil;
create policy "Anon baca hasil komputer"
  on public.komputer_hasil for select to anon using (true);

drop policy if exists "Anon kirim hasil komputer" on public.komputer_hasil;
create policy "Anon kirim hasil komputer"
  on public.komputer_hasil for insert to anon with check (true);

drop policy if exists "Anon ubah hasil komputer" on public.komputer_hasil;
create policy "Anon ubah hasil komputer"
  on public.komputer_hasil for update to anon
  using (true) with check (true);

-- 70. SEED Modul Bagian 0-2 (idempoten).
insert into public.komputer_lessons (judul, urutan, isi)
select $j$Bagian 0 — Mengenal Komputer & Kursor$j$, 0,
$i$Sebelum praktik, kenali dulu alatnya.

Komputer terdiri dari beberapa bagian: monitor (layar), CPU (kotak komputer), keyboard (papan tombol), dan mouse (alat penunjuk). Mouse dipakai untuk menggerakkan kursor di layar. Kursor bisa berubah bentuk sesuai fungsinya: panah (siap menunjuk), huruf I (siap mengetik teks), dan tangan (menunjuk tautan).

Cara memegang mouse: letakkan telapak dengan nyaman, jari telunjuk di tombol kiri, jari tengah di tombol kanan.$i$
where not exists (select 1 from public.komputer_lessons where judul = $j$Bagian 0 — Mengenal Komputer & Kursor$j$);

insert into public.komputer_lessons (judul, urutan, isi)
select $j$Bagian 1 — Mouse Dasar (Klik)$j$, 1,
$i$Mouse punya tiga cara klik yang sering dipakai:

- Klik kiri: menekan tombol kiri sekali untuk memilih atau menekan tombol.
- Klik kanan: memunculkan menu konteks (daftar perintah).
- Klik ganda: menekan tombol kiri dua kali cepat untuk membuka file/folder.

Ingat: klik kanan bukan untuk membuka, tapi untuk menampilkan menu.$i$
where not exists (select 1 from public.komputer_lessons where judul = $j$Bagian 1 — Mouse Dasar (Klik)$j$);

insert into public.komputer_lessons (judul, urutan, isi)
select $j$Bagian 2 — Mouse Lanjutan (Drag & Scroll)$j$, 2,
$i$Kemampuan mouse lanjutan:

- Drag & drop: tahan tombol kiri, seret item ke tempat lain, lalu lepas.
- Scroll: memutar roda mouse (atau menggeser) untuk naik-turun halaman.
- Seleksi/menyorot: drag dari awal ke akhir teks untuk memilih teks.

Drag & drop dipakai untuk memindahkan file ke folder, sedangkan scroll untuk melihat isi yang lebih panjang.$i$
where not exists (select 1 from public.komputer_lessons where judul = $j$Bagian 2 — Mouse Lanjutan (Drag & Scroll)$j$);

-- 71. SEED tantangan Bagian 0.
insert into public.komputer_challenges
  (lesson_id, level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin, urutan)
select l.id, v.level, v.judul, v.jenis, v.penjelasan, v.contoh, v.instruksi, v.konfigurasi, v.poin, v.level
from public.komputer_lessons l
cross join (values
  (1, $j$Fungsi mouse$j$, 'kuis',
   $p$Mouse adalah alat penunjuk. Kita memakainya untuk menggerakkan kursor, memilih, dan mengklik.$p$, null,
   $t$Alat untuk menggerakkan kursor di layar adalah…$t$,
   $k${"pertanyaan":"Alat untuk menggerakkan kursor di layar adalah…","pilihan":["Printer","Mouse","Speaker","Flashdisk"],"jawaban":"Mouse"}$k$::jsonb, 5),
  (2, $j$Temukan mouse$j$, 'klik',
   $p$Kursor di layar digerakkan dengan mouse. Untuk memilih objek, klik tombol kiri tepat di objeknya.$p$, null,
   $t$Klik objek bergambar mouse (tulisan "Mouse").$t$,
   $k${"pilihan":["Monitor","Mouse","Keyboard","Printer"],"jawaban":"Mouse"}$k$::jsonb, 5),
  (3, $j$Arahkan kursor$j$, 'hover',
   $p$Untuk mengarahkan, cukup gerakkan mouse sampai kursor berada di atas objek. Tidak perlu diklik.$p$, null,
   $t$Arahkan kursor ke tombol "Tujuan" dan tahan 1 detik.$t$,
   $k${"pilihan":["Mulai","Tujuan","Batal","Ulang"],"jawaban":"Tujuan","tahanMs":1000}$k$::jsonb, 10),
  (4, $j$Bentuk kursor$j$, 'kuis',
   $p$Kursor punya beberapa bentuk: panah (siap menunjuk/memilih), huruf I (siap mengetik teks), dan tangan (menunjuk tautan).$p$, null,
   $t$Kursor berbentuk panah berarti…$t$,
   $k${"pertanyaan":"Kursor berbentuk panah berarti…","pilihan":["siap menunjuk/memilih","sedang memuat","sedang mengetik","terjadi error"],"jawaban":"siap menunjuk/memilih"}$k$::jsonb, 5),
  (5, $j$Klik tombol$j$, 'klik',
   $p$Klik berarti menekan tombol kiri mouse satu kali. Biasanya untuk menekan tombol.$p$, null,
   $t$Klik tombol "Mulai".$t$,
   $k${"pilihan":["Mulai","Stop","Hapus","Tutup"],"jawaban":"Mulai"}$k$::jsonb, 5)
) as v(level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin)
where l.judul = $j$Bagian 0 — Mengenal Komputer & Kursor$j$
  and not exists (
    select 1 from public.komputer_challenges c
    where c.lesson_id = l.id and c.level = v.level
  );

-- 72. SEED tantangan Bagian 1.
insert into public.komputer_challenges
  (lesson_id, level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin, urutan)
select l.id, v.level, v.judul, v.jenis, v.penjelasan, v.contoh, v.instruksi, v.konfigurasi, v.poin, v.level
from public.komputer_lessons l
cross join (values
  (1, $j$Klik satu kali$j$, 'klik',
   $p$Klik kiri satu kali untuk menekan tombol atau memilih sesuatu.$p$, null,
   $t$Klik satu kali tombol "Simpan".$t$,
   $k${"pilihan":["Simpan","Batal","Hapus","Ulang"],"jawaban":"Simpan"}$k$::jsonb, 5),
  (2, $j$Pilih nama$j$, 'klik',
   $p$Klik kiri untuk memilih salah satu item pada daftar.$p$, null,
   $t$Pilih nama "Citra" pada daftar.$t$,
   $k${"pilihan":["Andi","Budi","Citra","Dewi"],"jawaban":"Citra"}$k$::jsonb, 5),
  (3, $j$Klik kanan$j$, 'klik_kanan',
   $p$Klik kanan memunculkan menu konteks berisi perintah.$p$, null,
   $t$Klik KANAN pada objek "Dokumen".$t$,
   $k${"pilihan":["Dokumen","Gambar","Musik","Video"],"jawaban":"Dokumen"}$k$::jsonb, 10),
  (4, $j$Pilih menu konteks$j$, 'klik',
   $p$Setelah klik kanan, muncul menu. Klik kiri untuk memilih salah satu perintahnya (mis. Buka).$p$, null,
   $t$Dari menu konteks, klik perintah "Buka".$t$,
   $k${"pilihan":["Buka","Salin","Hapus","Ganti nama"],"jawaban":"Buka"}$k$::jsonb, 10),
  (5, $j$Klik ganda$j$, 'klik_ganda',
   $p$Klik ganda = klik kiri dua kali dengan cepat. Dipakai untuk membuka file/folder.$p$, null,
   $t$Klik GANDA folder "Data" untuk membukanya.$t$,
   $k${"pilihan":["Data","Gambar","Musik","Video"],"jawaban":"Data"}$k$::jsonb, 10),
  (6, $j$Membuka folder$j$, 'kuis',
   $p$Membuka file atau folder dilakukan dengan klik ganda (bukan klik kanan).$p$, null,
   $t$Untuk membuka folder, kita melakukan…$t$,
   $k${"pertanyaan":"Untuk membuka folder, kita melakukan…","pilihan":["klik kiri sekali","klik kanan","klik ganda","tahan tombol"],"jawaban":"klik ganda"}$k$::jsonb, 5)
) as v(level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin)
where l.judul = $j$Bagian 1 — Mouse Dasar (Klik)$j$
  and not exists (
    select 1 from public.komputer_challenges c
    where c.lesson_id = l.id and c.level = v.level
  );

-- 73. SEED tantangan Bagian 2.
insert into public.komputer_challenges
  (lesson_id, level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin, urutan)
select l.id, v.level, v.judul, v.jenis, v.penjelasan, v.contoh, v.instruksi, v.konfigurasi, v.poin, v.level
from public.komputer_lessons l
cross join (values
  (1, $j$Seret ke folder$j$, 'drag',
   $p$Drag & drop: tahan tombol kiri pada item, seret ke tujuan, lalu lepas.$p$, null,
   $t$Seret "Ikon" ke dalam folder "Tugas".$t$,
   $k${"item":"Ikon","tujuan":"Tugas","pilihan":["Tugas","Sampah","Gambar","Musik"]}$k$::jsonb, 10),
  (2, $j$Seret bola ke gawang$j$, 'drag',
   $p$Drag & drop juga dipakai untuk memindahkan benda ke tempat yang tepat.$p$, null,
   $t$Seret "Bola" ke "Gawang".$t$,
   $k${"item":"Bola","tujuan":"Gawang","pilihan":["Gawang","Keranjang","Kotak","Keranjang sampah"]}$k$::jsonb, 10),
  (3, $j$Gulir daftar$j$, 'scroll',
   $p$Scroll (roda mouse) untuk melihat isi yang lebih panjang, lalu klik item yang dicari.$p$, null,
   $t$Gulir daftar sampai menemukan "Kunci", lalu klik "Kunci".$t$,
   $k${"pilihan":["Pena","Buku","Penggaris","Pensil","Penghapus","Tas","Sepatu","Topi","Krayon","Spidol","Kunci"],"jawaban":"Kunci"}$k$::jsonb, 10),
  (4, $j$Sorot kalimat$j$, 'seleksi',
   $p$Menyorot teks: tahan tombol kiri di awal teks, drag ke akhir teks, lalu lepas.$p$, null,
   $t$Sorot (drag) seluruh kalimat: "belajar komputer itu menyenangkan".$t$,
   $k${"teks":"belajar komputer itu menyenangkan","paragraf":"Ayo kita semangat belajar komputer itu menyenangkan setiap hari di sekolah"}$k$::jsonb, 15),
  (5, $j$Menu Copy$j$, 'klik',
   $p$Menu konteks (klik kanan) berisi perintah seperti Copy (salin), Paste (tempel), Cut (potong), dan Undo (batalkan).$p$, null,
   $t$Dari menu konteks, klik perintah "Copy".$t$,
   $k${"pilihan":["Copy","Paste","Cut","Undo"],"jawaban":"Copy"}$k$::jsonb, 10),
  (6, $j$Memindahkan file$j$, 'kuis',
   $p$Memindahkan file ke folder paling mudah dengan drag & drop.$p$, null,
   $t$Untuk memindahkan file ke folder, gunakan…$t$,
   $k${"pertanyaan":"Untuk memindahkan file ke folder, gunakan…","pilihan":["klik ganda","drag & drop","klik kanan","scroll"],"jawaban":"drag & drop"}$k$::jsonb, 5)
) as v(level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin)
where l.judul = $j$Bagian 2 — Mouse Lanjutan (Drag & Scroll)$j$
  and not exists (
    select 1 from public.komputer_challenges c
    where c.lesson_id = l.id and c.level = v.level
  );

-- 74. SEED target kelas → kelas 7 (kalau ada).
insert into public.komputer_lesson_classes (lesson_id, kelas_id)
select l.id, c.id
from public.komputer_lessons l
join public.classes c
  on (c.nama_kelas ilike '7%' or c.nama_kelas ilike 'kelas 7%' or c.nama_kelas ilike 'vii%')
where l.judul in (
  $j$Bagian 0 — Mengenal Komputer & Kursor$j$,
  $j$Bagian 1 — Mouse Dasar (Klik)$j$,
  $j$Bagian 2 — Mouse Lanjutan (Drag & Scroll)$j$
)
on conflict do nothing;

-- ============================================================
-- Selesai Tahap 19. Tabel baru: "komputer_lessons",
-- "komputer_challenges", "komputer_hasil", "komputer_lesson_classes".
-- ============================================================

-- ============================================================
-- TAHAP 20: JENIS TANTANGAN MOUSE LANJUTAN + SKOR
-- ============================================================
-- Menambah jenis tantangan baru (pilih banyak, marquee, tahan-gerakkan,
-- urut drag, hover+klik, target bergerak, klik beruntun, slider, resize,
-- pan) dan kolom skor/waktu untuk gamifikasi.

-- 75. Perbarui daftar `jenis` yang diizinkan.
alter table public.komputer_challenges
  drop constraint if exists komputer_challenges_jenis_check;
alter table public.komputer_challenges
  add constraint komputer_challenges_jenis_check check (jenis in (
    'klik', 'klik_kanan', 'klik_ganda', 'hover', 'drag', 'scroll', 'seleksi', 'kuis',
    'pilih_banyak', 'seret_kotak', 'seret_jalur', 'drag_urut', 'hover_klik',
    'klik_bergerak', 'klik_beruntun', 'slider', 'resize', 'pan'
  ));

-- 76. Skor & waktu untuk gamifikasi.
alter table public.komputer_hasil add column if not exists skor int;
alter table public.komputer_hasil add column if not exists waktu_ms int;

-- 77. SEED Modul Bagian 3 & 4 (idempoten).
insert into public.komputer_lessons (judul, urutan, isi)
select $j$Bagian 3 — Mouse Mahir$j$, 3,
$i$Saatnya kemampuan mouse tingkat lanjut:

- Pilih beberapa item: klik beberapa item (bisa lebih dari satu).
- Sorot dengan kotak: tahan klik lalu tarik untuk menyorot beberapa item sekaligus.
- Tahan & gerakkan: tahan tombol kiri sambil menggerakkan mouse ke tujuan.
- Urutkan dengan drag, dan buka menu dengan hover lalu klik.

Latih sampai lancar!$i$
where not exists (select 1 from public.komputer_lessons where judul = $j$Bagian 3 — Mouse Mahir$j$);

insert into public.komputer_lessons (judul, urutan, isi)
select $j$Bagian 4 — Mouse Cepat & Presisi$j$, 4,
$i$Uji kecepatan dan ketepatan tanganmu:

- Kejar target bergerak dan klik beruntun.
- Geser slider, ubah ukuran, dan geser (pan) kanvas.
- Telusuri jalur dengan menahan klik.

Kuncinya: tenang, tepat, dan tidak melepas tombol saat menggerakkan.$i$
where not exists (select 1 from public.komputer_lessons where judul = $j$Bagian 4 — Mouse Cepat & Presisi$j$);

-- 78. SEED tantangan Bagian 3.
insert into public.komputer_challenges
  (lesson_id, level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin, urutan)
select l.id, v.level, v.judul, v.jenis, v.penjelasan, v.contoh, v.instruksi, v.konfigurasi, v.poin, v.level
from public.komputer_lessons l
cross join (values
  (1, $j$Klik ikon kecil$j$, 'klik',
   $p$Klik dengan tepat pada sasaran yang kecil. Jangan sampai meleset.$p$, null,
   $t$Klik ikon Pencarian (🔍).$t$,
   $k${"pilihan":["🔍","✏️","⚙️","🗑️"],"jawaban":"🔍"}$k$::jsonb, 10),
  (2, $j$Klik kanan area kosong$j$, 'klik_kanan',
   $p$Klik kanan di area kosong (mis. desktop) memunculkan menu latar.$p$, null,
   $t$Klik KANAN pada "Desktop (area kosong)".$t$,
   $k${"pilihan":["Desktop (area kosong)","Folder","File","Recycle Bin"],"jawaban":"Desktop (area kosong)"}$k$::jsonb, 10),
  (3, $j$Pilih beberapa item$j$, 'pilih_banyak',
   $p$Beberapa item bisa dipilih sekaligus. Klik untuk memilih, klik lagi untuk melepas, lalu tekan Periksa.$p$, null,
   $t$Pilih semua ALAT KOMPUTER (boleh lebih dari satu).$t$,
   $k${"pilihan":["Mouse","Keyboard","Gelas","Buku","Monitor","Sepatu"],"jawaban":["Mouse","Keyboard","Monitor"]}$k$::jsonb, 15),
  (4, $j$Sorot dengan kotak$j$, 'seret_kotak',
   $p$Untuk menyorot banyak item sekaligus, tahan klik lalu tarik kotak yang mencakup semuanya.$p$, null,
   $t$Sorot semua FILE GAMBAR dengan satu kotak.$t$,
   $k${"pilihan":["foto1.jpg","gambar2.png","poster.jpg","catatan.txt","tugas.docx","data.xlsx"],"jawaban":["foto1.jpg","gambar2.png","poster.jpg"]}$k$::jsonb, 15),
  (5, $j$Tahan & gerakkan$j$, 'seret_jalur',
   $p$Tahan tombol kiri sambil menggerakkan mouse (jangan dilepas), lalu lepas tepat di tujuan.$p$, null,
   $t$Tahan klik di "Mulai", gerakkan ke "Tujuan", lalu lepas.$t$,
   $k${"mulai":"Mulai","tujuan":"Tujuan","lewat":[]}$k$::jsonb, 10),
  (6, $j$Urutkan dengan drag$j$, 'drag_urut',
   $p$Seret item untuk mengubah urutannya, lalu Periksa.$p$, null,
   $t$Urutkan angka dari kecil ke besar.$t$,
   $k${"pilihan":["2","4","1","3"],"jawaban":["1","2","3","4"]}$k$::jsonb, 10),
  (7, $j$Hover lalu klik$j$, 'hover_klik',
   $p$Arahkan kursor (hover) ke menu untuk membukanya, lalu klik pilihan di dalamnya.$p$, null,
   $t$Hover menu "Berkas", lalu klik "Simpan".$t$,
   $k${"menu":"Berkas ▾","pilihan":["Buka","Simpan","Cetak","Tutup"],"jawaban":"Simpan"}$k$::jsonb, 10),
  (8, $j$Pilih banyak dengan keyboard$j$, 'kuis',
   $p$Untuk memilih beberapa item yang tidak berurutan, tahan Ctrl lalu klik tiap item.$p$, null,
   $t$Untuk memilih beberapa item tidak berurutan, kita menekan…$t$,
   $k${"pertanyaan":"Untuk memilih beberapa item tidak berurutan, kita menekan…","pilihan":["klik kiri","Ctrl + klik","klik ganda","scroll"],"jawaban":"Ctrl + klik"}$k$::jsonb, 5)
) as v(level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin)
where l.judul = $j$Bagian 3 — Mouse Mahir$j$
  and not exists (
    select 1 from public.komputer_challenges c
    where c.lesson_id = l.id and c.level = v.level
  );

-- 79. SEED tantangan Bagian 4.
insert into public.komputer_challenges
  (lesson_id, level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin, urutan)
select l.id, v.level, v.judul, v.jenis, v.penjelasan, v.contoh, v.instruksi, v.konfigurasi, v.poin, v.level
from public.komputer_lessons l
cross join (values
  (1, $j$Klik target bergerak$j$, 'klik_bergerak',
   $p$Latih koordinasi: kejar target yang bergerak dan klik dengan tepat.$p$, null,
   $t$Klik target yang bergerak.$t$,
   $k${"pilihan":["🎯"],"jawaban":"🎯"}$k$::jsonb, 10),
  (2, $j$Klik beruntun$j$, 'klik_beruntun',
   $p$Klik beberapa kotak secepat mungkin untuk melatih kecepatan tangan.$p$, null,
   $t$Klik semua kotak secepat mungkin.$t$,
   $k${"jumlah":4,"pilihan":["a","b","c","d"]}$k$::jsonb, 10),
  (3, $j$Geser slider$j$, 'slider',
   $p$Tahan dan geser tombol slider hingga mencapai angka yang diminta.$p$, null,
   $t$Geser slider sampai bernilai 70.$t$,
   $k${"min":0,"max":100,"target":70,"toleransi":3}$k$::jsonb, 10),
  (4, $j$Seret ke Recycle Bin$j$, 'drag',
   $p$Seret file ke Recycle Bin untuk menghapusnya.$p$, null,
   $t$Seret "File" ke "Recycle Bin".$t$,
   $k${"item":"File","tujuan":"Recycle Bin","pilihan":["Recycle Bin","Folder","Desktop","Dokumen"]}$k$::jsonb, 10),
  (5, $j$Ubah ukuran$j$, 'resize',
   $p$Tarik sudut kotak untuk mengubah ukurannya.$p$, null,
   $t$Ubah lebar kotak menjadi ± 220 px.$t$,
   $k${"ukuranTarget":220,"toleransi":12}$k$::jsonb, 10),
  (6, $j$Telusuri jalur$j$, 'seret_jalur',
   $p$Tahan klik dan ikuti jalur berbelok tanpa melepas tombol.$p$, null,
   $t$Tahan klik di "Mulai", lewati titik 1 & 2, lalu lepas di "Tujuan".$t$,
   $k${"mulai":"Mulai","tujuan":"Tujuan","lewat":["Langkah 1","Langkah 2"]}$k$::jsonb, 15),
  (7, $j$Geser kanvas (pan)$j$, 'pan',
   $p$Tahan klik lalu geser (pan) untuk berpindah tampilan.$p$, null,
   $t$Geser ke kanan sampai target terlihat.$t$,
   $k${"tujuan":"Target"}$k$::jsonb, 10),
  (8, $j$Hover presisi$j$, 'hover',
   $p$Arahkan kursor dengan mantap pada sasaran kecil dan tahan sebentar.$p$, null,
   $t$Arahkan kursor ke "Keluar" dan tahan 2 detik.$t$,
   $k${"pilihan":["Mulai","Keluar","Simpan","Ulang"],"jawaban":"Keluar","tahanMs":2000}$k$::jsonb, 10)
) as v(level, judul, jenis, penjelasan, contoh, instruksi, konfigurasi, poin)
where l.judul = $j$Bagian 4 — Mouse Cepat & Presisi$j$
  and not exists (
    select 1 from public.komputer_challenges c
    where c.lesson_id = l.id and c.level = v.level
  );

-- 80. SEED target kelas → kelas 7 untuk Bagian 3 & 4.
insert into public.komputer_lesson_classes (lesson_id, kelas_id)
select l.id, c.id
from public.komputer_lessons l
join public.classes c
  on (c.nama_kelas ilike '7%' or c.nama_kelas ilike 'kelas 7%' or c.nama_kelas ilike 'vii%')
where l.judul in (
  $j$Bagian 3 — Mouse Mahir$j$,
  $j$Bagian 4 — Mouse Cepat & Presisi$j$
)
on conflict do nothing;

-- ============================================================
-- Selesai Tahap 20. Jenis tantangan bertambah + kolom skor/waktu.
-- ============================================================

-- ============================================================
-- TAHAP 21: RESET KEGIATAN SISWA OLEH GURU
-- ============================================================
-- Guru bisa menghapus pengerjaan siswa (tugas, ulangan, lab coding,
-- lab komputer) supaya siswa mengerjakan dari awal. Policy delete
-- untuk exam_submissions & exam_answers belum ada, dan exam_probes
-- baru punya select — jadi ketiganya perlu ditambah di sini.
-- Tabel lain (assignment_submissions, coding_submissions,
-- komputer_hasil, exam_scores, exam_essay_scores) sudah punya
-- policy delete / for all untuk authenticated.

drop policy if exists "Guru bisa menghapus submit" on public.exam_submissions;
create policy "Guru bisa menghapus submit"
  on public.exam_submissions for delete
  to authenticated using (true);

drop policy if exists "Guru bisa menghapus jawaban" on public.exam_answers;
create policy "Guru bisa menghapus jawaban"
  on public.exam_answers for delete
  to authenticated using (true);

drop policy if exists "Guru bisa hapus probe" on public.exam_probes;
create policy "Guru bisa hapus probe"
  on public.exam_probes for delete
  to authenticated using (true);

grant delete on table public.exam_probes to authenticated;

-- ============================================================
-- Selesai Tahap 21. Guru bisa mereset kegiatan siswa.
-- ============================================================

-- ============================================================
-- TAHAP 22: GURU BISA MENUTUP FORM TUGAS
-- ============================================================
-- Kolom `dibuka` di assignments:
--   true  = tugas terbuka, siswa bisa mengumpulkan (default)
--   false = ditutup guru, siswa tidak bisa mengumpulkan/memperbarui
--           walau tenggat belum lewat.
-- Policy update `for all to authenticated` sudah ada, jadi tidak perlu
-- policy baru.
alter table public.assignments
  add column if not exists dibuka boolean not null default true;

-- ============================================================
-- Selesai Tahap 22. Kolom baru: "assignments.dibuka".
-- ============================================================

-- ============================================================
-- TAHAP 23: BATASI AKSES LANGSUNG KE AKUN SISWA
-- ============================================================
-- Operasi student_accounts dilakukan oleh server menggunakan
-- SUPABASE_SERVICE_ROLE_KEY setelah validasi sesi/aplikasi.
-- Jangan berikan akses service-role key ke browser.

revoke all privileges on table public.student_accounts from anon, authenticated, public;

drop policy if exists "Anon bisa baca akun siswa" on public.student_accounts;
drop policy if exists "Anon bisa ubah password akun siswa" on public.student_accounts;
drop policy if exists "Guru bisa membaca akun siswa" on public.student_accounts;
drop policy if exists "Guru bisa menambah akun siswa" on public.student_accounts;
drop policy if exists "Guru bisa mengubah akun siswa" on public.student_accounts;
drop policy if exists "Guru bisa menghapus akun siswa" on public.student_accounts;

-- service_role adalah kunci server-only yang dipakai aplikasi (createAdminClient).
-- Role ini tidak memakai policy RLS, tetapi tetap butuh GRANT pada tabel yang
-- diakses. `students` diperlukan karena query akun menyertakan relasi students(*).
grant all privileges on table public.student_accounts to service_role;
grant select on table public.students to service_role;

-- ============================================================
-- Selesai Tahap 23. Akses langsung anon/authenticated dicabut dari
-- student_accounts; aplikasi mengaksesnya via service_role di server.
-- ============================================================

-- ============================================================
-- TAHAP 24: BATASI HASIL LAB KE SERVER
-- ============================================================
-- Hasil lab (coding_submissions) hanya dibaca/ditulis oleh server
-- (Server Component + Server Action) memakai service-role. Siswa tidak
-- lagi memakai kunci anon langsung untuk tabel ini, sehingga tidak bisa
-- membaca/mengubah hasil milik siswa lain.

revoke all privileges on table public.coding_submissions from anon, public;

drop policy if exists "Anon baca hasil lab" on public.coding_submissions;
drop policy if exists "Anon kirim hasil lab" on public.coding_submissions;
drop policy if exists "Anon ubah hasil lab" on public.coding_submissions;

grant all privileges on table public.coding_submissions to service_role;

-- ============================================================
-- Selesai Tahap 24. Akses anon ke coding_submissions dicabut.
-- ============================================================

-- ============================================================
-- TAHAP 25: MODUL PERTEMUAN 2 — VARIABEL + print()
-- ============================================================
-- Modul praktik Python untuk kelas 9: 15 tantangan berurutan yang hanya
-- memakai variabel dan print(). Tantangan 1-14 dinilai dengan mencocokkan
-- output; tantangan 15 (karya bebas) dinilai berdasarkan syarat kode.
-- Kolom `jenis` membedakan keduanya; `aturan` menyimpan syarat karya bebas.

-- 81. Kolom jenis/aturan untuk latihan coding (idempoten).
alter table public.coding_exercises
  add column if not exists jenis text not null default 'output';
alter table public.coding_exercises
  add column if not exists aturan jsonb;

-- 82. SEED modul "Pertemuan 2" (idempoten).
insert into public.coding_lessons (judul, urutan, isi)
select
  $j$Pertemuan 2 — Variabel + print()$j$,
  2,
  $i$BANTUAN MATERI — VARIABEL & print()

Apa itu variabel?
Variabel adalah wadah untuk menyimpan data. Setiap variabel punya nama.
Contoh membuat variabel berisi teks:
  nama_variabel = "isi teks"

Apa itu print()?
print() menampilkan sesuatu ke layar. Bisa teks langsung, bisa isi variabel.
Contoh:
  print("Halo")   → menampilkan: Halo

Teks dan angka
- Teks (string) harus diapit tanda kutip: "Python"
- Angka tidak perlu tanda kutip: 2026

Memakai variabel
- Setelah dibuat, variabel bisa dipakai berkali-kali di dalam print().
- Isi variabel bisa diganti dengan membuatnya lagi memakai nilai baru.
- Urutan print() menentukan urutan output.

Tips:
1. Tulis satu perintah per baris.
2. Bandingkan hasilmu dengan target output dengan teliti.
3. Selesaikan tantangan secara berurutan; tantangan berikutnya terbuka setelah yang sekarang benar.$i$
where not exists (
  select 1 from public.coding_lessons where judul = $j$Pertemuan 2 — Variabel + print()$j$
);

-- 83. SEED 15 tantangan Pertemuan 2 (hanya disisipkan kalau belum ada).
insert into public.coding_exercises
  (lesson_id, level, judul, penjelasan, contoh_kode, instruksi, kode_awal, keluaran_diharapkan, poin, urutan, jenis, aturan)
select
  l.id, v.level, v.judul, v.penjelasan, null::text, v.instruksi, null::text,
  v.keluaran_diharapkan, v.poin, v.level, v.jenis, v.aturan
from public.coding_lessons l
cross join (values
  (1,
   $j$Variabel Pertama$j$,
   $p$Variabel menyimpan data. Teks ditulis di antara tanda kutip, misalnya "Python". print() menampilkan isi variabel ke layar.$p$,
   $t$1. Buat variabel bernama bahasa yang berisi teks Python.
2. Tampilkan isi variabel itu dengan print().$t$,
   $o$Python$o$, 5, 'output', null::jsonb),
  (2,
   $j$Pelajaran$j$,
   $p$Setiap variabel punya nama sendiri. Nama variabel tidak boleh berspasi; gunakan huruf, angka, atau garis bawah.$p$,
   $t$1. Buat variabel bernama pelajaran yang berisi teks Informatika.
2. Tampilkan isi variabel itu dengan print().$t$,
   $o$Informatika$o$, 5, 'output', null::jsonb),
  (3,
   $j$Dua Variabel$j$,
   $p$Kamu bisa membuat lebih dari satu variabel. Urutan print() menentukan urutan tampilannya.$p$,
   $t$1. Buat variabel bahasa berisi "Python".
2. Buat variabel kelas berisi "IX".
3. Tampilkan isi kedua variabel secara berurutan (bahasa dulu, lalu kelas).$t$,
   $o$Python
IX$o$, 5, 'output', null::jsonb),
  (4,
   $j$Tiga Data$j$,
   $p$Semakin banyak data, semakin banyak variabel. Pastikan setiap variabel ditampilkan dengan print().$p$,
   $t$1. Buat variabel pelajaran berisi "Informatika".
2. Buat variabel materi berisi "Variabel".
3. Buat variabel kelas berisi "IX".
4. Tampilkan ketiganya secara berurutan.$t$,
   $o$Informatika
Variabel
IX$o$, 5, 'output', null::jsonb),
  (5,
   $j$Variabel Angka$j$,
   $p$Angka tidak memakai tanda kutip. Kalau diberi tanda kutip, angkanya dianggap teks.$p$,
   $t$1. Buat variabel bernama tahun dengan nilai angka 2026.
2. Tampilkan nilainya dengan print().$t$,
   $o$2026$o$, 5, 'output', null::jsonb),
  (6,
   $j$Teks dan Angka$j$,
   $p$Teks memakai tanda kutip, angka tidak. Keduanya bisa ditampilkan dengan print().$p$,
   $t$1. Buat variabel bahasa berisi teks "Python".
2. Buat variabel pertemuan berisi angka 2.
3. Tampilkan keduanya (bahasa dulu, lalu pertemuan).$t$,
   $o$Python
2$o$, 5, 'output', null::jsonb),
  (7,
   $j$Judul Program$j$,
   $p$Kamu bisa mencetak teks langsung (misalnya garis) tanpa variabel, lalu menggabungkannya dengan isi variabel.$p$,
   $t$1. Buat variabel judul berisi "BELAJAR PYTHON".
2. Buat variabel materi berisi "VARIABEL".
3. Buat tampilan persis seperti target: garis, judul, materi, garis.$t$,
   $o$====================
BELAJAR PYTHON
VARIABEL
====================$o$, 10, 'output', null::jsonb),
  (8,
   $j$Informasi Teknologi$j$,
   $p$Gunakan beberapa variabel dan teks langsung untuk membuat tampilan yang rapi.$p$,
   $t$1. Buat variabel perangkat berisi "Komputer".
2. Buat variabel sistem berisi "Windows".
3. Buat variabel bahasa berisi "Python".
4. Buat tampilan persis seperti target (judul, garis, lalu isi).$t$,
   $o$PERANGKAT TEKNOLOGI
--------------------
Komputer
Windows
Python
--------------------$o$, 10, 'output', null::jsonb),
  (9,
   $j$Data Game$j$,
   $p$Campurkan teks dan angka dalam satu tampilan. Ikuti urutan baris pada target.$p$,
   $t$1. Buat variabel nama_game berisi "Minecraft".
2. Buat variabel jenis berisi "Sandbox".
3. Buat variabel tahun berisi angka 2011.
4. Buat tampilan persis seperti target.$t$,
   $o$====================
DATA GAME
====================
Minecraft
Sandbox
2011
====================$o$, 10, 'output', null::jsonb),
  (10,
   $j$Label dan Variabel$j$,
   $p$Label adalah teks biasa di dalam print(). Bedakan antara menulis label dan menampilkan isi variabel.$p$,
   $t$1. Buat variabel nama_barang berisi "Keyboard".
2. Buat variabel jenis berisi "Perangkat Input".
3. Buat variabel jumlah berisi angka 25.
4. Tampilkan setiap label lalu nilainya, persis seperti target.$t$,
   $o$Nama Barang:
Keyboard
Jenis:
Perangkat Input
Jumlah:
25$o$, 10, 'output', null::jsonb),
  (11,
   $j$Data Komputer$j$,
   $p$Gabungkan judul, garis, label, dan isi variabel menjadi satu tampilan spesifikasi.$p$,
   $t$1. Buat variabel cpu berisi "Intel Core i5".
2. Buat variabel ram berisi "8 GB".
3. Buat variabel penyimpanan berisi "512 GB".
4. Buat tampilan persis seperti target.$t$,
   $o$========================
SPESIFIKASI KOMPUTER
========================
CPU
Intel Core i5
RAM
8 GB
Penyimpanan
512 GB
========================$o$, 10, 'output', null::jsonb),
  (12,
   $j$Mengubah Isi Variabel$j$,
   $p$Isi variabel bisa diganti. Buat variabel dengan nama sama dan nilai baru, lalu tampilkan lagi.$p$,
   $t$1. Buat variabel status berisi "Belum Selesai", lalu tampilkan.
2. Ubah isi variabel status menjadi "Selesai", lalu tampilkan kembali.$t$,
   $o$Belum Selesai
Selesai$o$, 15, 'output', null::jsonb),
  (13,
   $j$Variabel Digunakan Berulang$j$,
   $p$Satu variabel bisa dipakai berkali-kali. Cukup panggil print() beberapa kali dengan variabel yang sama.$p$,
   $t$1. Buat satu variabel bernama kata berisi "Python".
2. Tampilkan kata Python sebanyak 5 kali (5 baris) memakai variabel itu.
3. Jangan memakai perulangan (loop belum dipelajari).$t$,
   $o$Python
Python
Python
Python
Python$o$, 15, 'output', null::jsonb),
  (14,
   $j$Kartu Teknologi$j$,
   $p$Susun beberapa variabel menjadi satu kartu. Perhatikan spasi di depan judul agar sama dengan target.$p$,
   $t$1. Buat variabel judul berisi "TEKNOLOGI MASA DEPAN" (beri spasi di depan agar tampil ke tengah).
2. Buat variabel teknologi1 berisi "Robot".
3. Buat variabel teknologi2 berisi "Artificial Intelligence".
4. Buat variabel teknologi3 berisi "Internet".
5. Buat tampilan persis seperti target.$t$,
   $o$################################
      TEKNOLOGI MASA DEPAN
################################
Robot
Artificial Intelligence
Internet
################################$o$, 15, 'output', null::jsonb),
  (15,
   $j$Karya Variabel Bebas$j$,
   $p$Ini tantangan terakhir. Buat program bebas memakai variabel dan print(). Tidak ada satu jawaban yang sama untuk semua orang — yang penting semua syarat terpenuhi.$p$,
   $t$Buat satu program bebas dengan syarat:
- minimal 5 variabel
- minimal 4 variabel berisi teks
- minimal 1 variabel berisi angka
- minimal 10 perintah print()
- semua variabel yang dibuat harus ditampilkan
- punya judul, isi, dan garis/bingkai sederhana
- output minimal 7 baris

Tema bebas: komputer, game, sekolah, teknologi, robot, olahraga, lingkungan, atau cita-cita.$t$,
   $o$$o$, 25, 'bebas', $a${"min_variabel": 5, "min_teks": 4, "min_angka": 1, "min_print": 10, "min_baris": 7}$a$::jsonb)
) as v(level, judul, penjelasan, instruksi, keluaran_diharapkan, poin, jenis, aturan)
where l.judul = $j$Pertemuan 2 — Variabel + print()$j$
  and not exists (
    select 1 from public.coding_exercises e
    where e.lesson_id = l.id and e.level = v.level
  );

-- 84. SEED target kelas Pertemuan 2 → kelas 9 (kalau ada).
insert into public.coding_lesson_classes (lesson_id, kelas_id)
select l.id, c.id
from public.coding_lessons l
join public.classes c
  on (c.nama_kelas ilike '9%' or c.nama_kelas ilike 'kelas 9%' or c.nama_kelas ilike 'ix%')
where l.judul = $j$Pertemuan 2 — Variabel + print()$j$
on conflict do nothing;

-- ============================================================
-- Selesai Tahap 25. Modul baru: "Pertemuan 2 — Variabel + print()"
-- dengan 15 tantangan berurutan.
-- ============================================================

-- ============================================================
-- TAHAP 26: KOREKSI VARIABEL WAJIB (PERTEMUAN 2)
-- ============================================================
-- Selain output harus cocok, tantangan 1-14 juga mengharuskan siswa
-- benar-benar membuat dan memakai variabel dengan nama tertentu
-- (mis. "bahasa", "pelajaran"). Daftar nama disimpan di kolom
-- `aturan` -> {"variabel_wajib": [...]}. Pengecekan memakai analisis
-- AST dari worker Pyodide, divalidasi di server.

update public.coding_exercises as e
set aturan = coalesce(e.aturan, '{}'::jsonb) || jsonb_build_object('variabel_wajib', v.wajib)
from (values
  (1, '["bahasa"]'::jsonb),
  (2, '["pelajaran"]'::jsonb),
  (3, '["bahasa", "kelas"]'::jsonb),
  (4, '["pelajaran", "materi", "kelas"]'::jsonb),
  (5, '["tahun"]'::jsonb),
  (6, '["bahasa", "pertemuan"]'::jsonb),
  (7, '["judul", "materi"]'::jsonb),
  (8, '["perangkat", "sistem", "bahasa"]'::jsonb),
  (9, '["nama_game", "jenis", "tahun"]'::jsonb),
  (10, '["nama_barang", "jenis", "jumlah"]'::jsonb),
  (11, '["cpu", "ram", "penyimpanan"]'::jsonb),
  (12, '["status"]'::jsonb),
  (13, '["kata"]'::jsonb),
  (14, '["judul", "teknologi1", "teknologi2", "teknologi3"]'::jsonb)
) as v(level, wajib)
where e.level = v.level
  and e.lesson_id = (
    select id from public.coding_lessons where judul = $j$Pertemuan 2 — Variabel + print()$j$
  );

-- ============================================================
-- Selesai Tahap 26. Tantangan 1-14 kini juga memeriksa variabel wajib.
-- ============================================================

-- ============================================================
-- TAHAP 27: GANTI MODUL 1 MENJADI "Mencetak dengan print()"
-- ============================================================
-- Modul 1 lama ("Mencetak & Variabel") diganti total dengan 15 tantangan
-- yang HANYA memakai print(). Tidak ada variabel, input(), if, perulangan,
-- list, atau fungsi lain. Tingkat kesulitan naik bertahap; level 15 adalah
-- "FINAL BOSS" dengan badge PRINT MASTER.
--
-- Semua bersifat idempoten: aman dijalankan berulang kali.

-- 85. Ganti judul + materi modul 1.
update public.coding_lessons
set judul = $j$Modul 1 — Mencetak dengan print()$j$,
    isi = $i$Selamat datang di Lab Coding Python!

Di modul ini kamu hanya belajar satu hal yang sangat penting: perintah print().

Apa itu print()?
print() menampilkan sesuatu ke layar. Setiap print() menghasilkan SATU baris baru.
  print("Halo")      → menampilkan: Halo
  print(100)         → menampilkan: 100

Teks dan angka
- Teks (string) harus diapit tanda kutip: "Halo" atau 'Halo'
- Angka tidak perlu tanda kutip: 100, 2026

Beberapa baris
- Untuk menampilkan banyak baris, tulis beberapa print().
  print("Baris 1")
  print("Baris 2")

Simbol
- print() juga bisa menampilkan simbol apa pun: *, =, -, dan lain-lain.

Tips:
1. Tulis satu perintah print() per baris.
2. Perhatikan huruf besar/kecil, tanda baca, spasi, dan panjang garis.
3. Selesaikan tantangan secara berurutan; tantangan berikutnya terbuka setelah yang sekarang benar.
4. Tantangan 15 adalah FINAL BOSS. Kalau semua benar, kamu mendapat badge PRINT MASTER!$i$
where judul = $j$Modul 1 — Mencetak & Variabel$j$;

-- 86. Reset progres modul 1 (isi tantangan berubah total).
delete from public.coding_submissions
where exercise_id in (
  select e.id
  from public.coding_exercises e
  join public.coding_lessons l on l.id = e.lesson_id
  where l.judul = $j$Modul 1 — Mencetak dengan print()$j$
);

-- 87. Ganti 15 latihan modul 1 (upsert per level).
--     Kolom: judul, penjelasan, contoh_kode, instruksi, keluaran_diharapkan,
--            poin (XP), jenis, aturan.
insert into public.coding_exercises
  (lesson_id, level, judul, penjelasan, contoh_kode, instruksi, kode_awal,
   keluaran_diharapkan, poin, urutan, jenis, aturan)
select
  l.id, v.level, v.judul, v.penjelasan, v.contoh_kode, v.instruksi, null::text,
  v.keluaran_diharapkan, v.poin, v.level, 'output', v.aturan
from public.coding_lessons l
cross join (values
  (1,
   $j$Halo Python$j$,
   $p$print() adalah perintah untuk menampilkan sesuatu ke layar. Teks harus diapit tanda kutip, misalnya "Halo".$p$,
   $c$print("Selamat datang")$c$,
   $t$Buat satu print() yang menampilkan tepat: Halo Python!$t$,
   $o$Halo Python!$o$, 100, null::jsonb),
  (2,
   $j$Salam Pagi$j$,
   $p$Tanda seru (!) ikut ditampilkan. Pastikan berada di dalam tanda kutip.$p$,
   $c$print("Selamat sore!")$c$,
   $t$Tampilkan tepat: Selamat pagi!$t$,
   $o$Selamat pagi!$o$, 100, null::jsonb),
  (3,
   $j$Perkenalan$j$,
   $p$Kalimat boleh berisi spasi. Semua kalimat ditulis di dalam tanda kutip.$p$,
   $c$print("Nama saya Siti")$c$,
   $t$Tampilkan tepat: Nama saya Budi$t$,
   $o$Nama saya Budi$o$, 100, null::jsonb),
  (4,
   $j$Belajar Python$j$,
   $p$Python membedakan huruf besar dan kecil. Contoh: "Python" berbeda dengan "python".$p$,
   $c$print("Saya sedang belajar coding")$c$,
   $t$Tampilkan tepat: Saya sedang belajar Python$t$,
   $o$Saya sedang belajar Python$o$, 100, null::jsonb),
  (5,
   $j$Pesan Semangat$j$,
   $p$Kalimat boleh lebih panjang. Tetap perhatikan huruf besar/kecil dan tanda seru.$p$,
   $c$print("Ayo semangat belajar!")$c$,
   $t$Tampilkan tepat: Saya pasti bisa belajar coding!$t$,
   $o$Saya pasti bisa belajar coding!$o$, 100, null::jsonb),
  (6,
   $j$Dua Baris$j$,
   $p$Setiap print() menghasilkan satu baris baru. Dua baris berarti butuh dua print().$p$,
   $c$print("Baris pertama")
print("Baris kedua")$c$,
   $t$Buat dua baris dengan dua print(). Baris 1: Halo!  Baris 2: Selamat belajar Python$t$,
   $o$Halo!
Selamat belajar Python$o$, 100, null::jsonb),
  (7,
   $j$Tiga Baris$j$,
   $p$Urutan print() menentukan urutan baris pada output. Tulis dengan urutan yang benar.$p$,
   $c$print("Nama: Siti")
print("Kelas: 8A")
print("Sekolah: SMA")$c$,
   $t$Buat tiga baris dengan tiga print(): Nama: Budi, lalu Kelas: 7A, lalu Sekolah: SMP$t$,
   $o$Nama: Budi
Kelas: 7A
Sekolah: SMP$o$, 100, null::jsonb),
  (8,
   $j$Cetak Angka$j$,
   $p$print() juga bisa menampilkan angka. Angka ditulis TANPA tanda kutip.$p$,
   $c$print(50)$c$,
   $t$Tampilkan angka tepat: 100$t$,
   $o$100$o$, 100, null::jsonb),
  (9,
   $j$Tahun Sekarang$j$,
   $p$Angka tidak perlu tanda kutip. Kalau diberi tanda kutip, angkanya tetap tampil sama tetapi itu dianggap teks.$p$,
   $c$print(2025)$c$,
   $t$Tampilkan angka tepat: 2026$t$,
   $o$2026$o$, 100, null::jsonb),
  (10,
   $j$Teks dan Angka$j$,
   $p$Pada tahap ini, kalimat yang memuat angka boleh ditulis seluruhnya sebagai satu teks di dalam tanda kutip.$p$,
   $c$print("Umur saya 12 tahun")$c$,
   $t$Tampilkan tepat: Umur saya 13 tahun$t$,
   $o$Umur saya 13 tahun$o$, 100, null::jsonb),
  (11,
   $j$Biodata Mini$j$,
   $p$Tanda titik dua (:) ikut ditampilkan apa adanya. Perhatikan spasi setelah titik dua.$p$,
   $c$print("Nama: Rina")
print("Kelas: 8C")
print("Hobi: Menyanyi")$c$,
   $t$Buat tiga baris: Nama: Andi, lalu Kelas: 7B, lalu Hobi: Membaca$t$,
   $o$Nama: Andi
Kelas: 7B
Hobi: Membaca$o$, 100, null::jsonb),
  (12,
   $j$Jadwal Pelajaran$j$,
   $p$Gabungkan teks dan angka dalam beberapa baris. Titik pada jam juga ikut ditampilkan.$p$,
   $c$print("Hari: Selasa")
print("Pelajaran: Matematika")
print("Jam: 07.00")$c$,
   $t$Buat tiga baris: Hari: Senin, lalu Pelajaran: KKA, lalu Jam: 08.00$t$,
   $o$Hari: Senin
Pelajaran: KKA
Jam: 08.00$o$, 100, null::jsonb),
  (13,
   $j$Kotak Pesan$j$,
   $p$print() bisa menampilkan simbol apa pun, termasuk tanda bintang (*). Hitung panjang garisnya dengan teliti.$p$,
   $c$print("========")
print("HALO SEMUA")
print("========")$c$,
   $t$Buat tiga baris: 15 tanda bintang, lalu SELAMAT DATANG, lalu 15 tanda bintang$t$,
   $o$***************
SELAMAT DATANG
***************$o$, 150, null::jsonb),
  (14,
   $j$Mini Poster$j$,
   $p$Poster menggabungkan teks dan simbol. Untuk baris tertentu, tandanya berbeda dan lebih panjang. Perhatikan panjang setiap baris.$p$,
   $c$print("=== POSTER 8A ===")
print("Belajar Bersama")
print("Belajar Seru")
print("==================")$c$,
   $t$Buat output tepat 4 baris:
1) === KKA KELAS 7 ===
2) Belajar Python
3) Belajar Coding
4) ===================$t$,
   $o$=== KKA KELAS 7 ===
Belajar Python
Belajar Coding
===================$o$, 200, null::jsonb),
  (15,
   $j$FINAL BOSS: PRINT MASTER$j$,
   $p$Ini tantangan terakhir. Gabungkan semua yang sudah kamu pelajari: teks, simbol, beberapa baris, huruf besar/kecil, dan SPASI. Baris "     PYTHON LAB" memiliki 5 spasi di depan agar tampak ke tengah. Perhatikan setiap karakter dengan teliti.$p$,
   $c$print("====================")
print("   LATIHAN HEBAT")
print("====================")
print("Saya suka coding")
print("Saya suka belajar")
print("Coding itu seru!")
print("====================")$c$,
   $t$Buat output tepat 6 baris persis seperti target. Baris ketiga diawali 5 spasi sebelum PYTHON LAB. Baris terakhir memakai tanda seru.

Target:
====================
     PYTHON LAB
====================
Saya belajar Python
Saya belajar coding
Coding itu menyenangkan!
====================$t$,
   $o$====================
     PYTHON LAB
====================
Saya belajar Python
Saya belajar coding
Coding itu menyenangkan!
====================$o$, 300, $a${"final_boss": true, "badge": "PRINT MASTER"}$a$::jsonb)
) as v(level, judul, penjelasan, contoh_kode, instruksi, keluaran_diharapkan, poin, aturan)
where l.judul = $j$Modul 1 — Mencetak dengan print()$j$
on conflict (lesson_id, level) do update set
  judul = excluded.judul,
  penjelasan = excluded.penjelasan,
  contoh_kode = excluded.contoh_kode,
  instruksi = excluded.instruksi,
  kode_awal = excluded.kode_awal,
  keluaran_diharapkan = excluded.keluaran_diharapkan,
  poin = excluded.poin,
  urutan = excluded.urutan,
  jenis = excluded.jenis,
  aturan = excluded.aturan;

-- 88. Pastikan modul 1 tetap dipetakan ke kelas 9 (kalau ada).
insert into public.coding_lesson_classes (lesson_id, kelas_id)
select l.id, c.id
from public.coding_lessons l
join public.classes c
  on (c.nama_kelas ilike '9%' or c.nama_kelas ilike 'kelas 9%' or c.nama_kelas ilike 'ix%')
where l.judul = $j$Modul 1 — Mencetak dengan print()$j$
on conflict do nothing;

-- ============================================================
-- Selesai Tahap 27. Modul 1 kini fokus pada print() dengan 15 tantangan,
-- level 15 adalah FINAL BOSS dengan badge PRINT MASTER.
-- ============================================================

-- ============================================================
-- TAHAP 28: LOGIN SISWA DENGAN TOKEN KELAS
-- ============================================================
-- Guru membuat SATU token per kelas. Siswa memilih kelas → memilih
-- namanya → memasukkan token untuk login (tanpa username/password).
-- Token bisa diganti kapan saja (berputar); token lama langsung tidak
-- berlaku. Login username+password lama tetap tersedia.
--
-- Catatan keamanan:
--  - Token hanya dibandingkan di SERVER (Server Action) memakai
--    service-role, jadi token tidak pernah bocor ke browser siswa.
--  - Tabel class_tokens TIDAK diakses anon/authenticated langsung
--    (revoke), sama seperti pola student_accounts (Tahap 23).

-- 89. Tabel token per kelas (1 kelas = 1 token).
create table if not exists public.class_tokens (
  id uuid primary key default gen_random_uuid(),
  kelas_id uuid not null unique references public.classes(id) on delete cascade,
  token text not null,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);

create index if not exists idx_class_tokens_kelas
  on public.class_tokens (kelas_id);

-- 90. Aktifkan RLS.
alter table public.class_tokens enable row level security;

-- 91. Cabut akses langsung anon/authenticated. Token hanya dibaca
--     guru lewat server (createAdminClient / service_role).
revoke all privileges on table public.class_tokens from anon, authenticated, public;

grant all privileges on table public.class_tokens to service_role;
-- Relasi kelas dibaca saat menyusun daftar kelas di halaman login siswa.
grant select on table public.classes to service_role;
grant select on table public.students to service_role;

-- ============================================================
-- Selesai Tahap 28. Tabel baru: "class_tokens".
-- ============================================================
