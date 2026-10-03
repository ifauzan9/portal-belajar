import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase untuk sisi server (Server Components, Server Actions).
// Session disimpan di cookie, sehingga login bisa dibaca oleh server.
//
// `cache: "no-store"` di set ke global fetch client Supabase supaya
// setiap query selalu mengambil data fresh dari database, tidak
// memanfaatkan cache Next.js pada Server Component. Tanpa ini,
// perubahan kredensial siswa (buat otomatis, import, toggle aktif)
// tidak langsung terlihat di halaman /guru/siswa sampai cache expire.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component tidak bisa mengubah cookie, abaikan saja.
            // Cookie tetap disimpan saat dipanggil dari Server Action.
          }
        },
      },
      global: {
        fetch: (url, options) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    },
  );
}
