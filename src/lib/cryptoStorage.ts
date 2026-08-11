// Local-First AES-GCM Encryption Engine using Web Crypto API

const ENCRYPTION_KEY_NAME = 'xlate_local_master_key_v1';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array | null {
  try {
    let cleaned = (base64 || '').trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
    while (cleaned.length % 4 !== 0) {
      cleaned += '=';
    }
    const binaryString = atob(cleaned);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function getOrCreateEncryptionKey(): Promise<CryptoKey | null> {
  try {
    const storedKeyRaw = localStorage.getItem(ENCRYPTION_KEY_NAME);
    if (storedKeyRaw) {
      const keyBuffer = base64ToBytes(storedKeyRaw);
      if (keyBuffer && keyBuffer.length === 32) {
        return await window.crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
      }
    }

    if (!window.crypto || !window.crypto.subtle) return null;

    const newKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const exported = await window.crypto.subtle.exportKey('raw', newKey);
    const base64Key = bytesToBase64(new Uint8Array(exported));
    localStorage.setItem(ENCRYPTION_KEY_NAME, base64Key);
    return newKey;
  } catch (err) {
    console.warn('Failed to get or create crypto key:', err);
    return null;
  }
}

export async function encryptData(data: any): Promise<string> {
  try {
    const jsonStr = JSON.stringify(data);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(jsonStr);
    const key = await getOrCreateEncryptionKey();

    if (key && window.crypto && window.crypto.subtle) {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
      );

      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      return bytesToBase64(combined);
    }
  } catch (err) {
    console.warn('Encryption fallback due to crypto availability:', err);
  }
  // Safe Base64 fallback using UTF-8 encoding
  try {
    const jsonStr = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonStr);
    return bytesToBase64(bytes);
  } catch {
    return '';
  }
}

export async function decryptData<T = any>(encryptedBase64: string): Promise<T | null> {
  if (!encryptedBase64) return null;

  try {
    const combined = base64ToBytes(encryptedBase64);
    if (combined && combined.length > 12) {
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const key = await getOrCreateEncryptionKey();
      if (key && window.crypto && window.crypto.subtle) {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          ciphertext
        );

        const decoder = new TextDecoder();
        const jsonStr = decoder.decode(decryptedBuffer);
        return JSON.parse(jsonStr) as T;
      }
    }
  } catch (err) {
    // Fallback to plain base64 json decode
  }

  try {
    const bytes = base64ToBytes(encryptedBase64);
    if (bytes) {
      const jsonStr = new TextDecoder().decode(bytes);
      return JSON.parse(jsonStr) as T;
    }
  } catch {
    console.error('Decryption failed completely');
  }
  return null;
}

