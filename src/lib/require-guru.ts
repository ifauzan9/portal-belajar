import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Selalu cek login di server sebelum memanipulasi data.
// Dipakai oleh semua Server Action (kelas, siswa, dll).
export async function requireGuru() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return supabase;
}
