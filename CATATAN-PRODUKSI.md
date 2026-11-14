# Catatan Produksi (Vercel)

Catatan operasional untuk mengelola portal ini setelah online. Simpan file ini
di repo agar mudah dibuka lagi.

## Alur

```
GitHub (ifauzan9/portal-belajar)  →  Vercel (otomatis deploy)  →  Supabase (database + storage)
```

- **GitHub** — tempat kode. Push ke branch `main` memicu deploy otomatis.
- **Vercel** — menjalankan aplikasi Next.js (login, Server Actions, dsb).
- **Supabase** — database Postgres + penyimpanan berkas tugas.

## Environment Variables

Set di **Vercel → Project → Settings → Environment Variables** (scope Production).

| Nama | Wajib? | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Ya | URL project Supabase. Tanpa ini aplikasi tidak bisa konek DB. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ya | Kunci anon Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | Kunci server-only untuk operasi tabel akun siswa. Ambil dari Supabase Project Settings → API Keys; jangan gunakan awalan `NEXT_PUBLIC_` atau kirim ke browser. |
| `SISWA_SESSION_SECRET` | Ya | Kunci HMAC acak minimal 32 karakter untuk cookie sesi siswa. Aplikasi gagal memproses sesi jika tidak diisi atau terlalu pendek; jangan gunakan nilai yang tersimpan di repo. |
| `MAINTENANCE_MODE` | Opsional | `1` = tampilkan halaman maintenance. Kosong/`0` = normal. Lihat bagian di bawah. |

Catatan:
- Perubahan env var **baru berlaku setelah Redeploy**.
- Mengubah `SISWA_SESSION_SECRET` akan membuat semua sesi siswa yang sedang login menjadi logout (siswa cukup login ulang).
- Isi `SUPABASE_SERVICE_ROLE_KEY` dan `SISWA_SESSION_SECRET` di environment Preview/Production sebelum redeploy. Migration Tahap 23 mencabut akses `anon` ke `student_accounts`; operasi akun aplikasi memerlukan service-role key di server.
- Nilai lokal ada di `.env.local` (tidak ikut ke GitHub, memang sengaja).

## Deploy

- **Otomatis:** `git push` ke `main` → Vercel build & deploy sendiri.
- **Manual:** Vercel → **Deployments** → titik tiga pada deploy terakhir → **Redeploy**.
- **Cek error build:** Vercel → **Deployments** → klik deploy → tab **Building/Logs**.
- Pastikan `npm run build` sukses di lokal sebelum push.

## Mode Maintenance

Menutup sementara seluruh portal dan menampilkan halaman "Sedang Maintenance".

**Menyalakan:**
1. Settings → Environment Variables → tambah/ubah `MAINTENANCE_MODE` = `1`.
2. Deployments → titik tiga deploy terakhir → **Redeploy**.

**Mematikan:** ubah `MAINTENANCE_MODE` menjadi `0`, lalu **Redeploy**.

Saat aktif, semua halaman di-rewrite ke `/maintenance` oleh `src/proxy.ts`
(URL di browser tidak berubah). Aset statis dan halaman maintenance sendiri
tetap bisa diakses.

> Di Next.js 16, file `middleware.ts` sudah diganti nama menjadi `proxy.ts`.

## Update Database

Perubahan skema ada di root: `schema.sql` (satu file, per tahap bernomor).

1. Buka file `schema.sql`, salin bagian terbaru (atau seluruhnya).
2. **Supabase → SQL Editor → New query** → tempel → **Run**.

Migrasi ditulis idempoten (`add column if not exists`, `drop constraint if
exists`, seed `where not exists`), jadi aman dijalankan berulang.

Hal yang disiapkan di database:
- Bucket Storage bernama **`tugas`** untuk berkas tugas (dibuat di Tahap 16).
- Tabel **`pengaturan_guru`** (Tahap 41) untuk saklar global "Tutup akses soal"
  di halaman **/guru/pengaturan**. Tanpa tabel ini, halaman pengaturan tetap
  tampil tetapi menyimpan akan gagal dan akses soal tetap terbuka.
