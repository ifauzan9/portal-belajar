import { cookies } from "next/headers";
import { requireSiswa } from "@/lib/sesi-siswa";
import { createSiswaClient } from "@/lib/supabase/siswa";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sisaKuotaPassword,
  MAKS_GANTI_PASSWORD_HARIAN,
} from "@/lib/kuota-password";
import {
  NAMA_COOKIE_TAMPILAN,
  uraiCookieTampilan,
} from "@/lib/preferensi-siswa";
import { buatInisial } from "@/lib/inisial";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { Notifikasi } from "@/components/ui/notifikasi";
import { FormGantiPassword } from "@/components/form-ganti-password";
import { PreferensiTampilan } from "@/components/preferensi-tampilan";
import { IkonProfil } from "@/components/ui/ikon-siswa";

// ============================================================================
// Halaman profil siswa.
//
// Isi:
//  1. Identitas (nama, NIS, username READ-ONLY — siswa tidak bisa mengubah).
//  2. Info kelas.
//  3. Ganti password (tanpa password lama, kuota 3x/hari).
//  4. Preferensi tampilan (tema & ukuran teks, disimpan di browser).
//
// Catatan keamanan: halaman ini TIDAK pernah menampilkan atau menyimpan
// password asli. Database hanya menyimpan hash PBKDF2.
// ============================================================================

export default async function ProfilSiswaPage() {
  const { siswa, kelas } = await requireSiswa();

  const admin = createAdminClient();

  // Akun dicari lewat siswa_id (unik), bukan lewat username sesi — supaya
  // tetap ketemu untuk sesi lama yang username-nya masih "token:<kelasId>".
  // Username sesi bisa beda kapitalisasi, jadi pakai nilai dari database.
  const { data: akun } = await admin
    .from("student_accounts")
    .select("id, username, is_active")
    .eq("siswa_id", siswa.id)
    .maybeSingle();

  const akunRow = akun as {
    id: string;
    username: string;
    is_active: boolean;
  } | null;
  const username = akunRow?.username ?? null;
  const akunNonaktif = akunRow?.is_active === false;

  // Jumlah teman sekelas.
  let jumlahKelas: number | null = null;
  if (siswa.kelas_id) {
    const supabase = await createSiswaClient();
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("kelas_id", siswa.kelas_id);
    jumlahKelas = count ?? null;
  }

  // Kuota dibaca dari DATABASE (Tahap 31), bukan dari memori server, supaya
  // angka yang tampil sama dari instance mana pun dan tidak reset saat deploy.
  const kuota = akunRow
    ? await sisaKuotaPassword(admin, akunRow.id)
    : {
        sisa: 0,
        maks: MAKS_GANTI_PASSWORD_HARIAN,
        terpakai: 0,
        boleh: false,
        siap: true,
      };

  // Preferensi tampilan dibaca dari cookie (bukan database).
  const store = await cookies();
  const tampilan = uraiCookieTampilan(store.get(NAMA_COOKIE_TAMPILAN)?.value);

  const inisial = buatInisial(siswa.nama_siswa);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Profil Saya</h1>
        <p className="mt-1 text-sm text-slate-500">
          Identitas akun, info kelas, keamanan password, dan tampilan.
        </p>
      </div>

      {/* ---------------------------- Identitas ---------------------------- */}
      <Kartu>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-bold text-white shadow-sm shadow-emerald-600/30 ring-2 ring-white"
          >
            {inisial || <IkonProfil className="h-7 w-7" />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-wider text-emerald-600 uppercase">
              Siswa
            </p>
            <h2 className="truncate text-lg font-semibold text-slate-900">
              {siswa.nama_siswa}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              NIS {siswa.nis ?? "-"}
            </p>
          </div>

          {kelas ? (
            <Badge varian="sukses" titik>
              {kelas.nama_kelas}
            </Badge>
          ) : (
            <Badge varian="peringatan">Belum masuk kelas</Badge>
          )}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Username
          </p>

          {username ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-slate-900">
                  {username}
                </span>
                <Badge varian="netral">Tidak bisa diubah</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Username dipakai untuk login. Kalau perlu diubah, hubungi guru.
              </p>
            </>
          ) : (
            <Notifikasi varian="info" className="mt-2">
              Akun login kamu belum dibuat. Minta guru membuatkan akun supaya
              kamu bisa masuk dan mengganti password sendiri.
            </Notifikasi>
          )}
        </div>
      </Kartu>

      {/* --------------------------- Info kelas --------------------------- */}
      <Kartu>
        <KartuJudul
          judul="Info Kelas"
          subjudul="Kelas tempat kamu terdaftar saat ini."
        />

        {kelas ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
              <dt className="text-xs text-slate-500">Nama kelas</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {kelas.nama_kelas}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
              <dt className="text-xs text-slate-500">Teman sekelas</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {jumlahKelas === null
                  ? "-"
                  : `${jumlahKelas} siswa termasuk kamu`}
              </dd>
            </div>
          </dl>
        ) : (
          <Notifikasi varian="info" className="mt-4">
            Kamu belum terdaftar di kelas mana pun. Hubungi guru agar dimasukkan
            ke kelas.
          </Notifikasi>
        )}
      </Kartu>

      {/* ------------------------- Ganti password ------------------------- */}
      <Kartu>
        <KartuJudul
          judul="Ganti Password"
          subjudul="Kamu sudah login, jadi tidak perlu memasukkan password lama."
        />

        {username && !akunNonaktif ? (
          <div className="mt-4 space-y-4">
            {!kuota.siap ? (
              <Notifikasi varian="peringatan" judul="Kuota belum bisa dihitung">
                {kuota.alasan === "skema"
                  ? "Pembaruan database (schema Tahap 31) belum dijalankan, jadi kuota ganti password belum bisa dihitung. Hubungi guru sebelum mengganti password."
                  : "Kuota ganti password sedang tidak bisa dibaca. Muat ulang halaman ini beberapa saat lagi."}
              </Notifikasi>
            ) : null}

            <FormGantiPassword
              username={username}
              sisaKuota={kuota.siap ? kuota.sisa : kuota.maks}
              maksKuota={kuota.maks}
              statusKuota={kuota.siap ? "siap" : (kuota.alasan ?? "galat")}
            />
          </div>
        ) : (
          <Notifikasi varian="info" className="mt-4">
            {akunNonaktif
              ? "Akunmu sedang dinonaktifkan guru, jadi password tidak bisa diganti. Hubungi gurumu untuk mengaktifkan kembali."
              : "Akunmu belum punya password karena belum dibuatkan akun. Hubungi gurumu."}
          </Notifikasi>
        )}
      </Kartu>

      {/* --------------------- Preferensi tampilan ------------------------ */}
      <Kartu>
        <KartuJudul
          judul="Preferensi Tampilan"
          subjudul="Disimpan di perangkat ini saja, tidak memengaruhi akunmu."
        />
        <div className="mt-4">
          <PreferensiTampilan awal={tampilan} />
        </div>
      </Kartu>
    </div>
  );
}
