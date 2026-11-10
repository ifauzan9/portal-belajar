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
| Saklar "Tutup akses soal" di Pengaturan tidak berpengaruh | Schema Tahap 41 belum dijalankan (tabel `pengaturan_guru` belum ada). Jalankan Tahap 41 di Supabase SQL Editor; form akan menampilkan peringatan selama tabel belum ada. |
| Halaman /guru/pengaturan error "relation does not exist" | Sama seperti di atas — jalankan Tahap 41. |
| Soal ulangan masih bisa dibuka walau saklar global menyala | Kemungkinan siswa sudah memulai ulangan sebelum saklar dinyalakan (sesi berjalan sengaja diizinkan agar jawaban tidak hilang), atau saklar per ulangan masih terbuka. Cek juga menu titik-tiga di halaman Ulangan. |
| Tombol "Tutup modul" di /guru/lab tidak muncul / tidak berpengaruh | Schema Tahap 42 belum dijalankan (kolom `coding_lessons.dibuka` belum ada). Jalankan Tahap 42 di Supabase SQL Editor; halaman akan menampilkan peringatan selama kolom belum ada. |
| Modul lab masih bisa dibuka siswa walau sudah "Ditutup guru" | Cek juga saklar global di /guru/pengaturan — modul hanya bisa dibuka kalau kolom `dibuka` dan saklar global sama-sama terbuka. Kalau halaman level masih terbuka di tab lama, muat ulang: penjagaan sebenarnya ada di server. |

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
- [ ] Login guru & siswa sudah dicoba di URL produksi
