import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts/decrypts a company's WhatsApp Cloud API access token before
 * it's stored in (or read back from) whatsapp_connections.access_token_encrypted
 * — see supabase/migrations/20260101000036_whatsapp_cloud_api_schema.sql.
 * The key never touches the database: it's WHATSAPP_TOKEN_ENCRYPTION_KEY,
 * a server-only env var (see docs/whatsapp-integration.md for how to
 * generate one). A stolen database dump is useless without it.
 *
 * AES-256-GCM: authenticated encryption, not just confidentiality — a
 * tampered ciphertext fails to decrypt instead of silently decrypting
 * to garbage that would then get sent to Meta's API as a bearer token.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV is the standard/recommended size for GCM

function getKey(): Buffer {
  const hex = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY is not configured — cannot encrypt/decrypt WhatsApp access tokens.",
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — generate one with `openssl rand -hex 32`.",
    );
  }
  return key;
}

/** Returns "ivBase64:authTagBase64:ciphertextBase64". */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptToken(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted WhatsApp access token (expected iv:authTag:ciphertext).");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