- Kolom **`coding_lessons.dibuka`** (Tahap 42) untuk tombol **Tutup modul** /
  **Buka modul** per modul di halaman **/guru/lab**. Tanpa kolom ini, tombol
  tidak muncul dan semua modul dianggap terbuka.
- Kolom **`pengaturan_guru.token_login_dibuka`** (Tahap 43) untuk saklar
  **Tutup/Buka login token** siswa di halaman **/guru/kelas**.
- Kolom **`pengaturan_guru.token_login_mode`** (Tahap 45) untuk memilih cara
  mengelola login token: **Otomatis** (terbuka sampai jam tutup lalu tertutup
  sendiri setiap hari, default) atau **Manual** (guru yang membuka/menutup lewat
  saklar, tanpa batas jam). Saklar `token_login_dibuka` tetap berfungsi sebagai
  tombol matikan total di kedua mode.
- Kolom **`pengaturan_guru.token_login_tutup_waktu`** (Tahap 46) untuk mengatur
  jam tutup otomatis (format `HH:MM` WIB, bawaan `18:00`). Hanya dipakai di mode
  otomatis; bisa diubah dari kartu **Login Token Siswa** di **/guru/kelas**.
- Kolom **`pengaturan_guru.info_login_siswa`** &
  **`info_login_siswa_aktif`** (Tahap 44) untuk **Informasi di halaman login
  siswa** yang diatur dari **/guru/pengaturan**.
- Kolom **`exams.bagikan_nilai`** (Tahap 48) untuk saklar **Bagikan nilai /
  Tarik nilai** per ulangan. Default `false`: nilai disembunyikan sampai guru
  membagikannya. Terpisah dari `dibuka` (tutup/buka akses soal).
- **Skala nilai 0–100** (Tahap 50). Nilai 75 ke atas **tidak remedial**,
  di bawah 75 **remedial**. Nilai kode manual, poin soal, komponen nilai, dan
  total nilai dibatasi 0–100 di aplikasi; constraint database juga
  dikembalikan ke 0–100. Tahap 50 menggantikan batas longgar Tahap 49.
- **Soal kode ulangan** (Tahap 51). Ulangan **Ulangan Praktik Akhir Semester**
  memakai tantangan **Membuat Kartu Peserta Kegiatan Literasi**: tepat 3 input
  (`nama`, `kelas`, `judul_buku`) dan 2 variabel tetap (`lokasi`, `tanggal`)
  yang ditulis langsung di kode. Soal diuji dengan data input berbeda, sehingga
  jawaban tidak boleh di-hardcode. Nilai dan jawaban lama tidak dihapus.

## Batasan Penting

- **Upload berkas lewat Server Action → kena limit body request Vercel (~4.5 MB).**
  Berkas dibaca di server lalu diteruskan ke Supabase Storage, jadi batas ini
  berlaku. Karena `MAKS_FILE_MB = 5` di `src/lib/tugas.ts` (dan boleh beberapa
  berkas sekaligus), kirim di bawah ~4 MB agar aman.
  Kalau nanti butuh berkas besar, solusinya upload langsung dari browser ke
  Supabase Storage (belum diterapkan).
- **Import Excel** (siswa / nilai / kredensial) juga lewat Server Action, jadi
  file yang sangat besar bisa gagal dengan alasan yang sama.
- `next.config.ts` menyetel `serverActions.bodySizeLimit: "30mb"`, tetapi limit
  platform Vercel tetap lebih rendah.
