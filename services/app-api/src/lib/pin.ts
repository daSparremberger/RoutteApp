import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPin(pin: string, hash?: string | null) {
  if (!hash) {
    return false;
  }

  const [salt, storedKey] = hash.split(":");

  if (!salt || !storedKey) {
    return false;
  }

  const derivedKey = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(storedKey, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}
