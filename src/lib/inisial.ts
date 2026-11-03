// ============================================================================
// Inisial nama untuk avatar.
// Dipakai sidebar siswa & halaman profil agar avatarnya selalu sama.
// Contoh: "GHAISAN APRILLIO" -> "GA"
// ============================================================================

export function buatInisial(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? "")
    .join("");
}