- **Pelacakan lokasi siswa butuh HTTPS.** Browser hanya memberi GPS lewat
  HTTPS (atau `localhost`). Di HTTP biasa (mis. dibuka dari HP via IP LAN
  seperti `http://192.168.x.x`) lokasi tidak tersedia dan dicatat
  "Tidak didukung". Vercel sudah HTTPS, jadi tidak perlu diubah.
  - Lokasi diambil saat siswa membuka dashboard (bukan saat login) karena izin
    browser baru bisa diminta setelah halaman terbuka.
  - Ketelitian bervariasi: HP ±5–30 m, laptop WiFi ±20–50 m, sedangkan PC lab
    berkabel bisa meleset 1–50 km (IP geolocation). Angka akurasi selalu
    ditampilkan agar guru bisa menilai sendiri.
  - Siswa bisa menolak izin atau memakai GPS palsu; karena sifatnya
    pemantauan (bukan penegakan), status "Izin ditolak"/"Gagal dilacak"
    tetap informatif.

## Cara Push Perubahan

```bash
git add -A
git commit -m "pesan perubahan"
git push origin main
```

Setelah push, tunggu Vercel selesai build (biasanya otomatis).

## Domain Sendiri (opsional)

Vercel → **Settings → Domains** → tambah domain → ikuti petunjuk DNS.
Setelah itu (opsional) samakan **Supabase → Authentication → URL Configuration → Site URL** dengan domain baru.

## Troubleshooting

