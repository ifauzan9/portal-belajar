import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { Kartu, KartuJudul } from "@/components/ui/kartu";
import { KartuStat } from "@/components/ui/kartu-stat";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonAbsensi } from "@/components/ui/ikon-siswa";
import {
  bacaStatusAbsensi,
  formatTanggal,
  hitungRekap,
  LABEL_STATUS,
  VARIAN_BADGE,
  type StatusAbsensi,
} from "@/lib/absensi";

export default async function AbsensiSiswaPage() {
  const { siswa } = await requireSiswa();
  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance")
    .select("tanggal, status")
    .eq("siswa_id", siswa.id)
    .order("tanggal", { ascending: false });

  const rows = (data ?? []).flatMap((r) => {
    const isi = r as { tanggal: string; status: string };
    const status = bacaStatusAbsensi(isi.status);
    return status ? [{ tanggal: isi.tanggal, status }] : [];
  });

  const rekap = hitungRekap(rows);
  const warnaPersen =
    rekap.total === 0
      ? "netral"
      : rekap.persenHadir >= 75
        ? "emerald"
        : rekap.persenHadir >= 50
          ? "amber"
          : "merah";

  const rincian: { tanggal: string; status: StatusAbsensi }[] = rows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Absensi Saya</h1>
        <p className="mt-1 text-sm text-slate-500">
          {rekap.total > 0
            ? `${rekap.total} hari tercatat`
            : "Belum ada catatan kehadiran"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KartuStat
          label="% Hadir"
          nilai={`${rekap.persenHadir}%`}
          warna={warnaPersen}
          ikon={<IkonAbsensi className="h-4 w-4" />}
        />
        <KartuStat label="Hadir" nilai={rekap.hadir} warna="emerald" />
        <KartuStat label="Sakit" nilai={rekap.sakit} warna="biru" />
        <KartuStat label="Izin" nilai={rekap.izin} warna="amber" />
        <KartuStat label="Alpa" nilai={rekap.alpa} warna="merah" />
      </div>

      <Kartu>
        <KartuJudul
          judul="Rincian Kehadiran"
          subjudul="Terbaru di atas"
        />

        {rincian.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {rincian.map((item) => (
              <li
                key={item.tanggal}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="text-slate-700">
                  {formatTanggal(item.tanggal)}
                </span>
                <Badge varian={VARIAN_BADGE[item.status]}>
                  {LABEL_STATUS[item.status]}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            padat
            ikon={<IkonAbsensi className="h-5 w-5" />}
            judul="Belum ada catatan"
            keterangan="Absensi dari gurumu akan muncul di sini."
          />
        )}
      </Kartu>
    </div>
  );
}
