import { redirect } from "next/navigation";

// Halaman lama /siswa/ganti-password kini disatukan ke /siswa/profil.
// Redirect dipertahankan supaya link/bookmark lama tidak rusak.
export default function GantiPasswordPage() {
  redirect("/siswa/profil");
}