| Gejala | Kemungkinan penyebab |
| --- | --- |
| "Tidak bisa terhubung ke Supabase" saat login | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` salah atau belum diisi di Vercel. |
| Login guru selalu gagal | Akun guru belum dibuat di Supabase Auth, atau password salah. |
| Upload tugas gagal / error 413 | Berkas terlalu besar (limit ~4.5 MB) atau bucket `tugas` belum dibuat. |
| Perubahan env var tidak berefek | Belum dilakukan **Redeploy**. |
| Halaman tampil "Sedang Maintenance" terus | `MAINTENANCE_MODE` masih `1` → ubah ke `0` + Redeploy. |
| Kolom Lokasi di Log Login selalu "Belum dilacak" | Siswa belum membuka dashboard sejak fitur ini dipasang, atau DDL Tahap 30 belum dijalankan. |
| Lokasi selalu "Tidak didukung" | Halaman dibuka lewat HTTP (bukan HTTPS/localhost). |
| Kuota ganti password siswa selalu "3 dari 3" / tidak berkurang | Schema Tahap 31 belum dijalankan di Supabase (kolom `password_kuota_tanggal` & `password_kuota_terpakai` belum ada). |
| Muncul "Kuota ganti password belum aktif" di profil siswa | Sama seperti di atas — jalankan Tahap 31 di SQL Editor. |
| Siswa lupa password & sudah habis kuota hari ini | Guru membuka **Data Siswa** → tombol **Reset Kuota Password** pada baris siswa (atau centang beberapa siswa → **Reset kuota password**). Jatah 3x hari ini kembali. |
| Modul "Tugas Praktik — Persiapan Ujian Praktik Python" tidak muncul di Lab | Schema Tahap 32 belum dijalankan di Supabase, atau tidak ada kelas dengan nama berawalan `9`/`IX` sehingga modul hanya tampil untuk semua kelas setelah relasi kelas dibuat. |
| Tugas praktik masih menampilkan 2 tantangan (Pendaftaran & Perpustakaan) | Schema Tahap 37 belum dijalankan. Jalankan Tahap 37 di Supabase SQL Editor agar modul berisi satu tantangan panjang. |
| Tugas praktik masih meminta 5 input | Schema Tahap 38 belum dijalankan. Jalankan Tahap 38 agar soal memakai 3 input (nama, NIS, kelas) dan 2 variabel tetap (`ruang`, `tanggal`) yang ditulis langsung di kode. |
| Tugas praktik selalu "Input belum sesuai" padahal data sudah benar | Program memanggil `input()` bukan tepat 3 kali, atau urutan/huruf besar-kecilnya diubah. Data input: nama, NIS, kelas. `ruang` dan `tanggal` tidak boleh memakai `input()`. |
| Tugas praktik selalu "Belum lengkap: minimal N perintah print()" | Jumlah `print()` belum mencapai 18, atau output belum mencapai 18 baris tidak kosong. Pastikan setiap bagian kartu ditampilkan dengan `print()`. |
| Pesan "Dengan input berbeda, output tidak sesuai" | Program masih menulis jawaban langsung di `print()`. Nilai harus diambil dari `input()`, disimpan di variabel, lalu ditampilkan. |
| Soal kode ulangan masih sapaan "Halo, Budi!" / hanya 1 input | Schema Tahap 51 belum dijalankan. Jalankan Tahap 51 di Supabase SQL Editor agar soal berganti menjadi Kartu Peserta Kegiatan Literasi (3 input: `nama`, `kelas`, `judul_buku`; variabel tetap: `lokasi`, `tanggal`). |
| Soal kode ulangan selalu "Input belum sesuai" | Program memanggil `input()` bukan tepat 3 kali, atau urutan/huruf besar-kecil data diubah. Data utama: `Dimas`, `IX B`, `Negeri 5 Menara`. `lokasi` dan `tanggal` tidak boleh memakai `input()`. |
| Nilai soal kode ulangan tidak penuh padahal output terlihat benar | Pastikan `nama`, `kelas`, dan `judul_buku` berasal dari `input()`; `lokasi` dan `tanggal` ditulis langsung di kode. Output uji memakai data berbeda (`Siti`, `IX A`, `Laskar Pelangi`), jadi jangan hardcode. |
| Saklar "Tutup akses soal" di Pengaturan tidak berpengaruh | Schema Tahap 41 belum dijalankan (tabel `pengaturan_guru` belum ada). Jalankan Tahap 41 di Supabase SQL Editor; form akan menampilkan peringatan selama tabel belum ada. |
| Halaman /guru/pengaturan error "relation does not exist" | Sama seperti di atas — jalankan Tahap 41. |
| Soal ulangan masih bisa dibuka walau saklar global menyala | Kemungkinan siswa sudah memulai ulangan sebelum saklar dinyalakan (sesi berjalan sengaja diizinkan agar jawaban tidak hilang), atau saklar per ulangan masih terbuka. Cek juga menu titik-tiga di halaman Ulangan. |
| Tombol "Tutup modul" di /guru/lab tidak muncul / tidak berpengaruh | Schema Tahap 42 belum dijalankan (kolom `coding_lessons.dibuka` belum ada). Jalankan Tahap 42 di Supabase SQL Editor; halaman akan menampilkan peringatan selama kolom belum ada. |
| Modul lab masih bisa dibuka siswa walau sudah "Ditutup guru" | Cek juga saklar global di /guru/pengaturan — modul hanya bisa dibuka kalau kolom `dibuka` dan saklar global sama-sama terbuka. Kalau halaman level masih terbuka di tab lama, muat ulang: penjagaan sebenarnya ada di server. |
| Login token siswa ditolak padahal token benar | Cek mode di **Login Token Siswa** /guru/kelas. Di mode **Otomatis**, token hanya dibuka sampai jam tutup yang diatur (banner di /login-siswa menampilkan jamnya). Kalau statusnya "Ditutup guru", token tidak bisa dipakai sama sekali di mode apa pun. Alasan penolakan tercatat di /guru/log-login. |
| Saklar "Tutup login token" di /guru/kelas tidak bisa dipakai | Schema Tahap 43 belum dijalankan (kolom `pengaturan_guru.token_login_dibuka` belum ada). Jalankan Tahap 43 di Supabase SQL Editor. |
| Pilihan mode Otomatis/Manual tidak bisa diganti | Schema Tahap 45 belum dijalankan (kolom `pengaturan_guru.token_login_mode` belum ada). Selama kolom belum ada, aplikasi memakai mode **Otomatis**. Jalankan Tahap 45 di Supabase SQL Editor. |
| Jam tutup otomatis tidak bisa diubah | Schema Tahap 46 belum dijalankan (kolom `pengaturan_guru.token_login_tutup_waktu` belum ada). Selama kolom belum ada, jam tutup memakai **18:00 WIB**. Jalankan Tahap 46 di Supabase SQL Editor. |
| Form "Informasi di halaman login siswa" tidak bisa disimpan | Schema Tahap 44 belum dijalankan (kolom `pengaturan_guru.info_login_siswa` belum ada). Jalankan Tahap 44 di Supabase SQL Editor. |
| Informasi tidak muncul di /login-siswa | Pastikan centang **Tampilkan di halaman login siswa** aktif dan teksnya tidak kosong. Setelah disimpan, muat ulang halaman login siswa. |
| Nilai siswa masih terlihat walau ulangan sudah ditutup | Cek saklar **Bagikan nilai** di menu titik-tiga daftar Ulangan atau halaman Input Nilai. Tutup/buka ulangan hanya mengatur akses soal; nilai diatur terpisah oleh saklar tersebut. |
| Nilai tidak muncul di akun siswa padahal sudah diisi | Nilai belum dibagikan. Buka **/guru/ulangan/[id]/nilai** atau menu titik-tiga → **Bagikan nilai**. |
| Tombol "Bagikan nilai" tidak berpengaruh / halaman Ulangan error "column bagikan_nilai does not exist" | Schema Tahap 48 belum dijalankan. Jalankan Tahap 48 di Supabase SQL Editor. |
| Nilai kode manual tidak bisa diisi di atas 100 | Memang dibatasi 0–100 (Tahap 50). Isi nilai dalam rentang tersebut; nilai 75 ke atas tidak remedial, di bawah 75 remedial. |
| Ingin memastikan database juga membatasi nilai 0–100 | Jalankan Tahap 50 di Supabase SQL Editor. Constraint `exam_scores_nilai_check` dan `exam_submissions.nilai_total` dikembalikan ke 0–100. |

## Checklist Cepat

- [ ] Repo GitHub terhubung ke Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` terisi
- [ ] `SUPABASE_SERVICE_ROLE_KEY` diisi di environment server-only
- [ ] `SISWA_SESSION_SECRET` diisi teks acak yang panjang
- [ ] `schema.sql` sudah dijalankan di Supabase
- [ ] Bucket Storage `tugas` sudah ada
- [ ] Tabel `lokasi_terakhir_siswa` sudah ada (Tahap 30)
- [ ] Kolom `password_kuota_tanggal` & `password_kuota_terpakai` sudah ada (Tahap 31)
- [ ] Modul "Tugas Praktik - Persiapan Ujian Praktik Python" + 1 tantangan panjang sudah ada (Tahap 32 + Tahap 37 + Tahap 38)
- [ ] Tabel `pengaturan_guru` sudah ada (Tahap 41) — untuk saklar "Tutup akses soal"
- [ ] Kolom `coding_lessons.dibuka` sudah ada (Tahap 42) — untuk tombol "Tutup modul" di Lab Coding
- [ ] Kolom `pengaturan_guru.token_login_dibuka` sudah ada (Tahap 43) — untuk saklar login token di /guru/kelas
- [ ] Kolom `pengaturan_guru.token_login_mode` sudah ada (Tahap 45) — untuk pilihan mode Otomatis/Manual login token
- [ ] Kolom `pengaturan_guru.token_login_tutup_waktu` sudah ada (Tahap 46) — untuk mengatur jam tutup otomatis login token
- [ ] Kolom `pengaturan_guru.info_login_siswa` & `info_login_siswa_aktif` sudah ada (Tahap 44) — untuk informasi di halaman login siswa
- [ ] Kolom `exams.bagikan_nilai` sudah ada (Tahap 48) — untuk saklar **Bagikan nilai** per ulangan
- [ ] Constraint nilai ulangan sudah dibatasi 0–100 (Tahap 50), dengan aturan remedial < 75
- [ ] Soal kode **Ulangan Praktik Akhir Semester** sudah memakai Kartu Peserta Kegiatan Literasi (Tahap 51)
- [ ] Login guru & siswa sudah dicoba di URL produksi
