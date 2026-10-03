"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ambilIp,
  catatGagal,
  cekBlokir,
  pesanTerlaluBanyak,
  resetGagal,
} from "@/lib/rate-limit";

// Login guru memakai username, tapi Supabase Auth menyimpan email.
// Username "ilham" diubah menjadi "ilham@portal.local" secara internal.
// Email tersebut TIDAK pernah ditampilkan ke pengguna.
export async function login(
  _prevState: { message: string | null },
  formData: FormData,
): Promise<{ message: string | null }> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { message: "Username dan password wajib diisi." };
  }

  // Pembatasan percobaan login (anti brute force / spam).
  const kunci = `guru:${await ambilIp()}:${username}`;
  const cek = cekBlokir(kunci);
  if (!cek.boleh) {
    return { message: pesanTerlaluBanyak(cek.sisaDetik) };
  }

  const email = `${username}@portal.local`;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      catatGagal(kunci);
      return { message: "Username atau password salah." };
    }
  } catch {
    return {
      message: "Tidak bisa terhubung ke Supabase. Periksa file .env.local.",
    };
  }

  resetGagal(kunci);
  redirect("/guru");
}
