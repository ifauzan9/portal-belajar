import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FormPengaturanSoal } from "@/components/form-pengaturan-soal";
import { FormInfoLogin } from "@/components/form-info-login";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Notifikasi } from "@/components/ui/notifikasi";
import { MAKS_PESAN_TUTUP, JAM_TUTUP_TOKEN_LOGIN } from "@/lib/pengaturan-soal";
import { formatWaktuDetikWib } from "@/lib/waktu";

// ============================================================================
// Halaman pengaturan akun guru.
//
// Berisi:
//   1. Saklar global "tutup akses soal" (Tahap 41).
//   2. Informasi bebas untuk halaman login siswa (Tahap 44).
//
// Saklar per ulangan tetap ada di /guru/ulangan (menu titik-tiga → Tutup
// ulangan), dan login token diatur di /guru/kelas.
// ============================================================================

type BarisPengaturan = {
  tutup_soal_ulangan: boolean | null;
  tutup_soal_lab: boolean | null;
  pesan_tutup: string | null;
  diperbarui_at: string | null;
};

export default async function PengaturanGuruPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("pengaturan_guru")
    .select("tutup_soal_ulangan, tutup_soal_lab, pesan_tutup, diperbarui_at")
    .eq("id", 1)
    .maybeSingle();

  const siap = !error;
  const baris = (data ?? null) as BarisPengaturan | null;

  // Kolom informasi login siswa (Tahap 44) dibaca terpisah supaya saklar
  // Tahap 41 tetap bisa dipakai walau DDL Tahap 44 belum dijalankan.
  const { data: dataInfo, error: errorInfo } = await supabase
    .from("pengaturan_guru")
    .select("info_login_siswa, info_login_siswa_aktif")
    .eq("id", 1)
    .maybeSingle();

  const siapInfo = !errorInfo;
  const infoLogin = (
    (dataInfo as { info_login_siswa: string | null } | null)
      ?.info_login_siswa ?? ""
  ).trim();
  const infoLoginAktif =
    (dataInfo as { info_login_siswa_aktif: boolean | null } | null)
      ?.info_login_siswa_aktif !== false;

  const tutupUlangan = baris?.tutup_soal_ulangan === true;
  const tutupLab = baris?.tutup_soal_lab === true;
  const pesan = (baris?.pesan_tutup ?? "").trim();
  const diperbaruiAt = baris?.diperbarui_at ?? null;
  const adaYangDitutup = tutupUlangan || tutupLab;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pengaturan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atur akses siswa ke soal dan informasi yang tampil di halaman login.
          Perubahan langsung berlaku untuk semua siswa.
        </p>
      </div>

      {adaYangDitutup ? (
        <Notifikasi varian="peringatan" judul="Akses soal sedang ditutup">
          <p>
            Siswa saat ini tidak bisa membuka{" "}
            {tutupUlangan && tutupLab
              ? "soal ulangan dan Lab Coding"
              : tutupUlangan
                ? "soal ulangan"
                : "modul Lab Coding"}
            . Matikan saklar di bawah kalau sudah selesai.
          </p>
          <p className="mt-1 text-xs opacity-80">
            Siswa yang sudah memulai ulangan tetap bisa melanjutkan dan
            mengumpulkan jawabannya agar tidak ada pekerjaan yang hilang.
          </p>
        </Notifikasi>
      ) : null}

      <Kartu>
        <KartuJudul
          judul="Akses soal untuk siswa"
          subjudul="Satu saklar untuk semua kelas"
        />

        <div className="mt-4">
          <FormPengaturanSoal
            tutupUlangan={tutupUlangan}
            tutupLab={tutupLab}
            pesan={pesan}
            siap={siap}
          />
        </div>

        {diperbaruiAt ? (
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Terakhir diubah: {formatWaktuDetikWib(diperbaruiAt)}
          </p>
        ) : null}
      </Kartu>

      <Kartu>
        <KartuJudul
          judul="Informasi di halaman login siswa"
          subjudul="Tampil di /login-siswa untuk semua siswa"
        />

        <div className="mt-4">
          <FormInfoLogin
            info={infoLogin}
            aktif={infoLoginAktif}
            siap={siapInfo}
          />
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Informasi ini terpisah dari aturan login token (tutup otomatis pukul{" "}
          {JAM_TUTUP_TOKEN_LOGIN}.00 WIB dan saklar di{" "}
          <Link
            href="/guru/kelas"
            className="font-medium text-emerald-700 underline hover:no-underline"
          >
            halaman Kelas
          </Link>
          ).{" "}
          <Link
            href="/login-siswa"
            target="_blank"
            className="font-medium text-emerald-700 underline hover:no-underline"
          >
            Lihat halaman login siswa
          </Link>
          .
        </p>
      </Kartu>

      <Kartu className="border-l-4 border-l-slate-300">
        <h2 className="text-sm font-semibold text-slate-900">
          Bedanya dengan tutup per ulangan & per modul
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>
            <strong>Saklar di halaman ini</strong> menutup semua ulangan dan
            seluruh Lab Coding sekaligus. Cocok saat ujian berlangsung atau
            materi belum boleh dibuka.
          </li>
          <li>
            <strong>Tutup per ulangan</strong> ada di{" "}
            <Link
              href="/guru/ulangan"
              className="font-medium text-emerald-700 underline hover:no-underline"
            >
              halaman Ulangan
            </Link>{" "}
            (menu titik-tiga pada baris ulangan). Hanya menutup satu ulangan
            itu saja.
          </li>
          <li>
            <strong>Tutup per modul Lab</strong> ada di{" "}
            <Link
              href="/guru/lab"
              className="font-medium text-emerald-700 underline hover:no-underline"
            >
              halaman Lab Coding
            </Link>{" "}
            (tombol Tutup modul / Buka modul pada tiap modul). Hanya menutup
            modul itu saja, termasuk semua levelnya.
          </li>
          <li>
            Modul lab bisa dibuka siswa hanya kalau <strong>keduanya</strong>{" "}
            terbuka: saklar global di halaman ini dan tombol buka modul.
          </li>
          <li>
            Ulangan bisa dikerjakan siswa hanya kalau <strong>keduanya</strong>{" "}
            terbuka. Nilai dan progres yang sudah tersimpan tidak terhapus.
          </li>
          <li>
            Tugas (link/berkas) tidak ikut ditutup oleh halaman ini; tombol
            buka/tutup tugas tetap ada di{" "}
            <Link
              href="/guru/tugas"
              className="font-medium text-emerald-700 underline hover:no-underline"
            >
              halaman Tugas
            </Link>
            .
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Pesan untuk siswa maksimal {MAKS_PESAN_TUTUP} karakter.
        </p>
      </Kartu>
    </div>
  );
}
