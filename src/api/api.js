// import axios from "axios";

// const api = axios.create({
//   baseURL: "https://whisperbox.koyeb.app",
//   timeout: 15000,
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default api;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

  const publicExported = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateExported = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey:     btoa(String.fromCharCode(...new Uint8Array(publicExported))),
    privateKey:    btoa(String.fromCharCode(...new Uint8Array(privateExported))),
    rawPrivateKey: keyPair.privateKey,
  };
}

export async function importPublicKey(publicKeyBase64) {
  const binary = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "spki",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

export async function importPrivateKey(privateKeyBase64) {
  const binary = Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

export async function encryptMessage(plaintext, recipientPublicKeyBase64) {
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedContentBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(plaintext)
  );

  const rawAESKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64);

  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    rawAESKey
  );

  const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  return {
    encryptedContent: toBase64(encryptedContentBuffer),
    encryptedKey:     toBase64(encryptedKeyBuffer),
    iv:               toBase64(iv.buffer),
  };
}

export async function decryptMessage(encryptedContent, encryptedKey, iv, privateKey) {
  const fromBase64 = (b64) =>
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

  const rawAESKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64(encryptedKey)
  );

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    rawAESKeyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(fromBase64(iv)) },
    aesKey,
    fromBase64(encryptedContent)
  );

  return textDecoder.decode(decryptedBuffer);
}
