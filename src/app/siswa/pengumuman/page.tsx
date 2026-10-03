import { requireSiswa } from "@/lib/sesi-siswa";
import { createClient } from "@/lib/supabase/server";
import { sudahTampil } from "@/lib/jadwal-pengumuman";
import { Kartu } from "@/components/ui/kartu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IkonPengumuman } from "@/components/ui/ikon-siswa";

function tanggalPendek(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(t);
}

export default async function PengumumanSiswaPage() {
  const { siswa, kelas } = await requireSiswa();
  const supabase = await createClient();

  const { data: pengumumanData } = await supabase
    .from("announcements")
    .select(
      "id, judul, isi, created_at, kelas_id, mulai_pada, announcement_classes(kelas_id)",
    );

  // Pengumuman yang berlaku untuk kelas saya:
  //  - ada di announcement_classes untuk kelas saya, atau
  //  - "semua kelas" (tidak ada baris di announcement_classes).
  // Pengumuman terjadwal yang belum waktunya disembunyikan.
  const relevan = (pengumumanData ?? []).filter((p) => {
    const row = p as {
      mulai_pada: string | null;
      announcement_classes?: { kelas_id: string }[];
    };
    if (!sudahTampil(row.mulai_pada)) return false;
    const hubungannya = row.announcement_classes ?? [];
    const berlakuSemua = hubungannya.length === 0;
    const untukKelasSaya = siswa.kelas_id
      ? hubungannya.some((h) => h.kelas_id === siswa.kelas_id)
      : false;
    return berlakuSemua || untukKelasSaya;
  });

  const urut = relevan.sort(
    (a, b) =>
      new Date((b as { created_at: string | null }).created_at ?? 0).getTime() -
      new Date((a as { created_at: string | null }).created_at ?? 0).getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pengumuman</h1>
        <p className="mt-1 text-sm text-slate-500">
          {kelas
            ? `Pengumuman untuk kelas ${kelas.nama_kelas}.`
            : "Kamu belum masuk kelas. Pengumuman yang ditampilkan berlaku untuk semua kelas."}
        </p>
      </div>

      {urut.length > 0 ? (
        <div className="space-y-3">
          {urut.map((p) => {
            const row = p as {
              id: string;
              judul: string;
              isi: string;
              created_at: string | null;
              announcement_classes?: { kelas_id: string }[];
            };
            const berlakuSemua = (row.announcement_classes ?? []).length === 0;
            return (
              <Kartu key={row.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{row.judul}</h2>
                  <div className="flex items-center gap-2">
                    <Badge varian={berlakuSemua ? "netral" : "info"}>
                      {berlakuSemua
                        ? "Semua kelas"
                        : `Kelas ${kelas?.nama_kelas ?? ""}`}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {tanggalPendek(row.created_at)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {row.isi}
                </p>
              </Kartu>
            );
          })}
        </div>
      ) : (
        <Kartu>
          <EmptyState
            ikon={<IkonPengumuman className="h-6 w-6" />}
            judul="Belum ada pengumuman"
            keterangan="Pengumuman dari guru akan muncul di sini."
          />
        </Kartu>
      )}
    </div>
  );
}