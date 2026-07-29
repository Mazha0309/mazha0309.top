import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";
const CONTEXT = "mazha-home/comment-ai-api-key/v1";

function storageKey() {
  const source =
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? ""
      : "development-only-secret-change-before-production");
  if (!source) {
    throw new Error("BETTER_AUTH_SECRET 未配置，不能安全保存 API Key。");
  }
  return createHash("sha256").update(`${CONTEXT}:${source}`).digest();
}

export function encryptStoredSecret(plaintext: string) {
  if (!plaintext) throw new Error("不能加密空密钥。");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", storageKey(), iv);
  cipher.setAAD(Buffer.from(CONTEXT));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptStoredSecret(payload: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] =
    payload.split(".");
  if (
    version !== VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra
  ) {
    throw new Error("保存的密钥格式无效。");
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("保存的密钥格式无效。");
  }

  const decipher = createDecipheriv("aes-256-gcm", storageKey(), iv);
  decipher.setAAD(Buffer.from(CONTEXT));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
