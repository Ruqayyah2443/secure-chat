const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicExported))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privateExported))),
    rawPrivateKey: keyPair.privateKey,
  };
}

export async function importPublicKey(publicKeyBase64) {
  const binary = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "spki", binary, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
  );
}

export async function importPrivateKey(privateKeyBase64) {
  const binary = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "pkcs8", binary, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]
  );
}