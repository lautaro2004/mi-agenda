import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM para el refresh token de Google. La clave es un secreto de
// plataforma (GOOGLE_TOKEN_ENCRYPTION_KEY: 32 bytes en base64 o 64 hex).
// Formato guardado: "v1.<iv>.<tag>.<ciphertext>" (base64url). El AAD liga el
// texto cifrado a su conexión (businessId:userId): copiar el valor cifrado a
// la fila de otro usuario/negocio no permite descifrarlo.

function getKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("google_encryption_not_configured");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("google_encryption_key_invalid");
  return key;
}

export function encryptToken(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptToken(payload: string, aad: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("google_token_malformed");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function connectionAad(businessId: string, userId: string): string {
  return `${businessId}:${userId}`;
}
