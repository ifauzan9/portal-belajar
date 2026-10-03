import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportSiswa } from "@/components/import-siswa";
import { createClient } from "@/lib/supabase/server";

export default async function ImportSiswaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guru/siswa"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kembali ke Data Siswa
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Import Siswa dari Excel
        </h1>
      </div>

      <ImportSiswa />
    </div>
  );
}
