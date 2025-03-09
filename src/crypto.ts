// src/crypto.ts
import crypto from "crypto";

export interface MyCryptoKey {
  algorithm: { name: string };
  extractable: boolean;
  type: "public" | "private" | "secret";
  data: Buffer;
}

export function generateRsaKeyPair(): {
  publicKey: MyCryptoKey;
  privateKey: MyCryptoKey;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    publicKey: {
      algorithm: { name: "RSA-OAEP" },
      extractable: true,
      type: "public",
      data: Buffer.from(publicKey),
    },
    privateKey: {
      algorithm: { name: "RSA-OAEP" },
      extractable: true,
      type: "private",
      data: Buffer.from(privateKey),
    },
  };
}

export function createRandomSymmetricKey(): MyCryptoKey {
  return {
    algorithm: { name: "AES-CBC" },
    extractable: true,
    type: "secret",
    data: crypto.randomBytes(32),
  };
}

export function importPrvKey(str: string): MyCryptoKey {
  return {
    algorithm: { name: "RSA-OAEP" },
    extractable: true,
    type: "private",
    data: Buffer.from(str, "base64"),
  };
}

export function importPubKey(str: string): MyCryptoKey {
  return {
    algorithm: { name: "RSA-OAEP" },
    extractable: true,
    type: "public",
    data: Buffer.from(str, "base64"),
  };
}

export function importSymKey(str: string): MyCryptoKey {
  return {
    algorithm: { name: "AES-CBC" },
    extractable: true,
    type: "secret",
    data: Buffer.from(str, "base64"),
  };
}

export function exportPrvKey(key: MyCryptoKey): string {
  return key.data.toString("base64");
}

export function exportPubKey(key: MyCryptoKey): string {
  return key.data.toString("base64");
}

export function exportSymKey(key: MyCryptoKey): string {
  return key.data.toString("base64");
}

function toKeyIfString(
  key: MyCryptoKey | string,
  type: "public" | "private" | "secret"
): MyCryptoKey {
  if (typeof key !== "string") {
    return key;
  }
  switch (type) {
    case "public":
      return importPubKey(key);
    case "private":
      return importPrvKey(key);
    case "secret":
      return importSymKey(key);
  }
}

/**
 * rsaEncrypt(b64Message, node.pubKey)
 * second param might be string or MyCryptoKey
 */
export function rsaEncrypt(
  message: string | Buffer,
  pubKey: MyCryptoKey | string
): Buffer {
  const keyObj = toKeyIfString(pubKey, "public");
  const data = typeof message === "string" ? Buffer.from(message, "base64") : message;
  const nodeKey = crypto.createPublicKey({
    key: keyObj.data,
    format: "der",
    type: "spki",
  });
  return crypto.publicEncrypt(nodeKey, data);
}

/**
 * Make rsaDecrypt return base64 so the test expects `decrypted === originalB64`
 */
export function rsaDecrypt(
  encrypted: string | Buffer,
  prvKey: MyCryptoKey | string
): string {
  const keyObj = toKeyIfString(prvKey, "private");
  const data = typeof encrypted === "string" ? Buffer.from(encrypted, "base64") : encrypted;
  const nodeKey = crypto.createPrivateKey({
    key: keyObj.data,
    format: "der",
    type: "pkcs8",
  });
  const rawPlain = crypto.privateDecrypt(nodeKey, data);
  return rawPlain.toString("base64");
}

/**
 * symEncrypt(symKey, b64Message)
 */
export function symEncrypt(
  symKey: MyCryptoKey | string,
  message: string | Buffer
): Buffer {
  const keyObj = toKeyIfString(symKey, "secret");
  const data = typeof message === "string" ? Buffer.from(message, "base64") : message;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyObj.data, iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, enc]);
}

/**
 * symDecrypt(symKey, encrypted) => returns base64 string
 */
export function symDecrypt(
  symKey: MyCryptoKey | string,
  encrypted: string | Buffer
): string {
  const keyObj = toKeyIfString(symKey, "secret");
  const buf = typeof encrypted === "string" ? Buffer.from(encrypted, "base64") : encrypted;
  const iv = buf.slice(0, 16);
  const actualData = buf.slice(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyObj.data, iv);
  const decrypted = Buffer.concat([decipher.update(actualData), decipher.final()]);
  return decrypted.toString("base64");
}
