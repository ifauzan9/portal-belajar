import { pbkdf2Sync, randomBytes } from "node:crypto";

// Hash password siswa memakai PBKDF2-SHA256 + salt acak.
// Format tersimpan di database: "pbkdf2$<iterasi>$<salt-hex>$<hash-hex>"
// Bisa diverifikasi ulang tanpa library eksternal.

const ITERASI = 100_000;
const UJIAN_HASH = 32; // byte
const UJIAN_SALT = 16; // byte

// Ubah password menjadi string hash yang siap disimpan ke database.
export function hashPassword(password: string): string {
  const salt = randomBytes(UJIAN_SALT);
  const hash = pbkdf2(password, salt, ITERASI, UJIAN_HASH);
  return `pbkdf2$${ITERASI}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

// Cek apakah password cocok dengan hash yang tersimpan.
export function verifikasiPassword(
  password: string,
  hashTersimpan: string,
): boolean {
  const bagian = hashTersimpan.split("$");
  if (bagian.length !== 4 || bagian[0] !== "pbkdf2") {
    return false; // format tidak dikenal
  }
  const [, iterasi, saltHex, hashHex] = bagian;
  const iter = Number(iterasi);
  if (!Number.isInteger(iter) || iter <= 0) return false;

  const salt = Buffer.from(saltHex, "hex");
  const hashSimpan = Buffer.from(hashHex, "hex");
  const hasil = pbkdf2(password, salt, iter, hashSimpan.length);

  // Perbandingan tetra (constant-time) supaya tidak bocor lewat timing.
  if (hasil.length !== hashSimpan.length) return false;
  return Buffer.compare(hashSimpan, hasil) === 0;
}

// PBKDF2-SHA256 (bungkus pbkdf2Sync).
function pbkdf2(
  password: string,
  salt: Buffer,
  iterasi: number,
  panjang: number,
): Buffer {
  return pbkdf2Sync(password, salt, iterasi, panjang, "sha256");
}
