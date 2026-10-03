"use client";

import { useState } from "react";
import { deleteQuestion } from "@/app/guru/ulangan/actions";

// Wrapper di sini agar form submit memakai server action `deleteQuestion`
// (bukan inline async — inline tidak boleh di client component).
// Form submit tetap dikirim ke server secara native.
function hapusSoal(fd: FormData) {
  return deleteQuestion(fd);
}

type Soal = {
  id: string;
  soal: string;
  jenis: string;
  pilihan: string[] | null;
  kunci: string | null;
  poin: number;
  urutan: number;
};

export function DaftarSoal({
  soalList,
  examId,
}: {
  soalList: Soal[];
  examId: string;
}) {
  const [idHapus, setIdHapus] = useState<string | null>(null);

  if (soalList.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Belum ada soal. Tambahkan soal di form di atas.
      </p>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="w-10 px-3 py-2 text-left font-medium text-slate-500">
              No
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Soal
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Jenis
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Poin
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Kunci
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {soalList.map((q, i) => (
            <tr key={q.id} className="transition hover:bg-slate-50">
              <td className="px-3 py-2.5 text-slate-400 tabular-nums">
                {i + 1}
              </td>
              <td className="max-w-[260px] px-3 py-2.5">
                <p className="line-clamp-2 text-slate-900">{q.soal}</p>
                {q.jenis === "pg" && q.pilihan ? (
                  <ul className="mt-1 space-y-0.5">
                    {q.pilihan.map((p, j) => (
                      <li
                        key={j}
                        className={`text-xs ${
                          p.startsWith(`${q.kunci}.`)
                            ? "font-medium text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                    q.jenis === "pg"
                      ? "bg-blue-50 text-blue-700 ring-blue-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"
                  }`}
                >
                  {q.jenis === "pg" ? "Pilihan Ganda" : "Esai"}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-slate-600">
                {q.poin}
              </td>
              <td className="px-3 py-2.5">
                {q.kunci ? (
                  <span className="font-mono text-xs font-medium text-slate-900">
                    {q.kunci}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">–</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                {idHapus === q.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Yakin hapus?</span>
                    <form action={hapusSoal}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="exam_id" value={examId} />
                      <button
                        type="submit"
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-500"
                      >
                        Hapus
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setIdHapus(null)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIdHapus(q.id)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
