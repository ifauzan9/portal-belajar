import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client Supabase khusus portal siswa.
//
// Sengaja tidak membaca cookie Supabase Auth. Portal siswa memakai sesi
// kustom `siswa_session`, jadi request harus selalu berjalan sebagai role
// `anon`. Dengan begitu, sesi login guru yang masih tersimpan di browser
// yang sama tidak ikut membuat request siswa menjadi role `authenticated`.
export async function createSiswaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib dikonfigurasi.",
    );
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  });
}
