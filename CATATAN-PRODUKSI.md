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

## Checklist Cepat

- [ ] Repo GitHub terhubung ke Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` terisi
- [ ] `SUPABASE_SERVICE_ROLE_KEY` diisi di environment server-only
- [ ] `SISWA_SESSION_SECRET` diisi teks acak yang panjang
- [ ] `schema.sql` sudah dijalankan di Supabase
- [ ] Bucket Storage `tugas` sudah ada
- [ ] Login guru & siswa sudah dicoba di URL produksi
