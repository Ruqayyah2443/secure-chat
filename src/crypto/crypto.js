const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ───────────────────────── HELPERS ───────────────────────── */

function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/* ───────────────────── KEY GENERATION ───────────────────── */

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicExported = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );

  const privateExported = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );

  return {
    publicKey: arrayBufferToBase64(publicExported),
    privateKey: arrayBufferToBase64(privateExported),
    rawPrivateKey: keyPair.privateKey, // used directly in app
  };
}

/* ───────────────────── KEY IMPORT ───────────────────── */

export async function importPublicKey(publicKeyBase64) {
  const binary = base64ToArrayBuffer(publicKeyBase64);

  return await window.crypto.subtle.importKey(
    "spki",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

export async function importPrivateKey(privateKeyBase64) {
  const binary = base64ToArrayBuffer(privateKeyBase64);

  return await window.crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

/* ───────────────────── ENCRYPT MESSAGE ───────────────────── */

export async function encryptMessage(text, publicKeyBase64) {
  // 1. Import recipient public key
  const publicKey = await importPublicKey(publicKeyBase64);

  // 2. Generate AES key (for message encryption)
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 3. Encrypt message with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(text)
  );

  // 4. Export AES key
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // 5. Encrypt AES key with RSA public key
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawAesKey
  );

  return {
    encryptedContent: arrayBufferToBase64(encryptedContent),
    encryptedKey: arrayBufferToBase64(encryptedKey),
    iv: arrayBufferToBase64(iv),
  };
}

/* ───────────────────── DECRYPT MESSAGE ───────────────────── */

export async function decryptMessage(
  encryptedContent,
  encryptedKey,
  iv,
  privateKey
) {
  // 1. Decrypt AES key using private RSA key
  const aesKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(encryptedKey)
  );

  // 2. Import AES key
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    aesKeyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // 3. Decrypt message
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToArrayBuffer(iv),
    },
    aesKey,
    base64ToArrayBuffer(encryptedContent)
  );

  return decoder.decode(decrypted);
}